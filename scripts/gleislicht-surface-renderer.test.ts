import { expect, it } from 'vitest'
import { gleislichtMapStyle } from '../src/studies/gleislicht-map-style.ts'
import { SWITZERLAND_MAP_FRAMINGS } from '../src/editions/switzerland.ts'
import { homeMapDistanceScale } from '@motionstudies/three/map-camera'

it('keeps compact regional home framing independent of the local-detail threshold', () => {
  for (const framing of [SWITZERLAND_MAP_FRAMINGS.geneva, SWITZERLAND_MAP_FRAMINGS.basel]) {
    expect(homeMapDistanceScale(framing)).toBeLessThan(framing.localDetailDistanceScale!)
  }
})

it('composes the edition palette with supported map-plane and screen-placement policies', () => {
  const style = gleislichtMapStyle({ surface: 'flat', trainLabels: { anchorY: -0.3 } })
  expect(style.surface).toBe('flat')
  expect(style.coplanar).toBe(true)
  expect(style.selectionMarkers).toEqual({ stationMaxRadiusPixels: 10, trainMaxRadiusPixels: 3.5 })
  expect(style.trainLabels?.anchorY).toBe(-0.3)
  const offset = style.trainLabels!.screenOffset!
  expect(offset(20, -1)).toBe(14)
  expect(offset(20, 0)).toBe(14)
  expect(offset(20, 1)).toBe(38)
  expect(style.trailElevationOffset).toBe(0)
})
