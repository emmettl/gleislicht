import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import PlaywrightSummaryReporter from './playwright-summary-reporter.mjs'

const reporter = fileURLToPath(new URL('./playwright-summary-reporter.mjs', import.meta.url))
const playwright = fileURLToPath(new URL('../node_modules/@playwright/test/index.mjs', import.meta.url))
const cli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url))

function runFixture(source, globalSetup) {
  const directory = mkdtempSync(join(tmpdir(), 'gleislicht-e2e-report-'))
  try {
    const summary = join(directory, 'summary.md')
    const config = join(directory, 'playwright.config.mjs')
    writeFileSync(join(directory, 'report.spec.mjs'), `import { test, expect } from ${JSON.stringify(playwright)};\n${source}`)
    if (globalSetup) writeFileSync(join(directory, 'setup.mjs'), globalSetup)
    writeFileSync(config, `export default ${JSON.stringify({
      testDir: directory, outputDir: join(directory, 'results'),
      reporter: [[reporter]], workers: 1, retries: 1,
      projects: [{ name: 'synthetic-browser' }],
      ...(globalSetup ? { globalSetup: join(directory, 'setup.mjs') } : {}),
    })}`)
    const result = spawnSync(process.execPath, [cli, 'test', '--config', config], {
      encoding: 'utf8', timeout: 20_000,
      env: { ...process.env, GITHUB_STEP_SUMMARY: summary, E2E_SUITE: 'functional' },
    })
    return { status: result.status, error: result.error, summary: readFileSync(summary, 'utf8') }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

describe('Playwright Actions summary', () => {
  it('ranks slow tests by the total of all attempts', () => {
    const directory = mkdtempSync(join(tmpdir(), 'gleislicht-e2e-timings-'))
    const previousSummary = process.env.GITHUB_STEP_SUMMARY
    const summary = join(directory, 'summary.md')
    process.env.GITHUB_STEP_SUMMARY = summary
    try {
      const makeTest = (title, durations) => ({
        title,
        titlePath: () => ['', 'synthetic-browser', 'report.spec.mjs', title],
        parent: { project: () => ({ name: 'synthetic-browser' }) },
        outcome: () => 'expected',
        results: durations.map(duration => ({ duration, status: 'passed' })),
      })
      const reporter = new PlaywrightSummaryReporter()
      reporter.onBegin({}, { allTests: () => [
        makeTest('single attempt', [2000]),
        makeTest('multiple attempts', [1500, 1500]),
      ] })
      reporter.onEnd({ status: 'passed', duration: 6000 })
      const contents = readFileSync(summary, 'utf8')
      expect(contents).toContain('Wall time: **6.0s**. Test time including retries: **5.0s**.')
      expect(contents.indexOf('multiple attempts')).toBeLessThan(contents.indexOf('single attempt'))
      expect(contents).toContain('**3.0s**')
      expect(contents).toContain('multiple attempts</code> (2 attempt(s))')
    } finally {
      if (previousSummary === undefined) delete process.env.GITHUB_STEP_SUMMARY
      else process.env.GITHUB_STEP_SUMMARY = previousSummary
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('reports final failures, flaky retries and unexpected passes without hiding a failing exit code', () => {
    const result = runFixture(`
      test('passing case', () => expect(1).toBe(1));
      test('failure <widget>', () => expect('actual', 'visible assertion detail').toBe('expected'));
      test('flaky case', ({}, info) => expect(info.retry).toBe(1));
      test.skip('skipped case', () => {});
      test('expected failure', () => { test.fail(); expect(1).toBe(2); });
      test('unexpected pass', () => { test.fail(); expect(1).toBe(1); });
    `)
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.summary).toContain('Run status: failed')
    expect(result.summary).toContain('2 failed · 1 flaky (passed on retry) · 2 expected outcomes · 1 skipped')
    expect(result.summary).toContain('synthetic-browser')
    expect(result.summary).toContain('failure &lt;widget&gt;')
    expect(result.summary).toContain('report.spec.mjs:')
    expect(result.summary).toContain('visible assertion detail')
    expect(result.summary).toContain('2 attempt(s)')
    expect(result.summary).toContain('Expected this test to fail, but it passed.')
    expect(result.summary).toContain('### Flaky tests')
    expect(result.summary).toMatch(/Wall time: \*\*\d+\.\ds\*\*/)
    expect(result.summary).toContain('Test time including retries:')
    expect(result.summary).toContain('### Slowest tests (including retries)')
    const timings = result.summary.split('### Slowest tests (including retries)')[1]
    expect(timings).toContain('passing case')
    expect(timings).toContain('flaky case</code> (2 attempt(s))')
    expect(timings).not.toContain('skipped case')
    expect(result.summary).not.toContain('\u001b[')
  }, 30_000)

  it('includes setup failures even when no test executes', () => {
    const result = runFixture(`test('never started', () => {});`, `export default () => { throw new Error('Preview server unavailable'); };`)
    expect(result.status).toBe(1)
    expect(result.summary).toContain('Run status: failed')
    expect(result.summary).toContain('### Runner errors')
    expect(result.summary).toContain('Preview server unavailable')
  }, 30_000)
})
