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
import { loadGlbScene } from "./load-glb-scene"
import { fitCameraToBounds } from "./fit-camera-to-bounds"
import type { GLTFScene } from "poppygl"

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
  width?: number
  height?: number
  backgroundColor?: string | readonly [number, number, number] | null
  showInfiniteGrid?: boolean
  supersampling?: number
}

const INFINITE_GRID_COLOR = [0.9, 0.9, 0.9] as const
const INFINITE_GRID_SECTION_COLOR = [0.7, 0.7, 0.9] as const
const INFINITE_GRID_OFFSET = { y: 0 } as const

const getRenderCamera = async (
  circuitJson: AnyCircuitElement[],
  scene: GLTFScene,
  options: RenderCircuitJsonTo3dPngOptions = {},
): Promise<CameraOptions> => {
  if (options.camera) {
    return options.camera
  }

  const [
    { getBestCameraPosition },
    { computeWorldAABB, getDefaultRenderOptions },
  ] = await Promise.all([loadCircuitJsonToGltf(), loadPoppyGl()])
  const defaultCamera = getBestCameraPosition(circuitJson)
  const camera = options.cameraPreset
    ? applyCameraPreset(options.cameraPreset, defaultCamera)
    : defaultCamera
  const defaults = getDefaultRenderOptions()
  const width = options.width ?? defaults.width
  const height = options.height ?? defaults.height
  return fitCameraToBounds(
    computeWorldAABB(scene.drawCalls),
    camera,
    width / height,
  )
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

/** Fit the rendered assembly, including imported models. Conversion options
 * resolve model URLs just as in renderCircuitJsonTo3dPng; size controls aspect.
 */
export const getDefaultCameraForCircuitJson = async (
  circuitJson: AnyCircuitElement[],
  options: CircuitJson3dBaseOptions & {
    width?: number
    height?: number
    cameraPreset?: CameraPreset
  } = {},
): Promise<CameraOptions> => {
  const glb = await convertCircuitJsonTo3dGlb(circuitJson, options)
  const scene = await loadGlbScene(await normalizeToArrayBuffer(glb))
  return getRenderCamera(circuitJson, scene, options)
}

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
  const { renderSceneFromGLTF, encodePNG } = await loadPoppyGl()
  const glbBuffer = await convertCircuitJsonTo3dGlb(circuitJson, options)
  const glbArrayBuffer = await normalizeToArrayBuffer(glbBuffer)
  const scene = await loadGlbScene(glbArrayBuffer)
  const { bitmap } = renderSceneFromGLTF(scene, {
    ...(await getRenderCamera(circuitJson, scene, options)),
    ...(options.width != null ? { width: options.width } : {}),
    ...(options.height != null ? { height: options.height } : {}),
    ...(options.backgroundColor !== undefined
      ? { backgroundColor: options.backgroundColor }
      : {}),
    ...(options.supersampling != null
      ? { supersampling: options.supersampling }
      : {}),
    ...(options.showInfiniteGrid
      ? {
          grid: {
            infiniteGrid: true,
            gridColor: INFINITE_GRID_COLOR,
            sectionColor: INFINITE_GRID_SECTION_COLOR,
            offset: INFINITE_GRID_OFFSET,
          },
        }
      : {}),
  })
  return encodePNG(bitmap)
}
