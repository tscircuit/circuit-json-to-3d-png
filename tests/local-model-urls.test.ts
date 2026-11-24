import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonTo3dGlb } from "lib/index"

const triangleObj = ["v 0 0 0", "v 1 0 0", "v 0 1 0", "f 1 2 3"].join("\n")

const board: AnyCircuitElement = {
  type: "pcb_board",
  pcb_board_id: "board",
  center: { x: 0, y: 0 },
  width: 10,
  height: 10,
  thickness: 1.6,
  num_layers: 2,
  material: "fr4",
}

const getGlbJson = (glb: Uint8Array) => {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength)
  const jsonLength = view.getUint32(12, true)
  const jsonStart = 20
  return JSON.parse(
    new TextDecoder().decode(glb.subarray(jsonStart, jsonStart + jsonLength)),
  )
}

test("local model filenames containing # are loaded instead of truncated", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cjson3d-model-"))
  try {
    const withoutModel = await convertCircuitJsonTo3dGlb([board])
    const cases = [
      { filename: "part#v1.obj", useRelative: false },
      { filename: "part-relative#v1.obj", useRelative: true },
    ]

    for (const { filename, useRelative } of cases) {
      const modelPath = join(directory, filename)
      await writeFile(modelPath, triangleObj)
      const withModel = await convertCircuitJsonTo3dGlb(
        [
          board,
          {
            type: "cad_component",
            cad_component_id: `local-model-${filename}`,
            source_component_id: `local-model-source-${filename}`,
            model_obj_url: useRelative ? filename : modelPath,
            position: { x: 0, y: 0, z: 2 },
            rotation: { x: 0, y: 0, z: 0 },
          } as AnyCircuitElement,
        ],
        { modelPathBaseDir: directory },
      )

      expect(getGlbJson(withModel).meshes.length).toBeGreaterThan(
        getGlbJson(withoutModel).meshes.length,
      )
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 60_000)
