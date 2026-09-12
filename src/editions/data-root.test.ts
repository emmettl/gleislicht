import { expect, it } from 'vitest'
import { resolveDataRoot } from './data-root'
const settings = { local:'./data/', published:'https://data.motionstudies.app/release/', development:false }
it('pins production data and keeps development fixtures local', () => {
  expect(resolveDataRoot(settings)).toBe(settings.published)
  expect(resolveDataRoot({...settings,development:true})).toBe('./data/')
  expect(resolveDataRoot({...settings,override:' https://example.com/test '})).toBe('https://example.com/test/')
})
it('fails closed for missing or unsafe production data roots', () => {
  expect(() => resolveDataRoot({...settings,published:''})).toThrow()
  for(const override of ['http://example.com/', 'https://user:pass@example.com/', 'https://example.com/?secret=a']) expect(() => resolveDataRoot({...settings,override})).toThrow()
})
