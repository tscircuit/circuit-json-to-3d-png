/** Decode the exporter-owned GLB once using the renderer's native scene loader.
 * The object URL is local in both browsers and Node/Bun; no network upload.
 */
export async function loadGlbScene(glb: ArrayBuffer) {
  const { loadGLTFWithResourcesFromURL, createSceneFromGLTF } = await import(
    "poppygl"
  )
  const url = URL.createObjectURL(
    new Blob([glb], { type: "model/gltf-binary" }),
  )
  try {
    const { gltf, resources } = await loadGLTFWithResourcesFromURL(url)
    return createSceneFromGLTF(gltf, resources)
  } finally {
    URL.revokeObjectURL(url)
  }
}
