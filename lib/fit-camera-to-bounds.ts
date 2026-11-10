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

/** Fit transformed glTF world bounds, in mm (+Y up), without changing geometry.
 * Keep the selected camera's direction/FOV. Unlike the Circuit JSON board fit,
 * these bounds include imported meshes, off-board parts and board thickness.
 * Projection matches PoppyGL buildCamera: vertical FOV, Y-up perspective.
 */
export function fitCameraToBounds(
  bounds: { min: readonly number[]; max: readonly number[] },
  camera: CameraOptions,
  aspectRatio: number,
): CameraOptions {
  const { min, max } = bounds
  if (
    min.length !== 3 ||
    max.length !== 3 ||
    ![...min, ...max].every(Number.isFinite) ||
    min.some((v, i) => v > max[i]!)
  )
    return camera

  const lookAt: Vector = [
    (min[0]! + max[0]!) / 2,
    (min[1]! + max[1]!) / 2,
    (min[2]! + max[2]!) / 2,
  ]
  const direction = normalize([
    camera.camPos[0] - camera.lookAt[0],
    camera.camPos[1] - camera.lookAt[1],
    camera.camPos[2] - camera.lookAt[2],
  ])
  const right = normalize(cross([0, 1, 0], direction))
  const up = cross(direction, right)
  const tanY = Math.tan((camera.fov * Math.PI) / 360)
  const tanX = tanY * aspectRatio
  let distance = 1
  let alreadyFits = true

  for (const x of [min[0]!, max[0]!]) {
    for (const y of [min[1]!, max[1]!]) {
      for (const z of [min[2]!, max[2]!]) {
        const fromEye: Vector = [
          x - camera.camPos[0],
          y - camera.camPos[1],
          z - camera.camPos[2],
        ]
        const depth = -dot(fromEye, direction)
        alreadyFits &&=
          depth > 0 &&
          Math.abs(dot(fromEye, right)) <= depth * tanX &&
          Math.abs(dot(fromEye, up)) <= depth * tanY
        const offset: Vector = [x - lookAt[0], y - lookAt[1], z - lookAt[2]]
        // A corner closer to the camera has less perspective depth available.
        distance = Math.max(
          distance,
          dot(offset, direction) + Math.abs(dot(offset, right)) / tanX,
          dot(offset, direction) + Math.abs(dot(offset, up)) / tanY,
        )
      }
    }
  }
  // Preserve existing board framing when it already contains the whole scene.
  if (alreadyFits) return camera
  distance *= 1.05
  return {
    camPos: [
      lookAt[0] + direction[0] * distance,
      lookAt[1] + direction[1] * distance,
      lookAt[2] + direction[2] * distance,
    ],
    lookAt,
    fov: camera.fov,
  }
}
