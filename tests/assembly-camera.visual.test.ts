import { expect, test } from "bun:test"
import { renderCircuitJsonTo3dPng } from "../lib"
import "./fixtures/png-matcher"
import { tallAssembly } from "./fixtures/tall-assembly"

for (const [name, width, height] of [
  ["landscape", 480, 320],
  ["portrait", 320, 480],
  ["square", 400, 400],
] as const) {
  test(`tall assembly camera: ${name}`, async () => {
    const png = await renderCircuitJsonTo3dPng(tallAssembly, {
      width,
      height,
      backgroundColor: "#f2f3f5",
    })
    await expect(png).toMatchPngSnapshot(
      import.meta.path,
      `assembly-${name}.png`,
    )
  }, 60_000)
}
