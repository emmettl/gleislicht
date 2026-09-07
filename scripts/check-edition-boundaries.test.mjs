import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { moduleReferences } from './module-references.mjs'

const roots = []
const checker = resolve('scripts/check-edition-boundaries.mjs')
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))) })

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'edition-boundary-'))
  roots.push(root)
  const put = async (name, value) => {
    const file = join(root, name)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, typeof value === 'string' ? value : JSON.stringify(value))
  }
  const manifest = { dependencies: {} }
  const lock = { packages: {} }
  for (const name of ['core', 'data', 'three', 'web']) {
    const full = `@motionstudies/${name}`
    manifest.dependencies[full] = '0.1.0-alpha.1'
    lock.packages[`node_modules/${full}`] = { version: '0.1.0-alpha.1', resolved: `https://registry.npmjs.org/${full}/-/package.tgz`, integrity: 'sha512-fixture' }
    await put(`node_modules/${full}/package.json`, { version: '0.1.0-alpha.1', private: false, exports: { './public': './public.js' } })
  }
  await put('package.json', manifest)
  await put('package-lock.json', lock)
  for (const name of ['src', 'scripts', 'realtime-worker', 'astra-worker']) await mkdir(join(root, name), { recursive: true })
  const run = () => spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' })
  return { root, put, manifest, lock, run }
}

describe('installed edition boundary', () => {
  it('accepts public registry imports but rejects a private subpath', async () => {
    const { put, run } = await fixture()
    await put('src/main.ts', "import '@motionstudies/web/public'")
    expect(run().status).toBe(0)
    await put('src/main.ts', "import '@motionstudies/web/internal'")
    expect(run().stderr).toContain('Private package import')
  })

  it('rejects vendored replacements disguised as pinned registry dependencies', async () => {
    const { put, lock, run } = await fixture()
    lock.packages['node_modules/@motionstudies/core'].resolved = 'file:../shared/core.tgz'
    await put('package-lock.json', lock)
    expect(run().stderr).toContain('Registry lock mismatch')
  })

  it('rejects workspace source links and relative repository escapes', async () => {
    const { root, put, run } = await fixture()
    await put('src/main.ts', "export * from '../../another-edition/app.ts'")
    expect(run().stderr).toContain('imports outside this repository')
    await put('src/main.ts', '')
    await mkdir(join(root, 'shared'))
    await rm(join(root, 'node_modules/@motionstudies/core'), { recursive: true })
    await symlink(join(root, 'shared'), join(root, 'node_modules/@motionstudies/core'))
    expect(run().stderr).toContain('Shared source link')
  })

  it('parses ambient Node declarations and detects hidden dynamic imports', () => {
    expect(moduleReferences("export const config: import('@motionstudies/core/public').Config", 'config.d.mts')).toEqual(['@motionstudies/core/public'])
    expect(moduleReferences('const load = () => import(target)', 'app.ts')).toEqual([undefined])
  })
})
