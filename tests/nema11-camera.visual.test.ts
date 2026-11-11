import { expect, test } from "bun:test"
import {
  buildCamera,
  createSceneFromGLTF,
  loadGLTFWithResourcesFromURL,
} from "poppygl"
import {
  convertCircuitJsonTo3dGlb,
  getAssemblyCameraForCircuitJson,
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
      // The original exporter wrapped the genuine motor's indices at 65,536.
      // Require the published 32-bit-index fix, not a visual-only workaround.
      let largePrimitives = 0
      for (const mesh of gltf.meshes ?? []) {
        for (const primitive of mesh.primitives) {
          if (gltf.accessors[primitive.attributes.POSITION].count <= 65_536)
            continue
          largePrimitives++
          expect(gltf.accessors[primitive.indices].componentType).toBe(5125)
        }
      }
      expect(largePrimitives).toBeGreaterThan(0)
      for (const draw of scene.drawCalls) {
        if (draw.positions.length / 3 <= 65_536) continue
        expect(draw.indices).not.toBeNull()
        const maxIndex = draw.indices!.reduce(
          (max, index) => Math.max(max, index),
          0,
        )
        expect(maxIndex).toBeGreaterThan(65_535)
        expect(maxIndex).toBeLessThan(draw.positions.length / 3)
      }
      const camera = await getAssemblyCameraForCircuitJson(circuit, {
        width,
        height,
      })
      const { view, proj } = buildCamera(
        scene.drawCalls,
        width,
        height,
        camera.fov,
        camera.camPos,
        camera.lookAt,
      )
      const projected = [Infinity, Infinity, -Infinity, -Infinity]
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
          const x = clip[0]! / clip[3]!
          const y = clip[1]! / clip[3]!
          projected[0] = Math.min(projected[0]!, x)
          projected[1] = Math.min(projected[1]!, y)
          projected[2] = Math.max(projected[2]!, x)
          projected[3] = Math.max(projected[3]!, y)
          vertices++
        }
      }
      expect(vertices).toBeGreaterThan(500_000)
      // Every actual exported vertex must fit, including the original motor leads.
      expect(outside).toBe(0)
      // At least one dimension fills 90% of the image, with all sides inset.
      const fill =
        Math.max(projected[2]! - projected[0]!, projected[3]! - projected[1]!) /
        2
      expect(fill).toBeGreaterThan(0.89)
      expect(Math.max(...projected.map(Math.abs))).toBeLessThan(0.901)
      console.log(
        `NEMA11 ${name}: ${outside}/${vertices} vertices outside camera`,
      )
      console.log(
        `NEMA11 ${name} projected bounds: ${JSON.stringify(projected)}`,
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
