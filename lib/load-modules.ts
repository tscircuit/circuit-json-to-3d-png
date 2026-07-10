type CircuitJsonToGltfModule = typeof import("circuit-json-to-gltf")
type PoppyGlModule = typeof import("poppygl")

declare global {
  var tscircuitDynamicModules:
    | {
        "circuit-json-to-gltf"?: CircuitJsonToGltfModule
      }
    | undefined
}

let circuitJsonToGltfModulePromise: Promise<CircuitJsonToGltfModule> | null =
  null
let poppyGlModulePromise: Promise<PoppyGlModule> | null = null

export const loadCircuitJsonToGltf =
  async (): Promise<CircuitJsonToGltfModule> => {
    circuitJsonToGltfModulePromise ??= (async () => {
      try {
        return await import("circuit-json-to-gltf")
      } catch (error) {
        const dynamicGlobal =
          globalThis.tscircuitDynamicModules?.["circuit-json-to-gltf"]

        if (dynamicGlobal) return dynamicGlobal

        throw new Error(
          'Unable to load "circuit-json-to-gltf" from import() or globalThis.tscircuitDynamicModules.',
          { cause: error },
        )
      }
    })()
    return circuitJsonToGltfModulePromise
  }

export const loadPoppyGl = async (): Promise<PoppyGlModule> => {
  poppyGlModulePromise ??= import("poppygl")
  return poppyGlModulePromise
}
