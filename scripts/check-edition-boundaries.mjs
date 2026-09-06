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
    if (
      /editions\/(?:london|new-york|paris|switzerland)(?:-geography)?\.ts/.test(
        source,
      )
    ) {
      failures.push(
        `${relative('.', file)} imports a concrete edition from shared runtime code`,
      )
    }
    if (/studies\/(?:London|NewYork|Paris)StudyApp|(?:^|\/)App\.tsx/.test(source)) {
      failures.push(
        `${relative('.', file)} imports an edition shell from shared runtime code`,
      )
    }
    if (
      !/\.test\.tsx?$/.test(file) &&
      /\b(?:Switzerland|Swiss|Zürich|Zurich|Genève|Geneva|London|TfL|GLA|New York|MTA|Paris|IDFM|gleislicht)\b|all-change|local-express|correspondances/i.test(
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
const newYorkEntry = await readFile(join(SOURCE_ROOT, 'new-york-main.tsx'), 'utf8')
if (/switzerland|swiss-|LondonStudyApp|ParisStudyApp/.test(newYorkEntry)) {
  failures.push('src/new-york-main.tsx references another edition shell')
}
const parisEntry = await readFile(join(SOURCE_ROOT, 'paris-main.tsx'), 'utf8')
if (/switzerland|swiss-|LondonStudyApp|NewYorkStudyApp/.test(parisEntry)) {
  failures.push('src/paris-main.tsx references another edition shell')
}

if (failures.length) {
  throw new Error(`Edition boundary violations:\n- ${failures.join('\n- ')}`)
}

console.log(
  `Edition boundaries hold across ${CORE_DIRECTORIES.map((directory) => `src/${directory}`).join(', ')}.`,
)
