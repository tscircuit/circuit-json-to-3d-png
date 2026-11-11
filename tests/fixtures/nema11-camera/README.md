# Actual NEMA11 camera reproduction

This uses the published native Circuit JSON from
[AnasSarkiz/NEMA11_RP2040, commit 1266cf8](https://github.com/AnasSarkiz/NEMA11_RP2040/tree/1266cf8bb55ba6ee868af4f26fc2980d68fd3b32/boards/nema11-rp2040-two-layer--20261022-a1),
including all 4,212 records, 90 CAD components and the genuine STEPPERONLINE
11HS12-0674S motor. No geometry, placements, rotations, board size or lead
lengths are changed. Only model URLs are replaced with verified data URLs.

The PCB and motor are in the source's **10 mm exploded inspection pose**, not a
validated mounting stack or fabrication-ready board. This test is about camera
framing only. It does not approve mounting, insulation, routing or manufacture.

## Sources and licensing

`manifest.json` pins the public repository commit, paths, sizes and SHA-256
checksums of the native Circuit JSON and 43 distinct OBJ files. The inputs are
about 8.2 MB total. Tests download these immutable URLs once per process, with
up to eight simultaneous requests. A missing file or different checksum fails
explicitly; there is no fallback shape or silently skipped model.

The source repository does not declare a redistribution license for its OEM
CAD asset. This repository therefore includes **no copied circuit, OBJ, STEP
or GLB source bytes**, and does not claim to relicense them under this package's
MIT license. Copyright and any applicable source terms remain with the original
authors. The committed PNGs document the requested regression reproduction.

For offline runs, first obtain the public repository at the pinned commit and
set `NEMA11_REPRO_SOURCE` to its root. The same checksums are enforced:

```sh
NEMA11_REPRO_SOURCE=/path/to/NEMA11_RP2040 bun test tests/nema11-camera.visual.test.ts
```

The repro PR records the clipped native output and counts actual exported mesh
vertices outside PoppyGL's view/projection matrices. The stacked fix uses the
same inputs and changes only camera fitting, the expected outside count and
the two PNG snapshots. Neither side uses mocked rendering or a manually chosen
camera. Regenerate snapshots with `BUN_UPDATE_SNAPSHOTS=1` only after inspecting
the rendered images.
