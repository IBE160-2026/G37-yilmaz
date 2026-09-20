import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import VerificationReporter from '../verification-reporter.js'

describe('verification reporter evidence', () => {
  it('records running, failed and final states with test evidence', () => {
    const dir = mkdtempSync(join(tmpdir(), 'study-verification-'))
    try {
      const reporter = new VerificationReporter(); reporter.path = join(dir, 'result.json')
      reporter.onBegin({}, { allTests: () => [{}, {}] })
      expect(JSON.parse(readFileSync(reporter.path, 'utf8'))).toMatchObject({ status: 'running', expected: 2, results: [] })
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      reporter.onTestEnd({ title: 'first', location: { file: 'a.spec.js', line: 3 } }, { status: 'passed', duration: 4, errors: [] })
      reporter.onTestEnd({ title: 'second', location: { file: 'b.spec.js', line: 7 } }, { status: 'failed', duration: 5, errors: [{ message: 'boom' }] })
      expect(JSON.parse(readFileSync(reporter.path, 'utf8'))).toMatchObject({ status: 'failed', expected: 2, results: [{ status: 'passed' }, { status: 'failed', errors: ['boom'] }] })
      reporter.onEnd({ status: 'failed' }); expect(log).toHaveBeenCalled(); log.mockRestore()
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})
