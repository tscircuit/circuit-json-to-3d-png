import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import "./fixtures/png-matcher"
import basicBoardFixtureJson from "./fixtures/basic-board.fixture.json"
import {
  CAMERA_PRESET_NAMES,
  applyCameraPreset,
  getDefaultCameraForCircuitJson,
  renderCircuitJsonTo3dPng,
} from "lib/index"

const basicBoardFixture = basicBoardFixtureJson as AnyCircuitElement[]

test("camera presets render valid PNGs", async () => {
  const defaultCamera = await getDefaultCameraForCircuitJson(basicBoardFixture)

  for (const preset of CAMERA_PRESET_NAMES) {
    const presetCamera = applyCameraPreset(preset, defaultCamera)
    expect(presetCamera.lookAt).toEqual(defaultCamera.lookAt)
    expect(Number.isFinite(presetCamera.fov)).toBe(true)
    // The exporter default can already match a named preset.
    expect(presetCamera.camPos.every(Number.isFinite)).toBe(true)

    const png = await renderCircuitJsonTo3dPng(basicBoardFixture, {
      cameraPreset: preset,
    })
    expect(png.byteLength).toBeGreaterThan(0)
    expect(png[0]).toBe(0x89)
    expect(png[1]).toBe(0x50)
    expect(png[2]).toBe(0x4e)
    expect(png[3]).toBe(0x47)
    await expect(png).toMatchPngSnapshot(
      import.meta.path,
      `camera-presets.test/${preset}.png`,
    )
  }
}, 120_000)
