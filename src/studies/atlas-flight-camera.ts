/* oxlint-disable react/immutability -- The renderer owns this mutable Three camera; the flight hook updates it before drawing. */
import { useEffect, useSyncExternalStore } from 'react'
import type { PerspectiveCamera, Vector3 } from 'three'
import { mapCameraFieldOfView } from '@motionstudies/three/map-camera'
import { fromOrbit, orbitalFlight, toOrbit, type MapProjection, type Point3 } from './orbital-flight.ts'

export function useAtlasFlightLoop() {
  return useSyncExternalStore(orbitalFlight.subscribe, orbitalFlight.snapshot) === 'orbital' ? 'never' : 'always'
}

export function useAtlasFlightCamera(camera: PerspectiveCamera, target: Vector3, projection: MapProjection) {
  useEffect(() => {
    let saved: { position: Point3; target: Point3; fov: number; far: number; aspect: number } | undefined
    const destination = () => saved ? {
      position: toOrbit(saved.position, projection), target: toOrbit(saved.target, projection),
      fov: camera.aspect === saved.aspect ? saved.fov : mapCameraFieldOfView(camera.aspect),
    } : undefined
    const handle = {
      capture() {
        saved = { position: camera.position.toArray(), target: target.toArray(), fov: camera.fov, far: camera.far, aspect: camera.aspect }
        return { position: toOrbit(saved.position, projection), target: toOrbit(saved.target, projection), fov: saved.fov }
      },
      destination,
      restore() {
        if (!saved) return
        camera.position.fromArray(saved.position); target.fromArray(saved.target)
        camera.fov = destination()!.fov; camera.far = saved.far; camera.lookAt(target)
        camera.updateProjectionMatrix(); camera.updateMatrixWorld()
      },
    }
    orbitalFlight.atlas.add(handle)
    return () => { orbitalFlight.atlas.delete(handle) }
  }, [camera, target, projection])
  return () => {
    if (orbitalFlight.phase === 'atlas') return false
    const pose = orbitalFlight.pose
    if (pose) {
      camera.position.fromArray(fromOrbit(pose.position, projection))
      camera.lookAt(...fromOrbit(pose.target, projection))
      camera.fov = pose.fov; camera.far = Math.max(400, 400 * projection.scale / 12)
      camera.updateProjectionMatrix(); camera.updateMatrixWorld()
    }
    return true
  }
}
