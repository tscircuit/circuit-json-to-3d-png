# circuit-json-to-3d-png

Convert `circuit-json` designs into 3D PNG renders.

## Install

```bash
npm install circuit-json-to-3d-png
```

## Usage

```ts
import { renderCircuitJsonTo3dPng } from "circuit-json-to-3d-png"

const png = await renderCircuitJsonTo3dPng(circuitJson, {
  width: 1024,
  height: 1024,
  backgroundColor: "#ffffff",
  showInfiniteGrid: true,
  supersampling: 2,
})
```

## Render options

- `width`
- `height`
- `backgroundColor`
- `showInfiniteGrid`
- `supersampling`
- `camera`
- `cameraPreset`

Default and preset cameras fit the exported geometry, including tall or
off-board parts, at the requested image aspect ratio. Existing framing is kept
when it already contains the scene. Otherwise, fitting uses the actual transformed
vertices with a 5% image margin on each side, rather than empty world-bounds corners.
An explicit `camera` is never adjusted.

`getDefaultCameraForCircuitJson(circuitJson, options?)` uses the same fit. It now
loads models to measure their actual bounds; pass `modelPathBaseDir`,
`projectBaseUrl`, or `authHeaders` as for rendering when needed. Its optional
`width`, `height`, and `cameraPreset` match the intended render.

## Package contents

The published package ships compiled ESM output from `dist/` plus TypeScript declarations.
