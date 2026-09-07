import { useEffect, useEffectEvent, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import type { NetworkTrain, StationIndexEntry } from '@motionstudies/core/domain/network'
import { MapTapGesture, pickMapTarget, type MapSelection } from './map-selection.ts'

export interface MapSelectionSceneExtension {
  onSelectTrain?: (train: NetworkTrain) => void
}

export function GleislichtMapSelection({ stations, onSelectStation, onSelectTrain, disabled }: MapSelectionSceneExtension & {
  stations: readonly StationIndexEntry[]
  onSelectStation?: (station: StationIndexEntry) => void
  disabled?: boolean
}) {
  const { scene, camera, gl } = useThree()
  const byStop = useMemo(() => new Map(stations.flatMap(station => station.stopIndexes.map(index => [index, station] as const))), [stations])
  // The app's train handler follows the playback clock. Keep listeners and
  // in-progress gestures intact when that callback changes between frames.
  const select = useEffectEvent((target: MapSelection | undefined) => {
    if (target?.kind === 'station') onSelectStation?.(target.value)
    else if (target?.kind === 'train') onSelectTrain?.(target.value)
  })
  const enabled = !disabled && Boolean(onSelectStation || onSelectTrain)
  useEffect(() => {
    if (!enabled) return
    const canvas = gl.domElement
    const gesture = new MapTapGesture()
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return
      gesture.down(event.pointerId, event.clientX, event.clientY)
      canvas.setPointerCapture(event.pointerId)
    }
    const move = (event: PointerEvent) => gesture.move(event.pointerId, event.clientX, event.clientY)
    const up = (event: PointerEvent) => {
      if (!gesture.up(event.pointerId, event.clientX, event.clientY)) return
      const target = pickMapTarget(scene, camera, canvas.getBoundingClientRect(), event.clientX, event.clientY, event.pointerType === 'touch', byStop)
      select(target)
    }
    const cancel = (event: PointerEvent) => { gesture.up(event.pointerId, event.clientX, event.clientY, true) }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', cancel)
    canvas.addEventListener('lostpointercapture', cancel)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', cancel)
      canvas.removeEventListener('lostpointercapture', cancel)
    }
  }, [byStop, camera, enabled, gl, scene])
  return null
}
