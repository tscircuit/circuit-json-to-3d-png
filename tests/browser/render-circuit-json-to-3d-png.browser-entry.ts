import { renderGLTFToPNGFromURL } from "poppygl"

type BrowserRenderResult = {
  byteLength: number
  signature: number[]
  isUint8Array: boolean
}

;(
  globalThis as typeof globalThis & { __browserRenderStarted?: boolean }
).__browserRenderStarted = true

const png = await renderGLTFToPNGFromURL("/fixture.glb")

;(
  globalThis as typeof globalThis & {
    __browserRenderResult?: BrowserRenderResult
  }
).__browserRenderResult = {
  byteLength: png.byteLength,
  signature: Array.from(png.slice(0, 4)),
  isUint8Array: png instanceof Uint8Array,
}
