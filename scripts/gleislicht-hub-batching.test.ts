import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import * as THREE from 'three'
import { SERVICE_COLORS } from '@motionstudies/core/theme'
import { batchHubLines } from '../src/studies/batch-hub-lines.ts'
import { gleislichtPerformanceRenderer } from './gleislicht-performance-renderer.ts'

it('batches installed hub geometry without changing segments, colours or category emphasis', () => {
  const id = '/node_modules/@motionstudies/three/HubPulseScene.js'
  const source = readFileSync(`.${id}`, 'utf8')
  const transform = gleislichtPerformanceRenderer().transform as (source: string, id: string) => { code: string }
  const calls = Array.from({ length: 80 }, (_, index) => ({
    hubStop: [8.5, 47.3], previousStop: [8 + index * 0.01, 47.5], nextStop: [8.3, 47 + index * 0.02],
    train: { category: ['intercity', 'regional', 's-bahn'][index % 3] },
  }))
  const evaluate = (code: string, selectedCategory?: string) => {
    const clean = code.replace(/^import .*;$/gm, '').replaceAll('export ', '')
    return new Function('THREE', 'SERVICE_COLORS', 'batchHubLines', 'useMemo', 'useEffect', '_jsx', 'calls', 'selectedCategory',
      `${clean}; return { ticks: TickMarks().object.children, spokes: CorridorSpokes({ calls, selectedCategory }).map(entry => entry.object) };`
    )(THREE, SERVICE_COLORS, batchHubLines, (factory: () => unknown) => factory(), () => {}, (_type: unknown, props: unknown) => props, calls, selectedCategory)
  }
  const segments = (lines: THREE.Line[]) => lines.flatMap(line => {
    const material = line.material as THREE.LineBasicMaterial
    const { uuid: _uuid, metadata: _metadata, ...properties } = material.toJSON()
    const position = line.geometry.getAttribute('position')
    return Array.from({ length: position.count / 2 }, (_, index) => JSON.stringify({
      properties, color: material.color.toArray(),
      points: [index * 2, index * 2 + 1].map(i => [position.getX(i), position.getY(i), position.getZ(i)]),
    }))
  }).sort()
  for (const selectedCategory of [undefined, 'intercity', 'bus']) {
    const original = evaluate(source, selectedCategory)
    const optimized = evaluate(transform(source, id).code, selectedCategory)
    expect(original.ticks).toHaveLength(60)
    expect(optimized.ticks).toHaveLength(3)
    expect(optimized.spokes.length).toBeLessThan(original.spokes.length)
    expect(segments(optimized.ticks)).toEqual(segments(original.ticks))
    expect(segments(optimized.spokes)).toEqual(segments(original.spokes))
    for (const lines of [original.ticks, optimized.ticks, original.spokes, optimized.spokes]) {
      for (const line of lines) { line.geometry.dispose(); line.material.dispose() }
    }
  }
})
