import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import basicBoardFixtureJson from "./fixtures/basic-board.fixture.json"
import { renderCircuitJsonTo3dPng } from "lib/index"

const basicBoardFixture = basicBoardFixtureJson as AnyCircuitElement[]

const getPngDimensions = (png: Uint8Array) => {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  }
}

test("render options control png dimensions", async () => {
  const png = await renderCircuitJsonTo3dPng(basicBoardFixture, {
    width: 320,
    height: 240,
  })

  const decoded = getPngDimensions(png)
  expect(decoded.width).toBe(320)
  expect(decoded.height).toBe(240)
}, 60_000)

test("render options accept background color and infinite grid", async () => {
  const png = await renderCircuitJsonTo3dPng(basicBoardFixture, {
    width: 320,
    height: 240,
    backgroundColor: "#ffffff",
    showInfiniteGrid: true,
  })

  const decoded = getPngDimensions(png)
  expect(decoded.width).toBe(320)
  expect(decoded.height).toBe(240)
  expect(png[0]).toBe(0x89)
  expect(png[1]).toBe(0x50)
  expect(png[2]).toBe(0x4e)
  expect(png[3]).toBe(0x47)
}, 60_000)

test("render options accept supersampling", async () => {
  const png = await renderCircuitJsonTo3dPng(basicBoardFixture, {
    width: 256,
    height: 256,
    supersampling: 2,
  })

  const decoded = getPngDimensions(png)
  expect(decoded.width).toBe(256)
  expect(decoded.height).toBe(256)
}, 60_000)
