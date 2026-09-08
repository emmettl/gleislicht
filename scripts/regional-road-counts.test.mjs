import { execFileSync } from 'node:child_process'
import { it } from 'vitest'

it('preserves regional hourly-count semantics and reproduces the pinned audits', () => {
  execFileSync('python3', ['-B', '-m', 'unittest', 'discover', '-s', 'scripts', '-p', 'test_regional_road_counts.py'], {
    cwd: new URL('..', import.meta.url),
    stdio: 'pipe',
    timeout: 60_000,
  })
}, 65_000)
