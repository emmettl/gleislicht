import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'

const SOURCE_ROOT = resolve('src')
const CORE_DIRECTORIES = ['domain', 'scene', 'theme', 'components', 'entries']
const failures = []

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return sourceFiles(path)
      return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : []
    }),
  )
  return nested.flat()
}

for (const directory of CORE_DIRECTORIES) {
  for (const file of await sourceFiles(join(SOURCE_ROOT, directory))) {
    const source = await readFile(file, 'utf8')
    if (/editions\/(?:london|switzerland)(?:-geography)?\.ts/.test(source)) {
      failures.push(
        `${relative('.', file)} imports a concrete edition from shared runtime code`,
      )
    }
    if (/studies\/LondonStudyApp|(?:^|\/)App\.tsx/.test(source)) {
      failures.push(
        `${relative('.', file)} imports an edition shell from shared runtime code`,
      )
    }
    if (
      !/\.test\.tsx?$/.test(file) &&
      /\b(?:Switzerland|Swiss|Zürich|Zurich|Genève|Geneva|London|TfL|GLA|gleislicht)\b|all-change/i.test(
        source,
      )
    ) {
      failures.push(
        `${relative('.', file)} contains place-specific identity in shared runtime code`,
      )
    }
  }
}

const swissEntry = await readFile(join(SOURCE_ROOT, 'main.tsx'), 'utf8')
if (/london|all-change/i.test(swissEntry)) {
  failures.push('src/main.tsx references the London edition')
}
const londonEntry = await readFile(join(SOURCE_ROOT, 'london-main.tsx'), 'utf8')
if (/switzerland|swiss-|from ['"]\.\/App\.tsx/.test(londonEntry)) {
  failures.push('src/london-main.tsx references the Swiss edition shell')
}

if (failures.length) {
  throw new Error(`Edition boundary violations:\n- ${failures.join('\n- ')}`)
}

console.log(
  `Edition boundaries hold across ${CORE_DIRECTORIES.map((directory) => `src/${directory}`).join(', ')}.`,
)
