import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { AnyCircuitElement, CadComponent } from "circuit-json"
import { convertCircuitJsonTo3dGltf } from "lib/index"
import { normalizeModelUrls } from "../lib/model-paths"
import fixture from "./fixtures/basic-board.fixture.json"

const normalize = (
  url: string,
  options: { modelPathBaseDir?: string; projectBaseUrl?: string } = {},
) => {
  const cad = {
    ...fixture.find((element) => element.type === "cad_component")!,
    model_obj_url: url,
  } as CadComponent
  const normalized = normalizeModelUrls([cad], options)[0] as CadComponent
  return normalized.model_obj_url
}

test.each([
  ["/models/board#1", "file:///models/board%231/part.obj"],
  ["/models/board?1", "file:///models/board%3F1/part.obj"],
  ["/models/board%20one", "file:///models/board%2520one/part.obj"],
  ["C:\\models\\board#1", "file:///C:/models/board%231/part.obj"],
])("preserves the local model directory %s", (modelPathBaseDir, expected) => {
  expect(normalize("part.obj", { modelPathBaseDir })).toBe(expected)
})

test("escapes reserved characters in absolute filesystem model paths", () => {
  expect(normalize("/models/part#1?rev%20.obj")).toBe(
    "file:///models/part%231%3Frev%2520.obj",
  )
})

test("preserves explicit URLs and project-relative URL semantics", () => {
  for (const url of [
    "https://example.com/part%20one.glb?rev=1#mesh",
    "file:///models/part%20one.glb",
    "data:model/gltf-binary;base64,AAAA",
  ]) {
    expect(normalize(url, { modelPathBaseDir: "/models#1" })).toBe(url)
  }
  expect(
    normalize("parts/part%20one.glb?rev=1#mesh", {
      projectBaseUrl: "https://example.com/project/",
    }),
  ).toBe("parts/part%20one.glb?rev=1#mesh")
  expect(normalize("part%20one.obj", { modelPathBaseDir: "/models#1" })).toBe(
    "file:///models%231/part%20one.obj",
  )
})

test("GLTF export loads the model inside a directory containing #", async () => {
  const root = await mkdtemp(join(tmpdir(), "circuit-json-model-paths-"))
  const modelDir = join(root, "models#1")
  const modelPath = join(modelDir, "part.obj")
  try {
    await mkdir(modelDir)
    await writeFile(modelPath, "v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n")
    await writeFile(
      join(root, "part.obj"),
      "v 0 0 0\nv 10 0 0\nv 0 10 0\nf 1 2 3\n",
    )
    const circuit = fixture
      .filter(
        (element) =>
          element.type !== "cad_component" ||
          element.cad_component_id === "cad_component_0",
      )
      .map((element) =>
        element.type === "cad_component"
          ? {
              ...element,
              footprinter_string: undefined,
              model_obj_url: "part.obj",
            }
          : element,
      ) as AnyCircuitElement[]
    const original = structuredClone(circuit)
    const actual = await convertCircuitJsonTo3dGltf(circuit, {
      modelPathBaseDir: modelDir,
      boardTextureResolution: 64,
    })
    const expected = await convertCircuitJsonTo3dGltf(
      circuit.map((element) =>
        element.type === "cad_component"
          ? { ...element, model_obj_url: pathToFileURL(modelPath).href }
          : element,
      ),
      { boardTextureResolution: 64 },
    )

    const gltf = actual as {
      meshes: {
        name: string
        primitives: [{ attributes: { POSITION: number } }]
      }[]
      accessors: { count: number; min: number[]; max: number[] }[]
    }
    const modelMesh = gltf.meshes.find((mesh) => mesh.name === "R1")
    expect(modelMesh).toBeDefined()
    const positions =
      gltf.accessors[modelMesh!.primitives[0].attributes.POSITION]!
    expect(positions.count).toBe(3)
    for (const axis of [0, 1, 2] as const) {
      expect(positions.min[axis]).toBeCloseTo(([-1, 0, 0] as const)[axis], 10)
      expect(positions.max[axis]).toBeCloseTo(([0, 0, 1] as const)[axis], 10)
    }
    expect(actual).toEqual(expected)
    expect(circuit).toEqual(original)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}, 60_000)
