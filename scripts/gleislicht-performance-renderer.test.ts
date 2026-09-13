import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parse } from '@babel/parser'
import { gleislichtPerformanceRenderer } from './gleislicht-performance-renderer.ts'
it('composes the worker adapter with shared CPU performance and rejects changed hooks', () => {
  const id = '/node_modules/@motionstudies/three/NationalNetworkScene.js'
  const transform = gleislichtPerformanceRenderer().transform as (source: string, id: string) => { code: string } | undefined
  const source = readFileSync(`.${id}`, 'utf8')
  const output = transform(source, id)!
  expect(() => parse(output.code, { sourceType: 'module' })).not.toThrow()
  expect(transform(source, `${id}?cached`)).toEqual(output)
  expect(() => transform('export {}', id)).toThrow('needs review')
  expect(transform('export {}', '/src/other.js')).toBeUndefined()
})
