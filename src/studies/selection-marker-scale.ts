import * as THREE from 'three'

const cameraSpace = new THREE.Vector3()

/** Cap map-space geometry at a CSS-pixel radius without enlarging it at overview zoom. */
export function selectionMarkerScale(camera: THREE.Camera, position: THREE.Vector3,
  viewportHeight: number, worldRadius: number, pixelRadius: number): number {
  if (viewportHeight <= 0) return 0
  // Camera-space depth keeps the cap consistent for markers away from the centre.
  cameraSpace.copy(position).applyMatrix4(camera.matrixWorldInverse)
  const depth = camera instanceof THREE.PerspectiveCamera ? Math.max(0, -cameraSpace.z) : 1
  const worldUnitsPerPixel = 2 * depth / (camera.projectionMatrix.elements[5] * viewportHeight)
  return Math.min(1, pixelRadius * worldUnitsPerPixel / worldRadius)
}
