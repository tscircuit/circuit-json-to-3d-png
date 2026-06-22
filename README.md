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

## Package contents

The published package ships compiled ESM output from `dist/` plus TypeScript declarations.
