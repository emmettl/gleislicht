import { expect, it } from 'vitest'
import { publishedDataRoot } from './published-data-root.mjs'
const id = 'a'.repeat(64)
const baseUrl = `https://data.motionstudies.app/gleislicht/releases/${id}/`
it('recovers only the pinned, trusted immutable root', async () => {
  expect(await publishedDataRoot(async () => Response.json({schemaVersion:1,id,baseUrl}))).toBe(baseUrl)
  await expect(publishedDataRoot(async () => Response.json({schemaVersion:1,id,baseUrl:'https://example.com/'}))).rejects.toThrow('Invalid published')
})
it('uses legacy data only for a missing pointer, never for a damaged release', async () => {
  expect(await publishedDataRoot(async () => new Response('',{status:404}))).toBe('https://emmettl.github.io/gleislicht/data/')
  await expect(publishedDataRoot(async () => new Response('',{status:503}))).rejects.toThrow('503')
  await expect(publishedDataRoot(async () => new Response('invalid'))).rejects.toThrow()
})
