import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { gleislichtPerformanceRenderer } from './gleislicht-performance-renderer.ts'

it('preserves numeric callsign ordering and priority using the installed renderer', () => {
  const id = '/node_modules/@motionstudies/three/air-labels.js'
  const source = readFileSync(`.${id}`, 'utf8')
  const transform = gleislichtPerformanceRenderer().transform as (source: string, id: string) => { code: string }
  const patched = transform(source, id).code
  const compare = (code: string) => new Function(`${code.replaceAll('export ', '')}; return compareAirLabelCandidates;`)()
  const original = compare(source)
  const optimized = compare(patched)
  const candidates = [
    { id: 'abc', callsign: 'ABC', retained: false },
    { id: 'def', callsign: 'SWR10', retained: false },
    { id: 'ghi', callsign: 'SWR2', retained: false },
    { id: 'jkl', callsign: 'SWR2', retained: true },
    { id: 'id10', callsign: 'SWR2', retained: false },
    { id: 'id2', callsign: 'SWR2', retained: false },
  ]
  expect([...candidates].sort(optimized)).toEqual([...candidates].sort(original))
  for (const first of candidates) for (const second of candidates) {
    expect(Math.sign(optimized(first, second))).toBe(Math.sign(original(first, second)))
  }
})

it('preserves train priority, numeric IDs and accent-sensitive route identities', () => {
  const id = '/node_modules/@motionstudies/three/train-labels.js'
  const source = readFileSync(`.${id}`, 'utf8')
  const transform = gleislichtPerformanceRenderer().transform as (source: string, id: string) => { code: string }
  const evaluate = (code: string) => new Function(`${code.replaceAll('export ', '')}; return { compareTrainLabelCandidates, trainLabelIdentity };`)()
  const original = evaluate(source)
  const optimized = evaluate(transform(source, id).code)
  const candidates = ['intercity', 'tram', 'bus'].flatMap(category => [false, true].flatMap(retained =>
    ['train2', 'train10', 'Zürich', 'Zurich'].map(id => ({ category, retained, id }))))
  expect([...candidates].sort(optimized.compareTrainLabelCandidates)).toEqual([...candidates].sort(original.compareTrainLabelCandidates))
  for (const route of ['', 'IC2', 's12', 'Zürich', ' Zurich ']) {
    for (const shortName of ['', 'ic2', 'S12', 'Zürich', 'Zurich']) {
      expect(optimized.trainLabelIdentity(route, shortName)).toBe(original.trainLabelIdentity(route, shortName))
    }
  }
})
