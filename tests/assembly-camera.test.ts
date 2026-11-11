import { beforeAll, expect, test } from "bun:test"
import { buildCamera, renderGLTFToPNGFromGLB, type GLTFScene } from "poppygl"
import {
  CAMERA_PRESET_NAMES,
  convertCircuitJsonTo3dGlb,
  getAssemblyCameraForCircuitJson,
  renderCircuitJsonTo3dPng,
} from "../lib"
import { fitCameraToScene } from "../lib/fit-camera-to-scene"
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
      const camera = await getAssemblyCameraForCircuitJson(tallAssembly, {
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

const identity = new Float32Array([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
])

test("scene fitting preserves sufficient cameras and handles unusable inputs", () => {
  const camera = {
    camPos: [100, 100, 100],
    lookAt: [0, 0, 0],
    fov: 50,
  } as const
  const draw = {
    positions: new Float32Array([-1, -1, -1, 1, 1, 1]),
    model: identity,
  }
  expect(fitCameraToScene([draw], camera, 1)).toBe(camera)
  expect(fitCameraToScene([], camera, 1)).toBe(camera)
  expect(
    fitCameraToScene(
      [{ ...draw, positions: new Float32Array([Infinity, 0, 0]) }],
      camera,
      1,
    ),
  ).toBe(camera)
  expect(fitCameraToScene([draw], camera, 0)).toBe(camera)
  expect(fitCameraToScene([draw], camera, Number.NaN)).toBe(camera)
  const poleCamera = { ...camera, camPos: [0, 100, 0] as const }
  expect(fitCameraToScene([draw], poleCamera, 1)).toBe(poleCamera)
})

test("already-fitting views retain margins smaller than five percent", () => {
  const camera = { camPos: [0, 0, 10], lookAt: [0, 0, 0], fov: 90 } as const
  const draw = {
    positions: new Float32Array([-9.8, 0, 0, 9.8, 0, 0]),
    model: identity,
  }
  const fitted = fitCameraToScene([draw], camera, 1)
  expect(fitted).toBe(camera)
  const ndcX =
    draw.positions[3]! /
    (camera.camPos[2] * Math.tan((camera.fov * Math.PI) / 360))
  expect((1 - ndcX) / 2).toBeCloseTo(0.01, 5)
})

test("diagonal geometry fits tightly without fitting empty AABB corners", () => {
  const draw = {
    positions: new Float32Array([-10, -10, 10, 10, 10, -10]),
    model: identity,
  }
  const camera = fitCameraToScene(
    [draw],
    { camPos: [0, 0, 3], lookAt: [0, 0, 0], fov: 50 },
    1,
  )
  const tangent = Math.tan((50 * Math.PI) / 360)
  const projected = []
  for (let i = 0; i < draw.positions.length; i += 3) {
    const depth = camera.camPos[2] - draw.positions[i + 2]!
    projected.push((draw.positions[i]! - camera.camPos[0]) / (depth * tangent))
  }
  expect(Math.min(...projected)).toBeCloseTo(-0.9, 5)
  expect(Math.max(...projected)).toBeCloseTo(0.9, 5)
  expect(camera.lookAt[0]).toBeLessThan(-1)
  expect(camera.camPos[2]).toBeLessThan(10 + 10 / (tangent * 0.9))
})

test("model-only and translated assemblies fit their actual vertices", async () => {
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
    const scene = await loadGlbScene(mesh.slice().buffer)
    const camera = await getAssemblyCameraForCircuitJson(circuit, {
      width: 320,
      height: 480,
    })
    const { view, proj } = buildCamera(
      scene.drawCalls,
      320,
      480,
      camera.fov,
      camera.camPos,
      camera.lookAt,
    )
    for (const draw of scene.drawCalls) {
      for (let i = 0; i < draw.positions.length; i += 3) {
        const clip = transform(
          proj,
          transform(
            view,
            transform(draw.model, [
              draw.positions[i]!,
              draw.positions[i + 1]!,
              draw.positions[i + 2]!,
              1,
            ]),
          ),
        )
        expect(clip[3]!).toBeGreaterThan(0)
        expect(
          Math.max(...clip.slice(0, 3).map((v) => Math.abs(v / clip[3]!))),
        ).toBeLessThan(1)
      }
    }
    expect(camera.camPos.every(Number.isFinite)).toBe(true)
  }
}, 60_000)
