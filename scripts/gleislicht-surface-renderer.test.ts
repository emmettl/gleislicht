import { readFileSync } from 'node:fs'
import { createElement, type ReactElement } from 'react'
import * as THREE from 'three'
import { expect, it } from 'vitest'
import { MAP_SURFACE_Y } from '../src/studies/map-surface.ts'
import { gleislichtSurfaceRenderer } from './gleislicht-surface-renderer.ts'
import { gleislichtSelectionRenderer } from './gleislicht-selection-renderer.ts'
import { SWITZERLAND_MAP_FRAMINGS } from '../src/editions/switzerland.ts'
import { homeMapDistanceScale } from '@motionstudies/three/map-camera'

type Element = ReactElement<{ children?: Element | Element[]; renderOrder?: number; geometry?: THREE.BufferGeometry }>

it('shows Geneva and Basel trams at the home/reset zoom without changing other regional detail thresholds', () => {
  const id = '/node_modules/@motionstudies/three/regional-lod.js'
  const source = readFileSync(`.${id}`, 'utf8')
  const transform = gleislichtSurfaceRenderer().transform as (source: string, id: string) => { code: string }
  const evaluate = (code: string) => new Function('homeMapDistanceScale',
    `${code.slice(code.indexOf('export function')).replaceAll('export ', '')}; return { vehicleIsVisibleAtZoom, localNetworkDetailAtZoom };`)(homeMapDistanceScale)
  const original = evaluate(source), patched = evaluate(transform(source, id).code)
  for (const framing of [SWITZERLAND_MAP_FRAMINGS.geneva, SWITZERLAND_MAP_FRAMINGS.basel]) {
    const homeHeight = 37 * homeMapDistanceScale(framing)
    expect(original.vehicleIsVisibleAtZoom('tram', homeHeight, framing)).toBe(false)
    expect(patched.vehicleIsVisibleAtZoom('tram', homeHeight, framing)).toBe(true)
    expect(patched.vehicleIsVisibleAtZoom('bus', homeHeight, framing)).toBe(false)
    expect(patched.vehicleIsVisibleAtZoom('tram', 37 * framing.localDetailDistanceScale, framing)).toBe(false)
  }
  for (const [id, framing] of Object.entries(SWITZERLAND_MAP_FRAMINGS)) {
    if (id === 'geneva' || id === 'basel') continue
    for (const height of [0.2, 1, 4, 8, 37]) {
      for (const category of ['tram', 'bus', 'intercity']) {
        expect(patched.vehicleIsVisibleAtZoom(category, height, framing)).toBe(original.vehicleIsVisibleAtZoom(category, height, framing))
      }
      expect(patched.localNetworkDetailAtZoom(height, framing)).toBe(original.localNetworkDetailAtZoom(height, framing))
    }
  }
})

it('composites the flat basemap below the network without depth conflicts between its layers', () => {
  const id = '/node_modules/@motionstudies/three/NationalNetworkScene.js'
  const source = readFileSync(`.${id}`, 'utf8')
  const transform = gleislichtSurfaceRenderer().transform as (source: string, id: string) => { code: string }
  const selection = gleislichtSelectionRenderer().transform as typeof transform
  const code = transform(selection(source, id).code, id).code
  // Evaluate the installed renderer's actual basemap components with synchronous
  // hooks, then inspect the objects/materials they supply to R3F.
  const components = code.slice(code.indexOf('function NationalGround('), code.indexOf('function RailGraph('))
  const jsx = (type: string, props: object) => createElement(type, props)
  const { NationalGround, LakeLayer, CountryBorder } = new Function(
    '_jsx', '_jsxs', 'useMemo', 'useEffect', 'THREE', 'MAP_SURFACE_Y', 'projectCoordinate', 'appendLineSegments',
    `${components}; return { NationalGround, LakeLayer, CountryBorder };`,
  )(jsx, jsx, (build: () => unknown) => build(), () => {}, THREE, MAP_SURFACE_Y,
    ([x, z]: number[], _projection: unknown, height = 0) => [x, height, z], (target: number[], points: number[][]) => target.push(...points.flat()))
  const children = (element: Element) => [element.props.children].flat().filter(Boolean) as Element[]
  const ground = children(NationalGround({}))
  const water = children(LakeLayer({ lakes: { lakes: [{ polygons: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]] }] }, subdued: false }))
  const border = children(CountryBorder({ boundary: { rings: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] }, subdued: false })).flatMap(children)
  const layers = [...ground, ...water, ...border]
  expect(layers).toHaveLength(7)
  const orders = layers.map(layer => layer.props.renderOrder ?? 0)
  // Ground, grid, fill, highlight, shoreline, border glow/core must have increasing
  // orders below the default network order, even when their depths quantize.
  expect(orders.every((order, i) => order < 0 && (i === 0 || order > orders[i - 1]))).toBe(true)
  for (const layer of layers) {
    const material = children(layer).find(child => String(child.type).endsWith('Material'))!
    expect(material.props).toMatchObject({ transparent: true, depthWrite: false })
    expect(material.props).not.toMatchObject({ depthTest: false })
  }
  new Set([...water, ...border].map(layer => layer.props.geometry)).forEach(geometry => geometry?.dispose())
})
