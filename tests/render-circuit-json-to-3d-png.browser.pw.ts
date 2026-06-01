import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import type { AnyCircuitElement } from "circuit-json"
import { execFile as execFileCallback } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { convertCircuitJsonTo3dGlb } from "lib/index"

type BrowserRenderResult = {
  byteLength: number
  signature: number[]
  isUint8Array: boolean
}

const execFile = promisify(execFileCallback)
const testDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(testDir, "..")
const basicBoardFixturePath = path.resolve(
  testDir,
  "fixtures/basic-board.fixture.json",
)
const browserEntryPath = path.resolve(
  testDir,
  "browser/render-circuit-json-to-3d-png.browser-entry.ts",
)
const basicBoardFixture = JSON.parse(
  await readFile(basicBoardFixturePath, "utf8"),
) as AnyCircuitElement[]

async function buildBrowserBundle(bundlePath: string) {
  try {
    await execFile(
      "bun",
      [
        "build",
        browserEntryPath,
        "--target",
        "browser",
        "--format",
        "esm",
        "--outfile",
        bundlePath,
      ],
      {
        cwd: repoRoot,
        maxBuffer: 10 * 1024 * 1024,
      },
    )
  } catch (error) {
    throw new Error(
      `Browser bundle build failed:\n${
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      }`,
    )
  }
}

async function startTestServer(options: {
  bundleBytes: Buffer
  glbBytes: Buffer
}) {
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1")

    if (requestUrl.pathname === "/fixture.glb") {
      response.writeHead(200, {
        "Content-Type": "model/gltf-binary",
        "Content-Length": options.glbBytes.byteLength,
      })
      response.end(options.glbBytes)
      return
    }

    if (requestUrl.pathname === "/browser-entry.js") {
      response.writeHead(200, {
        "Content-Type": "text/javascript; charset=utf-8",
        "Content-Length": options.bundleBytes.byteLength,
      })
      response.end(options.bundleBytes)
      return
    }

    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
    })
    response.end(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>circuit-json-to-3d-png browser test</title>
        </head>
        <body>
          <script type="module" src="/browser-entry.js"></script>
        </body>
      </html>`)
  })

  const port = await new Promise<number>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("Test server did not report a usable port."))
        return
      }
      resolve(address.port)
    })
  })

  return {
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      }),
  }
}

test("renderGLTFToPNGFromURL works in a browser bundle", async ({
  page,
}: {
  page: Page
}) => {
  test.setTimeout(120_000)

  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), "circuit-json-to-3d-png-browser-"),
  )

  const glb = await convertCircuitJsonTo3dGlb(basicBoardFixture)
  const glbPath = path.join(tempDir, "fixture.glb")
  const bundlePath = path.join(tempDir, "browser-entry.js")

  try {
    await writeFile(glbPath, glb)
    await buildBrowserBundle(bundlePath)

    const [bundleBytes, glbBytes] = await Promise.all([
      readFile(bundlePath),
      readFile(glbPath),
    ])
    const server = await startTestServer({ bundleBytes, glbBytes })
    const baseUrl = `http://127.0.0.1:${server.port}`

    try {
      const pageErrors: Error[] = []
      const consoleMessages: string[] = []
      page.on("pageerror", (error: unknown) => {
        pageErrors.push(
          error instanceof Error ? error : new Error(String(error)),
        )
      })
      page.on("console", (message: { type(): string; text(): string }) => {
        consoleMessages.push(`[${message.type()}] ${message.text()}`)
      })

      await page.goto(baseUrl)

      await page.waitForFunction(
        () =>
          Boolean(
            (
              globalThis as typeof globalThis & {
                __browserRenderStarted?: boolean
              }
            ).__browserRenderStarted,
          ),
        undefined,
        {
          timeout: 60_000,
        },
      )

      try {
        await page.waitForFunction(
          () =>
            Boolean(
              (
                globalThis as typeof globalThis & {
                  __browserRenderResult?: BrowserRenderResult
                }
              ).__browserRenderResult,
            ),
          undefined,
          {
            timeout: 60_000,
          },
        )
      } catch (error) {
        throw new Error(
          [
            `Timed out waiting for browser render result.`,
            `Console output:`,
            ...consoleMessages,
            `Page errors:`,
            ...pageErrors.map(
              (pageError) => pageError.stack ?? pageError.message,
            ),
            error instanceof Error ? error.message : String(error),
          ].join("\n"),
        )
      }

      const result = await page.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              __browserRenderResult?: BrowserRenderResult
            }
          ).__browserRenderResult,
      )

      expect(pageErrors).toEqual([])
      expect(result).toBeDefined()
      expect(result?.isUint8Array).toBe(true)
      expect(result?.byteLength).toBeGreaterThan(0)
      expect(result?.signature).toEqual([0x89, 0x50, 0x4e, 0x47])
    } finally {
      await server.close()
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
