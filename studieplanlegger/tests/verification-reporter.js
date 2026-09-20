import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
export default class VerificationReporter {
  constructor() { this.results = []; this.path = resolve('artifacts', `${process.env.VERIFICATION_RUN || 'verification-e2e'}.json`) }
  onBegin(_config, suite) { this.expected = suite.allTests().length; this.startedAt = new Date().toISOString(); this.save('running') }
  onTestEnd(test, result) {
    this.results.push({ title: test.title, file: test.location.file, line: test.location.line, status: result.status, duration: result.duration, errors: result.errors.map(error => error.message || String(error)) })
    const complete = this.results.length === this.expected
    const successful = complete && this.results.every(row => ['passed', 'skipped'].includes(row.status))
    this.save(successful ? 'passed' : complete ? 'failed' : 'running')
    if (result.status !== 'passed') console.log(`\nFAILED ${test.location.file}:${test.location.line}\n${result.errors.map(error => error.message).join('\n')}`)
  }
  onEnd(result) { this.save(result.status); console.log(`Verification: ${this.results.filter(r => r.status === 'passed').length}/${this.expected} passed; ${this.path}`) }
  save(status) { mkdirSync(resolve('artifacts'), { recursive: true }); writeFileSync(this.path, JSON.stringify({ status, startedAt: this.startedAt, recordedAt: new Date().toISOString(), expected: this.expected, results: this.results }, null, 2)) }
}
