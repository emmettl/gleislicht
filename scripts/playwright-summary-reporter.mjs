import { appendFileSync } from 'node:fs'
import { relative } from 'node:path'
import { stripVTControlCharacters } from 'node:util'

const escape = value => stripVTControlCharacters(value).replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character])
const code = value => `<code>${escape(value)}</code>`
const errorText = error => error.message || error.value || 'No error message supplied'

/** Append final outcomes, including retries and runner errors, to the Actions run summary. */
export default class PlaywrightSummaryReporter {
  suite
  errors = []
  rootDir = process.cwd()

  printsToStdio() { return false }

  onBegin(_config, suite) {
    this.suite = suite
  }

  onError(error) { this.errors.push(error) }

  onEnd(result) {
    if (!process.env.GITHUB_STEP_SUMMARY) return
    const tests = this.suite?.allTests() ?? []
    const groups = { unexpected: [], flaky: [], expected: [], skipped: [] }
    for (const test of tests) groups[test.outcome()].push(test)
    const lines = [
      `## E2E tests — ${escape(process.env.E2E_SUITE || 'Playwright')}`,
      '',
      `**Run status: ${result.status}.** ${groups.unexpected.length} failed · ${groups.flaky.length} flaky (passed on retry) · ${groups.expected.length} expected outcomes · ${groups.skipped.length} skipped.`,
      '',
    ]
    for (const [heading, entries] of [['Failed tests', groups.unexpected], ['Flaky tests', groups.flaky]]) {
      if (!entries.length) continue
      lines.push(`### ${heading}`, '')
      for (const test of entries) {
        const project = test.parent.project()?.name || 'default'
        const location = `${relative(this.rootDir, test.location.file)}:${test.location.line}`
        // The last unsuccessful attempt gives the useful error even when a retry passes.
        const attempt = test.results.findLast(attempt => attempt.status !== test.expectedStatus && attempt.status !== 'skipped')
        lines.push(`- ${code(project)} — ${code(test.titlePath().slice(3).join(' › ') || test.title)} (${code(location)}; ${test.results.length} attempt(s))`, '')
        const messages = attempt?.errors.map(errorText) ?? []
        if (!messages.length && test.expectedStatus === 'failed') messages.push('Expected this test to fail, but it passed.')
        if (!messages.length) messages.push(`Final attempt status: ${test.results.at(-1)?.status || 'not run'}`)
        lines.push(`<pre>${escape(messages.join('\n\n').slice(0, 3000))}</pre>`, '')
      }
    }
    if (this.errors.length) {
      lines.push('### Runner errors', '', ...this.errors.map(error => `<pre>${escape(errorText(error).slice(0, 3000))}</pre>\n`))
    }
    if (!tests.length) lines.push('No tests completed discovery. Check runner errors or the E2E step for setup failures.', '')
    lines.push('The **e2e-report** artifact contains the HTML reports, screenshots and traces.', '')
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`)
  }
}
