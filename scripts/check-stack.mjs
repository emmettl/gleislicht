import { readFile } from 'node:fs/promises'
import { stack, checkStack } from '@motionstudies/tooling/stack'

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const failures = checkStack(manifest)
if (Number(process.versions.node.split('.')[0]) < stack.nodeMajor) {
  failures.push(`Node ${stack.nodeMajor}+ is required; found ${process.versions.node}`)
}
if (failures.length) throw new Error(failures.join('\n'))
console.log(`Shared stack matches Node ${stack.nodeMajor} / ${stack.packageManager}`)
