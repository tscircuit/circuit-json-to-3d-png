import type { AnyCircuitElement } from "circuit-json"
import {
  getAssemblyCameraForCircuitJson,
  getDefaultCameraForCircuitJson,
} from "../lib"
import basicBoard from "../tests/fixtures/basic-board.fixture.json"
import { loadNema11CameraFixture } from "../tests/fixtures/nema11-camera/load"

// Manual benchmark, not a CI timing assertion. Resolve the pinned source first
// so network variability is excluded; production model URLs may add I/O cost.
const fixtures: [string, AnyCircuitElement[]][] = [
  ["small board", basicBoard as AnyCircuitElement[]],
  ["real NEMA11", await loadNema11CameraFixture()],
]
const median = (samples: number[]) =>
  samples.slice().sort((a, b) => a - b)[Math.floor(samples.length / 2)]!

for (const [fixture, circuit] of fixtures) {
  for (const [helper, calculate, repeats] of [
    ["metadata", getDefaultCameraForCircuitJson, 100],
    ["assembly", getAssemblyCameraForCircuitJson, 1],
  ] as const) {
    await calculate(circuit)
    const samples: number[] = []
    for (let i = 0; i < 5; i++) {
      const start = performance.now()
      for (let repeat = 0; repeat < repeats; repeat++) await calculate(circuit)
      samples.push((performance.now() - start) / repeats)
    }
    console.log(
      JSON.stringify({
        fixture,
        helper,
        warmRuns: 5,
        medianMs: median(samples),
        minMs: Math.min(...samples),
        maxMs: Math.max(...samples),
      }),
    )
  }
}
