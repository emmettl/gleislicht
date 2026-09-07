import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkEditionBoundaries, moduleReferences } from './check-edition-boundaries.mjs'

const directories = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'motion-boundaries-'))
  directories.push(root)
  async function file(path, contents) {
    await mkdir(join(root, path, '..'), { recursive: true })
    await writeFile(join(root, path), contents)
  }
  for (const name of ['core', 'web', 'three', 'data']) {
    await file(`packages/${name}/package.json`, JSON.stringify({
      name: `@motionstudies/${name}`,
      exports: { './index': './src/index.ts' },
      dependencies: name === 'core' ? {} : { '@motionstudies/core': '0.0.0' },
    }))
    await file(`packages/${name}/src/index.ts`, 'export const value = 1')
  }
  for (const name of ['main', 'london-main', 'new-york-main', 'paris-main']) {
    await file(`src/${name}.tsx`, 'export {}')
  }
  return { root, file }
}

describe('package and edition boundaries', () => {
  it('reads side effects, multiline re-exports, dynamic and type imports without mistaking comments for imports', () => {
    expect(moduleReferences(`
      // import bad from './not-an-import.ts'
      import './control.css'
      export { something\n } from './helper.ts'
      type Model = import('@motionstudies/core/domain/network').NetworkSnapshot
      const scene = import('./Scene.tsx')
    `, 'example.ts')).toEqual(['./control.css', './helper.ts', '@motionstudies/core/domain/network', './Scene.tsx'])
  })
  it('accepts the one-way dependency graph', async () => {
    const { root, file } = await fixture()
    await file('packages/web/src/index.ts', "export { value } from '@motionstudies/core/index'")
    expect(await checkEditionBoundaries(root)).toEqual([])
  })
  it('rejects arbitrary relative escapes and undeclared dependencies', async () => {
    const { root, file } = await fixture()
    await file('packages/core/src/index.ts', "export * from '../../../src/helper.ts'\nimport 'react'")
    expect(await checkEditionBoundaries(root)).toEqual(expect.arrayContaining([
      expect.stringContaining('reaches outside its package'), expect.stringContaining('undeclared dependency react'),
    ]))
  })
  it('rejects reverse dependencies even when declared', async () => {
    const { root, file } = await fixture()
    await file('packages/core/package.json', JSON.stringify({ dependencies: { '@motionstudies/web': '0.0.0' } }))
    await file('packages/core/src/index.ts', "export * from '@motionstudies/web/index'")
    expect(await checkEditionBoundaries(root)).toEqual(expect.arrayContaining([
      expect.stringContaining('declares forbidden shared dependency'), expect.stringContaining('violates the shared dependency direction'),
    ]))
  })
  it('rejects app build globals and unverifiable dynamic imports', async () => {
    const { root, file } = await fixture()
    await file('packages/web/src/index.ts', "const url = import.meta.env.BASE_URL; import(url)")
    expect(await checkEditionBoundaries(root)).toEqual(expect.arrayContaining([
      expect.stringContaining("consumer's build environment"), expect.stringContaining('non-literal module import'),
    ]))
  })
  it('follows edition imports through intermediate helpers', async () => {
    const { root, file } = await fixture()
    await file('src/paris-main.tsx', "import './bridge.ts'")
    await file('src/bridge.ts', "export * from './editions/london.ts'")
    await file('src/editions/london.ts', 'export const edition = {}')
    expect(await checkEditionBoundaries(root)).toEqual([
      expect.stringContaining('paris-main.tsx transitively imports the london edition'),
    ])
  })
})
