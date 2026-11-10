import {
  renderGLTFToPNGFromURL,
  renderSceneFromGLTF,
  encodePNG,
  computeWorldAABB,
} from "poppygl"
import { loadGlbScene } from "../../lib/load-glb-scene"
import { fitCameraToBounds } from "../../lib/fit-camera-to-bounds"

type BrowserRenderResult = {
  byteLength: number
  signature: number[]
  isUint8Array: boolean
  sceneRenderByteLength: number
}

;(
  globalThis as typeof globalThis & { __browserRenderStarted?: boolean }
).__browserRenderStarted = true

const png = await renderGLTFToPNGFromURL("/fixture.glb")
const scene = await loadGlbScene(
  await (await fetch("/fixture.glb")).arrayBuffer(),
)
const camera = fitCameraToBounds(
  computeWorldAABB(scene.drawCalls),
  {
    camPos: [10, 10, 10],
    lookAt: [0, 0, 0],
    fov: 50,
  },
  320 / 480,
)
const scenePng = await encodePNG(
  renderSceneFromGLTF(scene, {
    ...camera,
    width: 320,
    height: 480,
  }).bitmap,
)

;(
  globalThis as typeof globalThis & {
    __browserRenderResult?: BrowserRenderResult
  }
).__browserRenderResult = {
  byteLength: png.byteLength,
  signature: Array.from(png.slice(0, 4)),
  isUint8Array: png instanceof Uint8Array,
  sceneRenderByteLength: scenePng.byteLength,
}
