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
off-board parts, at the requested image aspect ratio. When refitting is needed,
actual transformed vertices are placed within the central 90% of the image,
giving at least 5% margin on each side. **An existing camera that already contains
the scene is preserved, even if its margin is less than 5%.** Explicit custom
cameras are also never adjusted; no margin or containment guarantee applies to them.

## Camera helpers and cost

- `getDefaultCameraForCircuitJson(circuitJson)` retains its lightweight,
  metadata-only behavior. It does not fetch or process CAD models, so imported,
  tall or off-board geometry may extend outside its estimated view.
- `getAssemblyCameraForCircuitJson(circuitJson, options?)` explicitly requests
  the accurate assembly fit used by the renderer. Each call exports the full
  GLB, resolves/loads imported models, decodes the scene and visits its vertices.
  This can involve network I/O and substantial CPU/memory work. It is not a cheap
  per-frame or interactive camera-update helper, and results are not cached.
  Pass `modelPathBaseDir`, `projectBaseUrl`, or `authHeaders` as for rendering;
  `width`, `height`, and `cameraPreset` match the intended render.

For a PNG, call `renderCircuitJsonTo3dPng` directly. It fits the scene it already
loads for rendering; calling the assembly helper first would repeat conversion
and loading. Use the assembly helper only when a standalone fitted camera is
needed, and reuse the returned camera while the inputs stay unchanged.

Run `bun benchmarks/camera-helpers.ts` for a manual comparison on a small board
and the pinned real NEMA11 fixture. Fixture downloads are excluded from timing;
actual costs depend on model size, source latency and runtime. The benchmark is
not a timing-sensitive CI assertion.

For large imported OBJ models, use `circuit-json-to-gltf` 0.0.133 or later.
Earlier versions can overflow 16-bit mesh indices and distort the geometry.

## Package contents

The published package ships compiled ESM output from `dist/` plus TypeScript declarations.
