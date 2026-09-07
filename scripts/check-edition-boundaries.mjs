import { access, readdir, readFile } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from '@babel/parser'

const packageGraph = {
  '@motionstudies/core': [],
  '@motionstudies/three': ['@motionstudies/core'],
  '@motionstudies/web': ['@motionstudies/core'],
  '@motionstudies/data': ['@motionstudies/core'],
}
const legacyDirectories = ['domain', 'scene', 'theme', 'components', 'entries']
const placeIdentity = /\b(?:Switzerland|Swiss|Zürich|Zurich|Genève|Geneva|London|TfL|GLA|New York|MTA|Paris|IDFM|gleislicht)\b|all-change|local-express|correspondances/i

function within(directory, path) {
  const child = relative(directory, path)
  return child === '' || (!child.startsWith(`..${sep}`) && child !== '..' && !child.startsWith(sep))
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : [path]
  }))).flat().filter((file) => /\.(?:[cm]?[jt]sx?|css)$/.test(file))
}

/** Parse imports, re-exports, import types, side effects and dynamic imports. */
export function moduleReferences(source, fileName) {
  if (extname(fileName) === '.css') {
    return [...source.matchAll(/@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g)].map((match) => match[1])
  }
  const references = []
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    createImportExpressions: true,
  })
  function add(node) {
    references.push(node?.type === 'StringLiteral' ? node.value : undefined)
  }
  function visit(node) {
    if (!node || typeof node !== 'object') return
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) add(node.source)
    else if (node.type === 'ImportExpression') add(node.source)
    else if (node.type === 'TSImportType') add(node.argument)
    else if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require') add(node.arguments[0])
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit)
      else if (value && typeof value === 'object') visit(value)
    }
  }
  visit(ast)
  return references
}

function packageName(specifier) {
  return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]
}

function editionOwner(file, root) {
  const name = relative(join(root, 'src'), file).replaceAll(sep, '/')
  if (name === 'styles.css') return 'switzerland'
  if (/^(?:main\.tsx|App\.tsx|i18n(?:\.test)?\.ts|audio\/|studies\/Gleislicht|editions\/switzerland)/.test(name)) return 'switzerland'
  for (const [id, shell] of [['london', 'London'], ['new-york', 'NewYork'], ['paris', 'Paris']]) {
    if (name === `styles/${id}.css` || name.startsWith(`${id}-main.`) || name.startsWith(`editions/${id}`) || name.startsWith(`studies/${shell}`)) return id
  }
}

export async function checkEditionBoundaries(root = resolve('.')) {
  const failures = []
  for (const [name, allowedShared] of Object.entries(packageGraph)) {
    const directory = join(root, 'packages', name.split('/')[1])
    const metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
    if (!metadata.exports || Object.keys(metadata.exports).some((entry) => entry.includes('*'))) {
      failures.push(`${name} must declare explicit public exports`)
    }
    const declared = new Set(Object.keys({ ...metadata.dependencies, ...metadata.peerDependencies }))
    for (const dependency of declared) {
      if (dependency.startsWith('@motionstudies/') && !allowedShared.includes(dependency)) {
        failures.push(`${name} declares forbidden shared dependency ${dependency}`)
      }
    }
    for (const file of await sourceFiles(join(directory, 'src'))) {
      const label = relative(root, file)
      const source = await readFile(file, 'utf8')
      const test = /\.test\.[cm]?[jt]sx?$/.test(file)
      if (!test && placeIdentity.test(source)) failures.push(`${label} contains place-specific identity`)
      if (/import\.meta\.env/.test(source)) failures.push(`${label} depends on the consumer's build environment`)
      for (const specifier of moduleReferences(source, file)) {
        if (specifier === undefined) {
          failures.push(`${label} has a non-literal module import; the package boundary cannot be verified`)
        } else if (specifier.startsWith('.')) {
          if (!within(directory, resolve(dirname(file), specifier))) {
            failures.push(`${label} reaches outside its package: ${specifier}`)
          }
        } else {
          const dependency = packageName(specifier)
          if (test && dependency === 'vitest') continue
          if (dependency.startsWith('@motionstudies/') && dependency in packageGraph) {
            const target = JSON.parse(await readFile(join(root, 'packages', dependency.split('/')[1], 'package.json'), 'utf8'))
            const subpath = `.${specifier.slice(dependency.length)}`
            if (!Object.hasOwn(target.exports ?? {}, subpath)) failures.push(`${label} imports an unsupported public subpath: ${specifier}`)
          }
          if (name === '@motionstudies/data' && specifier.startsWith('node:')) continue
          if (dependency.startsWith('@motionstudies/') && !allowedShared.includes(dependency)) {
            failures.push(`${label} violates the shared dependency direction: ${specifier}`)
          } else if (!declared.has(dependency)) {
            failures.push(`${label} imports undeclared dependency ${dependency}`)
          }
        }
      }
    }
  }
  for (const directory of legacyDirectories) {
    try {
      await access(join(root, 'src', directory))
      failures.push(`src/${directory} remains outside the @motionstudies workspaces`)
    } catch {
      // Expected: reusable code lives under packages/.
    }
  }
  // Follow the complete local module graph, so a helper cannot hide a foreign edition.
  for (const [id, entry] of [['switzerland', 'main.tsx'], ['london', 'london-main.tsx'], ['new-york', 'new-york-main.tsx'], ['paris', 'paris-main.tsx']]) {
    const visited = new Set()
    async function follow(file) {
      if (visited.has(file)) return
      visited.add(file)
      const owner = editionOwner(file, root)
      if (owner && owner !== id) {
        failures.push(`${entry} transitively imports the ${owner} edition: ${relative(root, file)}`)
        return
      }
      if (!/\.(?:[jt]sx?|css)$/.test(file)) return
      const source = await readFile(file, 'utf8')
      for (const specifier of moduleReferences(source, file)) {
        if (specifier?.startsWith('.')) await follow(resolve(dirname(file), specifier))
      }
    }
    await follow(join(root, 'src', entry))
  }
  try {
    await access(join(root, 'lab', 'src'))
    for (const file of await sourceFiles(join(root, 'lab', 'src'))) {
      const source = await readFile(file, 'utf8')
      for (const specifier of moduleReferences(source, file)) {
        if (specifier?.startsWith('.') && !within(join(root, 'lab'), resolve(dirname(file), specifier))) {
          failures.push(`${relative(root, file)} reaches outside the lab consumer: ${specifier}`)
        }
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  return failures
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const failures = await checkEditionBoundaries()
  if (failures.length) throw new Error(`Edition boundary violations:\n- ${failures.join('\n- ')}`)
  console.log('Package dependencies and transitive edition boundaries hold.')
}
