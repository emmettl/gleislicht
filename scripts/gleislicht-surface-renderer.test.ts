import { readFileSync } from 'node:fs'
import { createElement, type ReactElement } from 'react'
import * as THREE from 'three'
import { expect, it } from 'vitest'
import { MAP_SURFACE_Y } from '../src/studies/map-surface.ts'
import { gleislichtSurfaceRenderer } from './gleislicht-surface-renderer.ts'
import { gleislichtSelectionRenderer } from './gleislicht-selection-renderer.ts'

type Element = ReactElement<{ children?: Element | Element[]; renderOrder?: number; geometry?: THREE.BufferGeometry }>

it('composites the flat basemap below the network without depth conflicts between its layers', () => {
  const id = '/node_modules/@motionstudies/three/NationalNetworkScene.js'
  const source = readFileSync(`.${id}`, 'utf8')
  const transform = gleislichtSurfaceRenderer().transform as (source: string, id: string) => { code: string }
  const selection = gleislichtSelectionRenderer().transform as typeof transform
  const code = transform(selection(source, id).code, id).code
  // Evaluate the installed renderer's actual basemap components with synchronous
  // hooks, then inspect the objects/materials they supply to R3F.
  const components = code.slice(code.indexOf('function NationalGround('), code.indexOf('function DiagramWaterLayer('))
  const jsx = (type: string, props: object) => createElement(type, props)
  const { NationalGround, LakeLayer } = new Function(
    '_jsx', '_jsxs', 'useMemo', 'useEffect', 'THREE', 'MAP_SURFACE_Y', 'projectCoordinate', 'appendLineSegments',
    `${components}; return { NationalGround, LakeLayer };`,
  )(jsx, jsx, (build: () => unknown) => build(), () => {}, THREE, MAP_SURFACE_Y,
    ([x, z]: number[]) => [x, 0, z], (target: number[], points: number[][]) => target.push(...points.flat()))
  const children = (element: Element) => [element.props.children].flat().filter(Boolean) as Element[]
  const ground = children(NationalGround({}))
  const water = children(LakeLayer({ lakes: { lakes: [{ polygons: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]] }] }, subdued: false }))
  const layers = [...ground, ...water]
  expect(layers).toHaveLength(5)
  const orders = layers.map(layer => layer.props.renderOrder ?? 0)
  // Ground, grid, fill, highlight, shoreline must have distinct increasing
  // orders below the default network order, even when their depths quantize.
  expect(orders.every((order, i) => order < 0 && (i === 0 || order > orders[i - 1]))).toBe(true)
  for (const layer of layers) {
    const material = children(layer).find(child => String(child.type).endsWith('Material'))!
    expect(material.props).toMatchObject({ transparent: true, depthWrite: false })
    expect(material.props).not.toMatchObject({ depthTest: false })
  }
  new Set(water.map(layer => layer.props.geometry)).forEach(geometry => geometry?.dispose())
})
