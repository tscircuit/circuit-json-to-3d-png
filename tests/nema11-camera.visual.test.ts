import { expect, test } from "bun:test"
import {
  buildCamera,
  createSceneFromGLTF,
  loadGLTFWithResourcesFromURL,
} from "poppygl"
import {
  convertCircuitJsonTo3dGlb,
  getDefaultCameraForCircuitJson,
  renderCircuitJsonTo3dPng,
} from "../lib"
import "./fixtures/png-matcher"
import { loadNema11CameraFixture } from "./fixtures/nema11-camera/load"

const transform = (m: ArrayLike<number>, p: number[]) =>
  [0, 1, 2, 3].map((row) =>
    [0, 1, 2, 3].reduce((sum, col) => sum + m[col * 4 + row]! * p[col]!, 0),
  )

for (const [name, width, height] of [
  ["landscape", 720, 540],
  ["portrait", 540, 720],
] as const) {
  test(`real NEMA11 camera reproduction: ${name}`, async () => {
    const circuit = await loadNema11CameraFixture()
    const glb = await convertCircuitJsonTo3dGlb(circuit)
    const url = URL.createObjectURL(new Blob([glb.slice().buffer]))
    try {
      const { gltf, resources } = await loadGLTFWithResourcesFromURL(url)
      const scene = createSceneFromGLTF(gltf, resources)
      const camera = await getDefaultCameraForCircuitJson(circuit)
      const { view, proj } = buildCamera(
        scene.drawCalls,
        width,
        height,
        camera.fov,
        camera.camPos,
        camera.lookAt,
      )
      let outside = 0
      let vertices = 0
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
          if (
            clip[3]! <= 0 ||
            clip.slice(0, 3).some((v) => Math.abs(v) > clip[3]!)
          )
            outside++
          vertices++
        }
      }
      expect(vertices).toBeGreaterThan(500_000)
      // Baseline records the observed defect. The stacked fix changes this to 0.
      expect(outside).toBeGreaterThan(0)
      console.log(
        `NEMA11 ${name}: ${outside}/${vertices} vertices outside camera`,
      )
      const png = await renderCircuitJsonTo3dPng(circuit, {
        width,
        height,
        backgroundColor: "#edf1f5",
      })
      await expect(png).toMatchPngSnapshot(
        import.meta.path,
        `nema11-${name}.png`,
      )
    } finally {
      URL.revokeObjectURL(url)
    }
  }, 120_000)
}
