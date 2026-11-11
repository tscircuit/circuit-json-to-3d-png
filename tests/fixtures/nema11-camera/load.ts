import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { AnyCircuitElement } from "circuit-json"
import manifest from "./manifest.json"

let fixturePromise: Promise<AnyCircuitElement[]> | undefined

/** Actual published NEMA11 controller and OEM motor, not replacement geometry.
 * Keep every record and transform. Only model URLs become checksum-verified
 * data URLs so conversion makes no additional model requests. No source/model
 * bytes are redistributed in this repository; see README.md for provenance.
 */
export function loadNema11CameraFixture(): Promise<AnyCircuitElement[]> {
  fixturePromise ??= (async () => {
    const sourceRoot = process.env.NEMA11_REPRO_SOURCE
    const base = `https://raw.githubusercontent.com/AnasSarkiz/NEMA11_RP2040/${manifest.commit}/${manifest.root}/`
    const entries = Object.entries(manifest.files)
    const files = new Map<string, Uint8Array>()
    let next = 0
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        for (let index = next++; index < entries.length; index = next++) {
          const [path, expected] = entries[index]!
          const bytes = sourceRoot
            ? await readFile(join(sourceRoot, manifest.root, path))
            : await (async () => {
                const response = await fetch(new URL(path, base), {
                  signal: AbortSignal.timeout(60_000),
                })
                if (!response.ok)
                  throw new Error(
                    `NEMA11 fixture ${path}: HTTP ${response.status}`,
                  )
                return new Uint8Array(await response.arrayBuffer())
              })()
          if (
            bytes.length !== expected.bytes ||
            createHash("sha256").update(bytes).digest("hex") !== expected.sha256
          ) {
            throw new Error(`NEMA11 fixture checksum mismatch: ${path}`)
          }
          files.set(path, bytes)
        }
      }),
    )
    const circuit: AnyCircuitElement[] = JSON.parse(
      new TextDecoder().decode(files.get(manifest.circuitJson)!),
    )
    if (
      circuit.length !== manifest.records ||
      circuit.filter((item) => item.type === "cad_component").length !==
        manifest.cadComponents
    ) {
      throw new Error("Unexpected NEMA11 native record count")
    }
    return circuit.map((item) => {
      if (item.type !== "cad_component" || !item.model_obj_url) return item
      const path = item.model_obj_url.replace(/^\.\//, "")
      const bytes = files.get(path)
      if (!bytes) throw new Error(`Unpinned NEMA11 model: ${path}`)
      return {
        ...item,
        model_obj_url: `data:text/plain;base64,${Buffer.from(bytes).toString("base64")}`,
      }
    })
  })()
  return fixturePromise
}
