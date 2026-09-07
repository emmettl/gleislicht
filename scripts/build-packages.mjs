import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const packageNames = ['core', 'data', 'three', 'web']
export const packageOutput = resolve('.package-dist')

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`)
}

async function copyAssets(source, destination, extensions) {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const input = join(source, entry.name)
    const output = join(destination, entry.name)
    if (entry.isDirectory()) await copyAssets(input, output, extensions)
    else if (!entry.name.includes('.test.') && extensions.some((extension) => entry.name.endsWith(extension))) {
      await mkdir(dirname(output), { recursive: true })
      await cp(input, output)
    }
  }
}

function compiledExport(value) {
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, target]) => [key, compiledExport(target)]))
  const path = value.replace(/^\.\/src\//, './')
  if (/\.tsx?$/.test(path)) {
    return { types: path.replace(/\.tsx?$/, '.d.ts'), import: path.replace(/\.tsx?$/, '.js'), default: path.replace(/\.tsx?$/, '.js') }
  }
  return path
}

export async function buildPackages() {
  await mkdir(packageOutput, { recursive: true })
  for (const name of packageNames) {
    const source = resolve('packages', name)
    const output = join(packageOutput, name)
    await rm(output, { recursive: true, force: true })
    await mkdir(output, { recursive: true })
    const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'))
    if (name !== 'data') {
      const config = join(packageOutput, `${name}.tsconfig.json`)
      await writeFile(config, JSON.stringify({
        extends: join(source, 'tsconfig.json'),
        compilerOptions: {
          noEmit: false,
          declaration: true,
          declarationMap: false,
          rewriteRelativeImportExtensions: true,
          rootDir: join(source, 'src'),
          outDir: output,
          paths: { '@motionstudies/core/*': [join(packageOutput, 'core', '*.d.ts')] },
        },
      }, null, 2))
      run(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', config])
    }
    await copyAssets(join(source, 'src'), output, name === 'data' ? ['.mjs', '.d.mts'] : ['.css'])
    const distribution = {
      name: manifest.name,
      version: manifest.version,
      private: true,
      type: 'module',
      description: manifest.description,
      license: 'UNLICENSED',
      ...(manifest.engines ? { engines: manifest.engines } : {}),
      exports: Object.fromEntries(Object.entries(manifest.exports).map(([key, value]) => [key, compiledExport(value)])),
      files: ['**/*.js', '**/*.mjs', '**/*.d.ts', '**/*.d.mts', '**/*.css', 'README.md'],
      sideEffects: manifest.sideEffects ?? false,
      ...(manifest.dependencies ? { dependencies: manifest.dependencies } : {}),
      ...(manifest.peerDependencies ? { peerDependencies: manifest.peerDependencies } : {}),
    }
    await writeFile(join(output, 'package.json'), `${JSON.stringify(distribution, null, 2)}\n`)
    await cp(resolve('packages/README.md'), join(output, 'README.md'))
    console.log(`Built ${manifest.name}: ${Object.keys(distribution.exports).length} supported subpaths`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildPackages()
