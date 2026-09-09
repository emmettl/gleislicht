import { vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { MapCameraFraming } from '@motionstudies/three/map-camera'
import type { NetworkSnapshot } from '@motionstudies/core/domain/network'
import { App } from '../App.tsx'
import { SWITZERLAND_EDITION } from '../editions/switzerland.ts'

// Keep the real application, lazy UI, loading hooks and data transformations.
// Only the GPU scenes are replaced. These tests deliberately make no rendering claims.
vi.mock('@motionstudies/three/NationalNetworkScene', () => ({ NationalNetworkScene: ({ snapshot, referenceSnapshot, cameraFraming }: { snapshot: NetworkSnapshot; referenceSnapshot: NetworkSnapshot; cameraFraming?: MapCameraFraming }) => <div data-testid="map-scene" data-camera-scale={cameraFraming?.homeDistanceScale} data-bounds={JSON.stringify(snapshot.bounds)} data-reference-bounds={JSON.stringify(referenceSnapshot.bounds)} data-realtime-count={snapshot.trains.filter(train => train.realtime).length} data-train-count={snapshot.trains.length} data-train-ids={snapshot.trains.map(train => train.id).join(',')} /> }))
vi.mock('@motionstudies/three/HubPulseScene', () => ({ HubPulseScene: () => <div /> }))
vi.mock('@motionstudies/three/StationFlowScene', () => ({ StationFlowScene: () => <div /> }))
vi.mock('../studies/GleislichtJourneyScene.tsx', () => ({ GleislichtScene: () => <div /> }))
vi.mock('../studies/MeasuredTerrainScene.tsx', () => ({ default: () => <div data-testid="measured-scene" /> }))
vi.mock('../studies/RigiTimetableTerrain.tsx', () => ({ default: () => <div /> }))
vi.mock('../studies/AlpineQuiet.tsx', () => ({ AlpineQuiet: () => <div /> }))

export function mountApp(query = '') {
  window.history.replaceState(null, '', `/${query}`)
  return render(<App edition={SWITZERLAND_EDITION} />)
}
export const element = <T extends Element = HTMLElement,>(selector: string) => {
  const value = document.querySelector<T>(selector)
  if (!value) throw new Error(`Missing ${selector}`)
  return value
}
export const clock = () => element<HTMLInputElement>('.scrubber input')
export function seek(time: number) { fireEvent.change(clock(), { target: { value: String(time) } }) }
export async function search(value: string, selector: string) {
  fireEvent.change(element('.train-search input'), { target: { value } })
  await waitFor(() => { if (!document.querySelector(selector)) throw new Error(`No result for ${value}`) })
  fireEvent.click(element(selector))
}
export async function share() {
  fireEvent.click(screen.getByRole('button', { name: 'Share study' }))
  return (await screen.findByRole('textbox', { name: 'Copy this link' }) as HTMLInputElement).value
}
