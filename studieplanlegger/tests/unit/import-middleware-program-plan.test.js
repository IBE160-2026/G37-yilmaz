import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { importMiddleware } from '../../server/import-api.js'

const fixture = () => readFile(new URL('../fixtures/public-programs/mf-professional-current.html', import.meta.url), 'utf8')

async function requestImport(url, fetchTextImpl) {
  const req = Object.assign(new EventEmitter(), { method: 'GET', url, headers: { host: '127.0.0.1:5192', origin: 'http://127.0.0.1:5192' } })
  return new Promise(resolve => {
    const res = Object.assign(new EventEmitter(), {
      destroyed: false,
      writableEnded: false,
      writeHead(status, headers) { this.status = status; this.headers = headers },
      end(body) { this.writableEnded = true; resolve({ status: this.status, headers: this.headers, body }) },
    })
    importMiddleware(req, res, () => { throw new Error('Route was not dispatched') }, { fetchTextImpl })
  })
}

describe('normal programme-plan HTTP dispatch', () => {
  it('routes program-plan through importMiddleware and the provider contract', async () => {
    const html = await fixture()
    const params = new URLSearchParams({ institution: 'mf', program: 'profesjonsstudium-teologi', sourceUrl: 'https://mf.no/studier/programmer/profesjonsstudium-teologi', cohort: '2026', cohortFromStudent: 'true' })
    const fetchTextImpl = async (url, _redirects, validate) => { validate?.(new URL(url)); return html }
    const response = await requestImport(`/api/import/providers/mf/program-plan?${params}`, fetchTextImpl)
    expect(response.status).toBe(200)
    expect(response.headers['Content-Type']).toContain('application/json')
    const body = JSON.parse(response.body)
    expect(body.program).toMatchObject({ code: 'profesjonsstudium-teologi', cohort: '2026', sourceUrl: 'https://mf.no/studier/programmer/profesjonsstudium-teologi' })
    expect(body.models[0].periods[0]).toMatchObject({ studySemester: 1 })
    expect(body.models[0].periods[0].courses[0].code).toBe('TEOL1010')
  })

  it.each(['nhh', 'fhs'])('returns an understandable error when the %s source cannot resolve', async institution => {
    const response = await requestImport(`/api/import/providers/${institution}/programs?year=2026`, async () => {
      throw Object.assign(new Error('getaddrinfo ENOTFOUND example.invalid'), { code: 'ENOTFOUND' })
    })
    expect(JSON.parse(response.body)).toMatchObject({
      status: 'transport-error',
      error: 'Fikk ikke kontakt med lærestedet. Prøv igjen senere. Lagrede data er beholdt.',
    })
    expect(response.body).not.toContain('example.invalid')
  })
})
