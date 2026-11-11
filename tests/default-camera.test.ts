import { expect, test } from "bun:test"
import { getBestCameraPosition } from "circuit-json-to-gltf"
import { getDefaultCameraForCircuitJson } from "../lib"
import { tallAssembly } from "./fixtures/tall-assembly"

test("default camera retains metadata-only behavior without loading models", async () => {
  let requests = 0
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      requests++
      return new Response("Models must not be requested", { status: 503 })
    },
  })
  try {
    const circuit = tallAssembly.map((item) =>
      item.type === "cad_component"
        ? { ...item, model_obj_url: `${server.url}model.obj` }
        : item,
    )
    expect(await getDefaultCameraForCircuitJson(circuit)).toEqual(
      getBestCameraPosition(circuit),
    )
    expect(requests).toBe(0)
  } finally {
    await server.stop(true)
  }
})
