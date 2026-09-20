import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { importMiddleware } from '../../server/import-api.js'
import { programProviders } from '../../server/providers/programs.js'
import { programsRequest } from '../../server/providers/programs.js'

const programmeHosts = {
  ntnu: 'www.ntnu.no', inn: 'studiekatalog.edutorium.no', dmmh: 'studier.dmmh.no', oslomet: 'student.oslomet.no', usn: 'www.usn.no', hvl: 'www.hvl.no', nla: 'www.nla.no', uib: 'www4.uib.no', nmbu: 'www.nmbu.no', vid: 'www.vid.no', hivolda: 'www.hivolda.no', noroff: 'studiekatalog.edutorium.no', uis: 'www.uis.no', mf: 'mf.no', hlt: 'hlt.no', ldh: 'ldh.no', steiner: 'www.steinerhoyskolen.no', hfdk: 'www.hfdk.no', bi: 'www.bi.no', nhh: 'www.nhh.no', fih: 'fih.fjellhaug.no', krus: 'www.krus.no', kristiania: 'www.kristiania.no', ansgar: 'www.ansgarhoyskole.no', fhs: 'www.forsvaret.no', khio: 'khio.no', onh: 'oslonyehoyskole.no', limpi: 'limpimusic.com', barrattdue: 'barrattdue.no', nbi: 'barnebokinstituttet.no', nmh: 'student.nmh.no', hfy: 'hfy.no', bas: 'bas.org', phs: 'www.politihogskolen.no', gestalt: 'gestalt.no', nhfh: 'nhfh.no', hgut: 'hgut.no', nski: 'www.nski.no', samas: 'samas.no', uit: 'uit.no', nord: 'www.nord.no', uia: 'www.uia.no', uio: 'www.uio.no', himolde: 'www.himolde.no', nih: 'www.nih.no', hiof: 'www.hiof.no', skrivekunst: 'www.skrivekunst.no', aho: 'www.aho.no',
}

async function route(method, path, body, options = {}) {
  const calls = []
  const probe = kind => async (input, _redirects, validate) => {
    const url = new URL(String(input)); validate?.(url); calls.push({ kind, url: url.href })
    throw new Error(`route-probe:${url.hostname}`)
  }
  const req = body === undefined ? new EventEmitter() : Readable.from(options.bodyChunks || [JSON.stringify(body)])
  Object.assign(req, { method, url: path, headers: { host: '127.0.0.1:5192', origin: 'http://127.0.0.1:5192', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(options.headers || {}) } })
  const response = await new Promise(resolve => {
    const res = Object.assign(new EventEmitter(), {
      destroyed: false, writableEnded: false,
      writeHead(status, headers) { this.status = status; this.headers = headers },
      end(value) { this.writableEnded = true; resolve({ httpStatus: this.status, headers: this.headers, body: JSON.parse(value) }) },
    })
    importMiddleware(req, res, () => { throw new Error('Route was not dispatched') }, { fetchTextImpl: options.fetchTextImpl || probe('text'), fetchBytesImpl: options.fetchBytesImpl || probe('bytes'), ...(options.providerRequestImpl ? { providerRequestImpl: options.providerRequestImpl } : {}) })
  })
  return { ...response, calls }
}

describe('R25 real import routing boundary', () => {
  it('covers every registered programme provider identity through its actual adapter', async () => {
    expect(Object.keys(programmeHosts).sort()).toEqual([...programProviders].sort())
    for (const institution of programProviders) {
      const response = await route('GET', `/api/import/providers/${institution}/programs?year=2026`)
      expect(response.httpStatus, institution).toBe(200)
      expect(response.calls[0] && new URL(response.calls[0].url).hostname, institution).toBe(programmeHosts[institution])
      expect(response.body, institution).toMatchObject({ status: ['barrattdue', 'samas'].includes(institution) ? 'source-changed' : 'transport-error', error: expect.any(String) })
    }
  })

  it.each([
    ['uia', 'teaching-search', 'tp.educloud.no'], ['uia', 'teaching-calendar', 'tp.educloud.no'],
    ['mf', 'teaching-search', 'cloud.timeedit.net'], ['mf', 'teaching-calendar', 'cloud.timeedit.net'],
  ])('routes %s %s through the selected teaching adapter', async (institution, action, host) => {
    const query = new URLSearchParams({ q: 'TEST101', semester: 'autumn', year: '2026', sourceObjectId: '123.4' })
    const response = await route('GET', `/api/import/providers/${institution}/${action}?${query}`)
    expect(response.httpStatus).toBe(200)
    expect(response.body).toMatchObject({ status: 'transport-error', error: `route-probe:${host}` })
    expect(new URL(response.calls[0].url).hostname).toBe(host)
  })

  it.each([
    ['hfy', 'hfy.no'], ['gestalt', 'gestalt.no'], ['ansgar', 'www.ansgarhoyskole.no'], ['fih', 'fih.fjellhaug.no'],
  ])('routes the %s special calendar-source GET branch', async (institution, host) => {
    const response = await route('GET', `/api/import/calendar-sources/${institution}`)
    expect(response.httpStatus).toBe(400)
    expect(response.body.error).toContain(`route-probe:${host}`)
    expect(new URL(response.calls[0].url).hostname).toBe(host)
  })

  it('routes the PHS calendar-source GET branch without transport', async () => {
    const response = await route('GET', '/api/import/calendar-sources/phs')
    expect(response).toMatchObject({ httpStatus: 200, body: { results: expect.any(Array), warnings: expect.any(Array) }, calls: [] })
    expect(response.body.results.length).toBeGreaterThan(0)
  })

  it.each([
    ['hfy', 'https://s3-gustav.imgix.net/hfy/klasse-a.pdf', undefined, 'hfy.no'],
    ['gestalt', 'https://img1.wsimg.com/blobby/go/55361435-a2bf-4944-ac74-364748af0ac3/GT%20Timeplan%20202627%20uten%20l%C3%A6rere-f6c8da5.pdf', 'gestaltterapi:1:helg', 'gestalt.no'],
    ['fih', 'https://fih.fjellhaug.no/files/uploads/Instruksjoner/Lenker-for-timeplan.pdf', 'class:1', 'fih.fjellhaug.no'],
    ['phs', 'https://www.politihogskolen.no/for-studenter/eksamen/eksamensoversikt-ba', undefined, 'www.politihogskolen.no'],
  ])('routes the %s special calendar POST branch', async (_institution, url, sourceObjectId, host) => {
    const response = await route('POST', '/api/import/calendar', { url, sourceObjectId })
    expect(response.httpStatus).toBe(400)
    expect(response.body.error).toContain(`route-probe:${host}`)
    expect(new URL(response.calls[0].url).hostname).toBe(host)
  })

  it('routes the Ansgar special calendar POST branch', async () => {
    const fixture = JSON.parse(readFileSync(new URL('../fixtures/ansgar-timetable-7.json', import.meta.url)))
    const response = await route('POST', '/api/import/calendar', { url: fixture.source.sourceUrl })
    expect(response).toMatchObject({ httpStatus: 400, body: { error: 'route-probe:www.ansgarhoyskole.no' } })
    expect(new URL(response.calls[0].url).hostname).toBe('www.ansgarhoyskole.no')
  })
})

describe('R26 successful distinguishing route fixtures', () => {
  it.each([
    ['hfy', '<a href="/bachelor-i-prosjektledelse/">Bachelor i prosjektledelse</a>', 'bachelor-i-prosjektledelse'],
    ['nbi', '<a href="/utdanninger-og-kurs/forfatterutdanningen/">Forfatterutdanningen</a>', 'forfatterutdanningen'],
    ['nski', '<h3>Bachelor i skuespillerfag</h3><p><a href="/bachelor-i-skuespillerfag">Les mer</a></p>', 'bachelor-i-skuespillerfag'],
  ])('returns a successful %s catalogue through the HTTP middleware and real adapter', async (institution, html, code) => {
    const response = await route('GET', `/api/import/providers/${institution}/programs`, undefined, { fetchTextImpl: async () => html })
    expect(response).toMatchObject({ httpStatus: 200, body: { status: 'ok', results: [{ code }] } })
  })

  it('returns the LIMPI catalogue through middleware after parsing its linked public plan', async () => {
    const pages = [
      { page: 2, lines: ['2026/2027', 'Name of study program', 'Professional Music Production', 'The program runs across two semesters; September to December and January to June.'] },
      { page: 6, lines: ['Semester One - Fall', '• Production (PROD1), 30 credits', 'Semester Two - Spring', '• Production (PROD2), 30 credits'] },
    ]
    const providerRequestImpl = (institution, action, query, dependencies) => programsRequest(institution, action, query, { ...dependencies, readPdf: async () => pages })
    const response = await route('GET', '/api/import/providers/limpi/programs', undefined, { fetchTextImpl: async () => '<a href="/uploads/Limpi_STUDYPLAN_2026.pdf">Study Plan</a>', providerRequestImpl })
    expect(response).toMatchObject({ httpStatus: 200, body: { status: 'ok', results: [{ code: 'program', name: 'Professional Music Production' }] } })
  })
  it('decodes a UTF-8 JSON body only after all network chunks have arrived', async () => {
    const url = 'https://example.org/kalender/økt.ics', raw = Buffer.from(JSON.stringify({ url }))
    const split = raw.indexOf(Buffer.from('ø')) + 1
    const response = await route('POST', '/api/import/calendar', { url }, {
      bodyChunks: [raw.subarray(0, split), raw.subarray(split)],
      fetchTextImpl: async input => { expect(String(input)).toBe(url); return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n' },
    })
    expect(response).toMatchObject({ httpStatus: 200, body: { calendar: expect.stringContaining('BEGIN:VCALENDAR') } })
  })
  it.each([
    ['inn', 'BAPEDD', 'https://studiekatalog.edutorium.no/inn/nb/program/BAPEDD/2026', 'inn-bapedd-2026.html', 'Bachelor i pedagogikk', 'KILDEKURS'],
    ['noroff', 'BCYSE', 'https://studiekatalog.edutorium.no/nuc/en/programme/BCYSE/2026-autumn', 'noroff-cyber-2026.html', 'Cyber Security', 'UC1AS105'],
  ])('parses the same-host %s programme adapter through middleware', async (institution, program, sourceUrl, fixtureName, programName, courseCode) => {
    const html = readFileSync(new URL(`../fixtures/public-programs/${fixtureName}`, import.meta.url), 'utf8')
    const query = new URLSearchParams({ program, cohort: '2026', sourceUrl })
    const response = await route('GET', `/api/import/providers/${institution}/program-plan?${query}`, undefined, { fetchTextImpl: async (_url, _redirects, validate) => { validate?.(new URL(sourceUrl)); return html } })
    expect(response.httpStatus).toBe(200)
    expect(response.body).toMatchObject({ status: 'ok', program: { name: expect.stringContaining(programName) } })
    expect(response.body.models.flatMap(model => model.periods).flatMap(period => period.courses).some(course => course.code === courseCode)).toBe(true)
  })

  it('distinguishes the PHS special exam adapter from generic same-host calendar fallback', async () => {
    const examUrl = 'https://www.politihogskolen.no/for-studenter/eksamen/eksamensoversikt-ba'
    const examHtml = readFileSync(new URL('../fixtures/phs-programs/exams-ba.html', import.meta.url), 'utf8')
    const special = await route('POST', '/api/import/calendar', { url: examUrl }, { fetchTextImpl: async (_url, _redirects, validate) => { validate?.(new URL(examUrl)); return examHtml } })
    expect(special).toMatchObject({ httpStatus: 200, body: { sourceKind: 'phs-public-exam', count: expect.any(Number), authoritative: false } })
    expect(special.body.count).toBeGreaterThan(0)

    const genericUrl = 'https://www.politihogskolen.no/public/test-calendar.ics'
    const calendar = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//R26 fixture//EN\r\nEND:VCALENDAR\r\n'
    const generic = await route('POST', '/api/import/calendar', { url: genericUrl }, { fetchTextImpl: async url => { expect(String(url)).toBe(genericUrl); return calendar } })
    expect(generic).toMatchObject({ httpStatus: 200, body: { calendar } })
    expect(generic.body).not.toHaveProperty('sourceKind')
  })

  it('rejects an originless browser request marked cross-site before dispatch', async () => {
    const response = await route('GET', '/api/import/calendar-sources/phs', undefined, { headers: { origin: undefined, 'sec-fetch-site': 'cross-site' } })
    expect(response).toMatchObject({ httpStatus: 403, body: { error: expect.stringContaining('annet nettsted') }, calls: [] })
  })
})
