import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { importMiddleware } from '../../server/import-api.js'

const fixture = () => readFile(new URL('../fixtures/public-programs/mf-professional-current.html', import.meta.url), 'utf8')

describe('normal programme-plan HTTP dispatch', () => {
  it('routes program-plan through importMiddleware and the provider contract', async () => {
    const html = await fixture()
    const params = new URLSearchParams({ institution: 'mf', program: 'profesjonsstudium-teologi', sourceUrl: 'https://mf.no/studier/programmer/profesjonsstudium-teologi', cohort: '2026', cohortFromStudent: 'true' })
    const req = Object.assign(new EventEmitter(), { method: 'GET', url: `/api/import/providers/mf/program-plan?${params}`, headers: { host: '127.0.0.1:5192', origin: 'http://127.0.0.1:5192' } })
    const response = await new Promise(resolve => {
      const res = Object.assign(new EventEmitter(), {
        destroyed: false,
        writableEnded: false,
        writeHead(status, headers) { this.status = status; this.headers = headers },
        end(body) { this.writableEnded = true; resolve({ status: this.status, headers: this.headers, body }) },
      })
      const fetchTextImpl = async (url, _redirects, validate) => { validate?.(new URL(url)); return html }
      importMiddleware(req, res, () => { throw new Error('Route was not dispatched') }, { fetchTextImpl })
    })
    expect(response.status).toBe(200)
    expect(response.headers['Content-Type']).toContain('application/json')
    const body = JSON.parse(response.body)
    expect(body.program).toMatchObject({ code: 'profesjonsstudium-teologi', cohort: '2026', sourceUrl: 'https://mf.no/studier/programmer/profesjonsstudium-teologi' })
    expect(body.models[0].periods[0]).toMatchObject({ studySemester: 1 })
    expect(body.models[0].periods[0].courses[0].code).toBe('TEOL1010')
  })
})
