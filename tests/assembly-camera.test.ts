import { beforeAll, expect, test } from "bun:test"
import {
  buildCamera,
  computeWorldAABB,
  renderGLTFToPNGFromGLB,
  type GLTFScene,
} from "poppygl"
import {
  CAMERA_PRESET_NAMES,
  convertCircuitJsonTo3dGlb,
  getDefaultCameraForCircuitJson,
  renderCircuitJsonTo3dPng,
} from "../lib"
import { fitCameraToBounds } from "../lib/fit-camera-to-bounds"
import { loadGlbScene } from "../lib/load-glb-scene"
import { tallAssembly } from "./fixtures/tall-assembly"

let glb: Uint8Array
let scene: GLTFScene
const originalCircuit = JSON.stringify(tallAssembly)
beforeAll(async () => {
  glb = await convertCircuitJsonTo3dGlb(tallAssembly)
  scene = await loadGlbScene(glb.slice().buffer)
})

// Independent clip-space check using the actual renderer matrices and every
// exported mesh vertex, rather than repeating the fitter's distance formula.
function transform(matrix: ArrayLike<number>, p: number[]): number[] {
  return [0, 1, 2, 3].map((row) =>
    [0, 1, 2, 3].reduce(
      (sum, col) => sum + matrix[col * 4 + row]! * p[col]!,
      0,
    ),
  )
}

for (const [width, height] of [
  [480, 320],
  [320, 480],
  [400, 400],
] as const) {
  for (const preset of [undefined, ...CAMERA_PRESET_NAMES]) {
    test(`all assembly vertices fit ${width}x${height}, ${preset ?? "default"}`, async () => {
      const camera = await getDefaultCameraForCircuitJson(tallAssembly, {
        width,
        height,
        cameraPreset: preset,
      })
      const { view, proj } = buildCamera(
        scene.drawCalls,
        width,
        height,
        camera.fov,
        camera.camPos,
        camera.lookAt,
      )
      let maxClip = 0
      let vertices = 0
      for (const draw of scene.drawCalls) {
        for (let i = 0; i < draw.positions.length; i += 3) {
          const point = [
            draw.positions[i]!,
            draw.positions[i + 1]!,
            draw.positions[i + 2]!,
            1,
          ]
          const clip = transform(
            proj,
            transform(view, transform(draw.model, point)),
          )
          expect(clip[3]!).toBeGreaterThan(0)
          maxClip = Math.max(
            maxClip,
            ...clip.slice(0, 3).map((v) => Math.abs(v / clip[3]!)),
          )
          vertices++
        }
      }
      expect(vertices).toBeGreaterThan(50)
      expect(maxClip).toBeLessThan(1)
      expect(JSON.stringify(tallAssembly)).toBe(originalCircuit)
    }, 60_000)
  }
}

test("custom cameras keep identical native rendering, even if intentionally cropped", async () => {
  const camera = { camPos: [0, 40, 20], lookAt: [0, 0, 0], fov: 25 } as const
  const options = { ...camera, width: 240, height: 320 }
  const native = await renderGLTFToPNGFromGLB(glb, options)
  const wrapped = await renderCircuitJsonTo3dPng(tallAssembly, {
    camera,
    cameraPreset: "front",
    width: 240,
    height: 320,
  })
  expect(wrapped).toEqual(native)
  expect(await convertCircuitJsonTo3dGlb(tallAssembly)).toEqual(glb)
}, 60_000)

test("bounds fitting preserves an already sufficient camera and rejects invalid bounds", () => {
  const camera = {
    camPos: [100, 100, 100],
    lookAt: [0, 0, 0],
    fov: 50,
  } as const
  expect(
    fitCameraToBounds({ min: [-1, -1, -1], max: [1, 1, 1] }, camera, 1),
  ).toBe(camera)
  expect(
    fitCameraToBounds({ min: [Infinity, 0, 0], max: [1, 1, 1] }, camera, 1),
  ).toBe(camera)
  expect(fitCameraToBounds({ min: [2, 0, 0], max: [1, 1, 1] }, camera, 1)).toBe(
    camera,
  )
})

test("model-only and translated assemblies target actual exported bounds", async () => {
  const modelOnly = tallAssembly.filter((item) => item.type !== "pcb_board")
  const translated = tallAssembly.map((item) => {
    if (item.type === "pcb_board")
      return {
        ...item,
        center: { x: item.center.x + 150, y: item.center.y - 90 },
      }
    if (item.type === "cad_component")
      return {
        ...item,
        position: {
          x: item.position.x + 150,
          y: item.position.y - 90,
          z: item.position.z,
        },
      }
    return item
  })
  for (const circuit of [modelOnly, translated]) {
    const mesh = await convertCircuitJsonTo3dGlb(circuit)
    const measured = computeWorldAABB(
      (await loadGlbScene(mesh.slice().buffer)).drawCalls,
    )
    const camera = await getDefaultCameraForCircuitJson(circuit, {
      width: 320,
      height: 480,
    })
    expect([...camera.lookAt]).toEqual(
      measured.min.map((v, i) => (v + measured.max[i]!) / 2),
    )
    expect(camera.camPos.every(Number.isFinite)).toBe(true)
  }
}, 60_000)
