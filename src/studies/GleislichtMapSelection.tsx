import { useEffect, useEffectEvent, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import type { NetworkTrain, StationIndexEntry } from '@motionstudies/core/domain/network'
import type { StudyAirport } from '@motionstudies/core/domain/airport'
import { MapTapGesture, pickMapTarget, pickAirportTarget, type MapSelection } from './map-selection.ts'

export interface MapSelectionSceneExtension {
  onSelectRoad?: (road: string) => void
  onSelectTrain?: (train: NetworkTrain) => void
  onSelectAirport?: (airport: StudyAirport) => void
}

export function GleislichtMapSelection({ stations, onSelectStation, onSelectTrain, onSelectRoad, onSelectAirport, roadsOnly, disabled }: MapSelectionSceneExtension & {
  stations: readonly StationIndexEntry[]
  onSelectStation?: (station: StationIndexEntry) => void
  roadsOnly?: boolean
  disabled?: boolean
}) {
  const { scene, camera, gl } = useThree()
  const airportEnabled = Boolean(onSelectAirport)
  const byStop = useMemo(() => new Map(stations.flatMap(station => station.stopIndexes.map(index => [index, station] as const))), [stations])
  // The app's train handler follows the playback clock. Keep listeners and
  // in-progress gestures intact when that callback changes between frames.
  const select = useEffectEvent((target: MapSelection | undefined) => {
    if (target?.kind === 'road') onSelectRoad?.(target.value)
    else if (target?.kind === 'station') onSelectStation?.(target.value)
    else if (target?.kind === 'train') onSelectTrain?.(target.value)
    else if (target?.kind === 'airport') onSelectAirport?.(target.value)
  })
  const enabled = !disabled && Boolean(onSelectStation || onSelectTrain || onSelectRoad)
  useEffect(() => {
    if (!enabled && !airportEnabled) return
    const canvas = gl.domElement
    const previousCursor = canvas.style.cursor
    const gesture = new MapTapGesture()
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return
      gesture.down(event.pointerId, event.clientX, event.clientY)
      canvas.setPointerCapture(event.pointerId)
    }
    const airportAt = (event: PointerEvent) => airportEnabled ? pickAirportTarget(scene, camera, canvas.getBoundingClientRect(), event.clientX, event.clientY, event.pointerType === 'touch') : undefined
    const move = (event: PointerEvent) => {
      gesture.move(event.pointerId, event.clientX, event.clientY)
      canvas.style.cursor = airportAt(event) ? 'pointer' : previousCursor
    }
    const leave = () => { canvas.style.cursor = previousCursor }
    const up = (event: PointerEvent) => {
      if (!gesture.up(event.pointerId, event.clientX, event.clientY)) return
      const airport = airportAt(event)
      const target: MapSelection | undefined = airport ? { kind: 'airport', value: airport }
        : enabled ? pickMapTarget(scene, camera, canvas.getBoundingClientRect(), event.clientX, event.clientY, event.pointerType === 'touch', byStop, roadsOnly) : undefined
      select(target)
    }
    const cancel = (event: PointerEvent) => { gesture.up(event.pointerId, event.clientX, event.clientY, true) }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerleave', leave)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', cancel)
    canvas.addEventListener('lostpointercapture', cancel)
    return () => {
      canvas.style.cursor = previousCursor
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerleave', leave)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', cancel)
      canvas.removeEventListener('lostpointercapture', cancel)
    }
  }, [byStop, camera, enabled, gl, scene, roadsOnly, airportEnabled])
  return null
}
