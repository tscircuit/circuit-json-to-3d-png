import type { AnyCircuitElement } from "circuit-json"
import {
  CAMERA_PRESET_NAMES,
  applyCameraPreset,
  type CameraOptions,
  type CameraPreset,
} from "./camera-presets"
import { normalizeToArrayBuffer, normalizeToUint8Array } from "./binary-utils"
import { loadCircuitJsonToGltf, loadPoppyGl } from "./load-modules"
import { normalizeModelUrls } from "./model-paths"

export type { CameraOptions, CameraPreset }
export { CAMERA_PRESET_NAMES, applyCameraPreset }

export type ConvertCircuitJsonTo3dGltfResult = Awaited<
  ReturnType<typeof import("circuit-json-to-gltf")["convertCircuitJsonToGltf"]>
>

export type CircuitJson3dBaseOptions = {
  modelPathBaseDir?: string
  projectBaseUrl?: string
  authHeaders?: { Authorization: string }
  boardTextureResolution?: number
}

export type RenderCircuitJsonTo3dPngOptions = CircuitJson3dBaseOptions & {
  camera?: CameraOptions
  cameraPreset?: CameraPreset
}

const getRenderCamera = (
  circuitJson: AnyCircuitElement[],
  defaultCamera: CameraOptions,
  options: RenderCircuitJsonTo3dPngOptions = {},
): CameraOptions => {
  if (options.camera) {
    return options.camera
  }

  if (!options.cameraPreset) {
    return defaultCamera
  }

  return applyCameraPreset(options.cameraPreset, defaultCamera)
}

const getConversionOptions = (
  format: "gltf" | "glb",
  options: CircuitJson3dBaseOptions = {},
) => ({
  format,
  ...(options.projectBaseUrl ? { projectBaseUrl: options.projectBaseUrl } : {}),
  ...(options.authHeaders ? { authHeaders: options.authHeaders } : {}),
  ...(options.boardTextureResolution
    ? { boardTextureResolution: options.boardTextureResolution }
    : {}),
})

export const getDefaultCameraForCircuitJson = (
  circuitJson: AnyCircuitElement[],
): Promise<CameraOptions> =>
  loadCircuitJsonToGltf().then(({ getBestCameraPosition }) =>
    getBestCameraPosition(circuitJson),
  )

export const convertCircuitJsonTo3dGltf = async (
  circuitJson: AnyCircuitElement[],
  options: CircuitJson3dBaseOptions = {},
): Promise<ConvertCircuitJsonTo3dGltfResult> => {
  const normalizedCircuitJson = normalizeModelUrls(circuitJson, options)
  const { convertCircuitJsonToGltf } = await loadCircuitJsonToGltf()
  return convertCircuitJsonToGltf(
    normalizedCircuitJson,
    getConversionOptions("gltf", options),
  )
}

export const convertCircuitJsonTo3dGlb = async (
  circuitJson: AnyCircuitElement[],
  options: CircuitJson3dBaseOptions = {},
): Promise<Uint8Array> => {
  const normalizedCircuitJson = normalizeModelUrls(circuitJson, options)
  const { convertCircuitJsonToGltf } = await loadCircuitJsonToGltf()
  const glbBuffer = await convertCircuitJsonToGltf(
    normalizedCircuitJson,
    getConversionOptions("glb", options),
  )
  return normalizeToUint8Array(await normalizeToArrayBuffer(glbBuffer))
}

export const renderCircuitJsonTo3dPng = async (
  circuitJson: AnyCircuitElement[],
  options: RenderCircuitJsonTo3dPngOptions = {},
): Promise<Uint8Array> => {
  const [{ getBestCameraPosition }, { renderGLTFToPNGFromGLB }] =
    await Promise.all([loadCircuitJsonToGltf(), loadPoppyGl()])
  const glbBuffer = await convertCircuitJsonTo3dGlb(circuitJson, options)
  const glbArrayBuffer = await normalizeToArrayBuffer(glbBuffer)
  const defaultCamera = getBestCameraPosition(circuitJson)
  return renderGLTFToPNGFromGLB(
    glbArrayBuffer,
    getRenderCamera(circuitJson, defaultCamera, options),
  )
}
