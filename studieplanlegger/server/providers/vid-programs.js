import { load, clean, fail, cachedText, restrictedUrl, MAX_PAGES, MAX_RESULTS, asCredits, periodLabel } from './program-source.js'

const origin = 'https://www.vid.no'
const catalogue = `${origin}/studier/studieplaner/_/service/vid.no/listPages?sort=static&ct=study_plan`
const planPath = /^\/studier\/studieplaner\/[^/]+\/?$/
const validate = input => restrictedUrl(input, { origin, paths: [planPath, /^\/studier\/studieplaner\/_\/service\/vid.no\/listPages$/, /^\/studier\/studieplaner\/[^/]+\/_\/service\/vid.no\/listStudyPlanWay$/, /^\/studier\/emner\/[^/]+$/], keys: ['sort', 'ct', 'count', 'page', 'id', 'way', 'year', 'semester'] })
const planUrl = input => { const url = validate(input); if (!planPath.test(url.pathname) || url.search) fail('invalid-selection', 'Velg en publisert VID-studieplan.'); return url }
const codeFor = url => decodeURIComponent(url.pathname.replace(/\/$/, '').split('/').pop())
const term = value => { const match = clean(value).match(/^(Høst|Vår)\s+(\d{4})$/i); return match ? { year: Number(match[2]), semester: /^vår$/i.test(match[1]) ? 'spring' : 'autumn' } : null }
const json = text => { try { return JSON.parse(text) } catch { fail('source-changed', 'VID-kilden svarte ikke med lesbare data.') } }

export function parseVidDescription(html) {
  const $ = load(html), scripts = $('script[type="application/json"][data-react4xp-app-name="vid.no"]'), found = []
  const walk = (item, depth = 0) => {
    if (!item || typeof item !== 'object' || depth > 30) return
    if (item.component?.descriptor === 'vid.no:programme-description' && item.data?.programmeDescription) found.push(item.data.programmeDescription)
    // The public React4XP tree duplicates regions inside data; only the component tree is authoritative.
    for (const [key, value] of Object.entries(item)) if (key !== 'data') walk(value, depth + 1)
  }
  scripts.each((_, script) => walk(json($(script).text()).props?.component))
  const data = found[0]
  if (!data || !clean(data.title) || !/^\d{4}$/.test(String(data.year)) || !Array.isArray(data.otherSiblings) || !Array.isArray(data.ways)) fail('source-changed', 'VID-studieplanen mangler gjenkjennelig program, kull eller studiemodell.')
  return data
}

export async function fetchVidCatalogue(fetchText) {
  const results = new Map(), warnings = []; let total = null, pages = 0, complete = true, reason = ''
  for (let page = 1; page <= MAX_PAGES; page++) {
    fetchText.signal?.throwIfAborted()
    const url = new URL(catalogue); url.searchParams.set('count', '10'); url.searchParams.set('page', String(page))
    try {
      const data = json(await cachedText(fetchText, url.href, validate))
      if (!Array.isArray(data.hits) || !Number.isSafeInteger(data.total) || data.total < 0 || data.page !== page || data.start !== (page - 1) * 10 || data.hits.length > 10) fail('source-changed', 'VID-katalogens sidetall eller dataformat har endret seg.')
      if (total !== null && total !== data.total) fail('source-changed', 'VID-katalogen endret antall oppføringer under hentingen. Hent listen på nytt.')
      total = data.total; pages++
      const before = results.size
      for (const row of data.hits) {
        const source = planUrl(new URL(row.href, origin)), intake = term(row.term)
        if (!clean(row.title)) fail('source-changed', 'Et publisert VID-program mangler navn.')
        results.set(source.href, { code: codeFor(source), name: clean(row.title), sourceUrl: source.href, level: clean(row.degree), campuses: Array.isArray(row.locations) ? row.locations.map(clean).filter(Boolean) : [], ...(intake ? { cohort: String(intake.year), intake: intake.semester } : {}) })
      }
      if (results.size === total) break
      if (results.size === before || data.hits.length < 10 || results.size > total) fail('source-changed', 'VID-katalogen stopper eller gjentar oppføringer før oppgitt total er hentet.')
      if (results.size >= MAX_RESULTS || page === MAX_PAGES) fail('source-changed', 'Sikkerhetsgrensen for programlisten er nådd.')
    } catch (error) {
      if (!pages || error.name === 'AbortError') throw error
      complete = false; reason = `Listen er ufullstendig: ${error.message}`; warnings.push(reason); break
    }
  }
  return { results: [...results.values()], warnings, completeness: { complete: complete && results.size === total, pages, returned: results.size, total, ...(reason ? { reason } : {}) } }
}

export function parseVidWay(text, { description, way, sourceUrl, program }) {
  const data = json(text)
  if (!Array.isArray(data.hit) || !Number.isSafeInteger(data.total) || data.total !== data.hit.length || data.hit.length > 60) fail('source-changed', 'VID-studiemodellen er ufullstendig eller har endret format.')
  const warnings = [], periods = [], seen = new Set()
  for (const row of data.hit) {
    const number = Number(row.semestr), calendar = term(row.title)
    if (!Number.isSafeInteger(number) || number < 1 || number > 60 || seen.has(number) || !Array.isArray(row.coursesObligatory) || !Array.isArray(row.coursesOptional)) fail('source-changed', 'VID-studiemodellen har ugyldige eller gjentatte studiesemestre.')
    seen.add(number)
    const period = { id: String(number), studySemester: number, year: calendar?.year ?? null, semester: calendar?.semester ?? null, label: calendar ? periodLabel(number, calendar) : `${number}. studiesemester · avklar kalendersemester`, courses: [], requirements: [] }
    if (!calendar) warnings.push(`Studiesemester ${number}: kildens periode «${clean(row.title)}» må avklares av studenten.`)
    for (const [key, choice] of [['coursesObligatory', 'O'], ['coursesOptional', 'V']]) {
      if (row[key].length > 500) fail('source-changed', 'VID-semesteret inneholder flere emner enn importgrensen.')
      for (const course of row[key]) {
        const code = clean(course.code), name = clean(course.title)
        if (!code || !name || code.length > 80) fail('source-changed', 'VID-emneraden mangler en lesbar kode eller et navn.')
        const url = validate(new URL(course.href, origin)); if (!/^\/studier\/emner\//.test(url.pathname)) fail('source-changed', 'VID-emneraden lenker ikke til den offentlige emnekilden.')
        const linked = term(`${url.searchParams.get('semester') || ''} ${url.searchParams.get('year') || ''}`)
        const mismatch = calendar && linked && (linked.year !== calendar.year || linked.semester !== calendar.semester)
        if (mismatch) warnings.push(`${code}: emnelenkens semester avviker fra studiesemesteret. Kontroller emneversjonen i kilden.`)
        period.courses.push({ id: `vid:${program}:${description.year}:${way.id}:${number}:${code}`, code, name, credits: asCredits(course.points), choice, sourceProvider: 'vid-program', sourceRecordId: code, sourceVersion: `${description.year}:${number}`, sourceUrl: url.href, university: 'VID vitenskapelige høgskole', description: '', notes: mismatch ? 'Emnelenkens kalendersemester avviker fra studieplanen.' : '', year: period.year, semester: period.semester, campus: '', ...(mismatch ? { versionUncertain: true } : {}) })
      }
    }
    periods.push(period)
  }
  return { model: { id: way.id, name: clean(way.title), periods }, warnings }
}

export async function vidPrograms(institution, action, query, { fetchText }) {
  if (action === 'programs') {
    const data = await fetchVidCatalogue(fetchText), q = clean(query.q).toLocaleLowerCase('nb')
    return { status: 'ok', ...data, results: data.results.filter(row => (!q || `${row.code} ${row.name}`.toLocaleLowerCase('nb').includes(q)) && (!query.year || row.cohort === String(query.year))), warnings: [...data.warnings, 'Listen viser publiserte studieplaner for valgt startår. Hvert program kan ha flere studiesteder og studiemodeller.'] }
  }
  const source = planUrl(query.sourceUrl)
  if (!query.program || query.program.length > 200 || !/^[\p{L}\d_-]+$/u.test(query.program)) fail('invalid-selection', 'Velg program fra VID-listen.')
  const original = planUrl(`${origin}/studier/studieplaner/${encodeURIComponent(query.program)}`)
  const originalHtml = await cachedText(fetchText, original.href, validate), originalData = parseVidDescription(originalHtml)
  const siblings = originalData.otherSiblings.map(row => ({ ...row, url: planUrl(new URL(row.url, origin)).href }))
  if (source.href !== original.href && !siblings.some(row => row.url === source.href)) fail('invalid-selection', 'Den valgte studieplanen er ikke et publisert kull for VID-programmet.')
  if (action === 'program-cohorts') {
    const results = siblings.map(row => ({ cohort: String(row.year), label: `${clean(row.semester)} ${row.year}`, sourceUrl: row.url })).filter(row => /^\d{4}$/.test(row.cohort))
    return { status: 'ok', results, warnings: [], completeness: { complete: true, pages: 1, returned: results.length, scope: 'Kullene i programmets publiserte kullvelger.' } }
  }
  if (action !== 'program-plan') fail('not-supported', 'VID-programkilden støtter ikke handlingen.')
  const description = source.href === original.href ? originalData : parseVidDescription(await cachedText(fetchText, source.href, validate))
  if (String(description.year) !== String(query.cohort) || description.studyProgrammeUrl !== originalData.studyProgrammeUrl || !description.otherSiblings.some(row => row.selected && planUrl(new URL(row.url, origin)).href === source.href)) fail('invalid-selection', 'VID-kilden returnerte et annet program eller kull enn det som ble valgt.')
  if (!description.ways.length || description.ways.length > 40) fail('not-supported', 'VID har ingen lesbar studiemodell innenfor importgrensen. Bruk den publiserte planen eller dokumentimport.')
  const service = validate(new URL(description.serviceUrl, origin))
  if (service.pathname !== `${source.pathname.replace(/\/$/, '')}/_/service/vid.no/listStudyPlanWay` || !/^[a-f\d-]{36}$/i.test(service.searchParams.get('id') || '')) fail('source-changed', 'VID-planens kildeidentifikator stemmer ikke med valgt side.')
  const models = [], warnings = []
  for (const way of description.ways) {
    if (!clean(way.id) || way.id.length > 300) fail('source-changed', 'VID-studiemodellens identifikator er ugyldig.')
    const url = new URL(service); url.searchParams.set('way', way.id)
    const parsed = parseVidWay(await cachedText(fetchText, url.href, validate), { description, way, sourceUrl: source.href, program: query.program })
    models.push(parsed.model); warnings.push(...parsed.warnings)
  }
  const campus = description.infoTable?.find(row => row.title === 'intl_campus')?.content
  return { status: 'ok', program: { code: query.program, name: clean(description.title), cohort: String(description.year), sourceUrl: source.href, campuses: clean(campus) ? [clean(load(String(campus)).text())] : [] }, models, warnings: [...new Set([...warnings, 'Kildepubliserte studiemodeller og emner er hentet. Undervisningstider, grupper og personlige timeplaner er separate og ikke hentet fra denne kilden.'])], completeness: { complete: true, pages: models.length + 1, returned: models.reduce((n, model) => n + model.periods.flatMap(period => period.courses).length, 0), scope: 'Alle veivalg og perioder returnert av denne publiserte program- og kullsiden.' } }
}
