import type { DrawCall } from "poppygl"
import type { CameraOptions } from "./camera-presets"

type Vector = readonly [number, number, number]
const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const normalize = (v: Vector): Vector => {
  const length = Math.hypot(...v)
  return [v[0] / length, v[1] / length, v[2] / length]
}
const cross = (a: Vector, b: Vector): Vector => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

/** Fit actual transformed vertices, not the empty corners of a world AABB.
 * Preserve the camera direction/FOV and match PoppyGL's Y-up perspective.
 * Frustum side constraints are linear in camera-space x/y/z, so one pass finds
 * the closest eye and an off-center target with a 5% margin on each side.
 */
export function fitCameraToScene(
  drawCalls: readonly Pick<DrawCall, "positions" | "model">[],
  camera: CameraOptions,
  aspectRatio: number,
): CameraOptions {
  if (
    ![...camera.camPos, ...camera.lookAt, camera.fov, aspectRatio].every(
      Number.isFinite,
    ) ||
    aspectRatio <= 0 ||
    camera.fov <= 0 ||
    camera.fov >= 180
  )
    return camera

  const center = camera.lookAt
  const direction = normalize([
    camera.camPos[0] - center[0],
    camera.camPos[1] - center[1],
    camera.camPos[2] - center[2],
  ])
  const right = normalize(cross([0, 1, 0], direction))
  const up = cross(direction, right)
  if (![...direction, ...right, ...up].every(Number.isFinite)) return camera

  const tanY = Math.tan((camera.fov * Math.PI) / 360)
  const tanX = tanY * aspectRatio
  const tx = tanX * 0.9
  const ty = tanY * 0.9
  const originalDistance = Math.hypot(
    ...camera.camPos.map((v, i) => v - center[i]!),
  )
  let xPlus = -Infinity
  let xMinus = Infinity
  let yPlus = -Infinity
  let yMinus = Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  let alreadyFits = true

  for (const { positions, model: m } of drawCalls) {
    for (let i = 0; i < positions.length; i += 3) {
      const px = positions[i]!
      const py = positions[i + 1]!
      const pz = positions[i + 2]!
      const point: Vector = [
        m[0]! * px + m[4]! * py + m[8]! * pz + m[12]! - center[0],
        m[1]! * px + m[5]! * py + m[9]! * pz + m[13]! - center[1],
        m[2]! * px + m[6]! * py + m[10]! * pz + m[14]! - center[2],
      ]
      const x = dot(point, right)
      const y = dot(point, up)
      const z = dot(point, direction)
      if (![x, y, z].every(Number.isFinite)) return camera
      const depth = originalDistance - z
      alreadyFits &&=
        depth > 0 && Math.abs(x) <= depth * tanX && Math.abs(y) <= depth * tanY
      xPlus = Math.max(xPlus, x + tx * z)
      xMinus = Math.min(xMinus, x - tx * z)
      yPlus = Math.max(yPlus, y + ty * z)
      yMinus = Math.min(yMinus, y - ty * z)
      minZ = Math.min(minZ, z)
      maxZ = Math.max(maxZ, z)
    }
  }
  // Empty scenes and existing sufficient views need no camera change.
  if (alreadyFits) return camera

  const eyeZ = Math.max(
    (xPlus - xMinus) / (2 * tx),
    (yPlus - yMinus) / (2 * ty),
    maxZ + 1,
  )
  const x = (xPlus + xMinus) / 2
  const y = (yPlus + yMinus) / 2
  const targetZ = (minZ + maxZ) / 2
  const atDepth = (z: number): [number, number, number] => [
    center[0] + x * right[0] + y * up[0] + z * direction[0],
    center[1] + x * right[1] + y * up[1] + z * direction[1],
    center[2] + x * right[2] + y * up[2] + z * direction[2],
  ]
  return { camPos: atDepth(eyeZ), lookAt: atDepth(targetZ), fov: camera.fov }
}
