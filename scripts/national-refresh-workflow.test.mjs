import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const workflow = await readFile(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8')
const national = workflow.split('\n  national:\n')[1].split('\n  regional:\n')[0]
const steps = national.split('      - name: ')
const build = steps.find(step => step.startsWith('Build the selected day'))
const recovery = steps.find(step => step.startsWith('Retain verified published timetable'))
const condition = recovery.match(/if: \$\{\{ (.*) \}\}/)[1]
// Exercise the actual workflow condition, including Actions' cancellation rule.
const recover = new Function('steps', 'cancelled', `return ${condition}`)

describe('national refresh recovery wiring', () => {
  it.each([
    ['success', 'success', false, false],
    ['failure', 'skipped', false, true],
    ['success', 'failure', false, true],
    ['success', 'skipped', false, false],
    ['failure', 'skipped', true, false],
    ['success', 'failure', true, false],
  ])('sources %s, build %s, cancelled %s => recover %s', (sources, timetable, cancelled, expected) => {
    expect(recover({ sources: { outcome: sources }, timetable: { outcome: timetable } }, () => cancelled)).toBe(expected)
  })

  it('handles a rejected build but never tolerates a failed recovery or bypasses the calendar gate', () => {
    expect(build).toContain('id: timetable\n        continue-on-error: true')
    expect(build).toContain("if: steps.sources.outcome == 'success'")
    expect(build).toContain('npm run data:postbus:roads\n          node scripts/audit-postbus.mjs')
    expect(recovery).toContain('node scripts/restore-published-national-data.mjs')
    expect(recovery).not.toContain('continue-on-error')
    const upload = steps.find(step => step.startsWith('Upload national timetable'))
    expect(upload).not.toMatch(/if:|continue-on-error/)
    expect(workflow).toContain('needs: [check, national, regional, e2e]')
    expect(workflow).toContain('node scripts/timetable-calendar.mjs public/data "$RUNNER_TEMP/tomorrow-data" "${{ needs.check.outputs.service_date }}"')
  })
})
