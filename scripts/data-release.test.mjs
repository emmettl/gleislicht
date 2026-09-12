import { describe, it, expect, vi } from 'vitest'
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepareRelease, digest, validateInventory } from './data-release.mjs'
import { createR2Uploader, publishRelease } from './publish-data-release.mjs'
const host = { origin: 'https://data.motionstudies.app', prefix: 'gleislicht/releases', accountId: 'test', bucket: 'test' }
async function fixture(task) {
  const root = await mkdtemp(join(tmpdir(), 'data-release-test-'))
  try { await writeFile(join(root, 'chunk.json'), '{"trains":[]}'); await task(root) }
  finally { await rm(root, { recursive: true, force: true }); vi.unstubAllGlobals() }
}
describe('immutable data releases', () => {
  it('is deterministic and changes its URL when data changes', () => fixture(async root => {
    const a = await prepareRelease(root, host)
    expect(await prepareRelease(root, host)).toEqual(a)
    await writeFile(join(root, 'chunk.json'), '{"trains":[1]}')
    expect((await prepareRelease(root, host)).baseUrl).not.toBe(a.baseUrl)
  }))
  it('rejects missing or corrupt chunk references', () => fixture(async root => {
    await writeFile(join(root, 'manifest.json'), JSON.stringify({ chunks: [{path:'missing.json'}] }))
    await expect(prepareRelease(root, host)).rejects.toThrow('Missing chunk')
    await writeFile(join(root, 'manifest.json'), JSON.stringify({ chunks: [{path:'chunk.json',sha256:digest('wrong')}] }))
    await expect(prepareRelease(root, host)).rejects.toThrow('checksum mismatch')
  }))
  it('rejects symlinks and unsafe inventory paths', () => fixture(async root => {
    await symlink(join(root, 'chunk.json'), join(root, 'link.json'))
    await expect(prepareRelease(root, host)).rejects.toThrow('links')
    for (const path of ['../secret','/secret','a/../secret','a//b','_release.json']) expect(() => validateInventory([{path,bytes:0,sha256:digest('')}])).toThrow()
  }))
  it('never completes a release when public bytes or CORS are wrong', () => fixture(async root => {
    const release = await prepareRelease(root, host), puts = []
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).endsWith('_release.json')) return new Response('', { status: 404 })
      return new Response('corrupt', {headers:{'Access-Control-Allow-Origin':'*'}})
    }))
    await expect(publishRelease(root, release, host, undefined, { putObject: async input => { puts.push(input.Key) } })).rejects.toThrow('Published bytes differ')
    expect(puts).toHaveLength(1)
    expect(puts.some(url => url.endsWith('_release.json'))).toBe(false)
  }))
  it('refuses changed source bytes before uploading', () => fixture(async root => {
    const release = await prepareRelease(root, host)
    await writeFile(join(root, 'chunk.json'), 'changed')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', {status:404})))
    const putObject = vi.fn()
    await expect(publishRelease(root, release, host, undefined, { putObject })).rejects.toThrow('Source changed')
    expect(putObject).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledTimes(1)
  }))
  it('requires both S3 credentials rather than a broad REST API token', () => {
    expect(() => createR2Uploader(host, {accessKeyId:'test'})).toThrow('CLOUDFLARE_R2_SECRET_ACCESS_KEY')
    expect(() => createR2Uploader(host, {secretAccessKey:'test'})).toThrow('CLOUDFLARE_R2_ACCESS_KEY_ID')
  })
  it('uploads through S3 and completes the release only after public verification', () => fixture(async root => {
    const release = await prepareRelease(root, host), objects = new Map(), events = []
    const putObject = vi.fn(async input => {
      expect(input.Bucket).toBe(host.bucket)
      expect(input.CacheControl).toBe('public, max-age=31536000, immutable')
      expect(input.ContentType).toBe('application/json')
      objects.set(input.Key, input.Body)
      events.push(`put:${input.Key.split('/').at(-1)}`)
    })
    vi.stubGlobal('fetch', vi.fn(async url => {
      expect(String(url).startsWith(release.baseUrl)).toBe(true)
      const path = String(url).slice(release.baseUrl.length)
      events.push(`get:${path}`)
      const body = objects.get(`${host.prefix}/${release.id}/${path}`)
      return body === undefined ? new Response('', {status:404}) : new Response(body, {headers:{'Access-Control-Allow-Origin':'*'}})
    }))
    await expect(publishRelease(root, release, host, undefined, {putObject})).resolves.toMatchObject({id:release.id})
    expect(events).toEqual(['get:_release.json','put:chunk.json','get:chunk.json','put:_release.json','get:_release.json'])
    // A completed release remains verifiable without access to any credentials.
    putObject.mockClear()
    await publishRelease(root, release, host, undefined, {verifyOnly:true})
    expect(putObject).not.toHaveBeenCalled()
  }))
})
