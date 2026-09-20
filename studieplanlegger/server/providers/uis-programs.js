import { load, clean, fail, cachedText, collectPages, restrictedUrl, asCredits } from './program-source.js'

const origin = 'https://www.uis.no'
const catalogue = `${origin}/nb/student/studieprogram-og-emner`
export const uisProgramUrl = input => restrictedUrl(input, { origin, paths: [/^\/nb\/student\/studieprogram-og-emner$/, /^\/(?:nb|en)\/studieprogram-og-emner\/[\p{L}\d%_-]+$/u, /^\/(?:nb|en)\/fs\/lazy\/study-plan\/\d+$/, /^\/(?:nb|en)\/student\/course\/[\p{L}\d%_-]+$/u], keys: ['page','semester'] })
function pageUrl(input) {
  const url = uisProgramUrl(input)
  if (!/^\/(?:nb|en)\/studieprogram-og-emner\//.test(url.pathname) || [...url.searchParams.keys()].some(key => key !== 'semester') || url.searchParams.has('semester') && !/^\d{4}[HV]$/.test(url.searchParams.get('semester'))) fail('invalid-selection', 'Velg en publisert UiS-programside og planutgave.')
  return url
}
export function parseUisCatalogue($, current) {
  if (!$('.study-program-search__link, .course-search__link, .view-study-search').length) fail('source-changed', 'UiS-katalogens resultatstruktur er endret.')
  const results = []
  $('.study-program-search__link').each((_, node) => {
    const row = $(node), code = clean(row.find('.study-program-search__code').text()), name = clean(row.find('.study-program-search__title').text())
    if (!code || !name || code.length > 100) fail('source-changed', 'UiS-katalogen har en programrad uten kode eller navn.')
    const source = pageUrl(new URL(row.attr('href'), current))
    results.push({ code, name, sourceUrl: source.href, campuses: [] })
  })
  return { results }
}
function describePage(html, query, source) {
  const $ = load(html), selectedCode = clean($('#fs-semester-select').attr('data-code'))
  if (!selectedCode || selectedCode !== query.program) fail('invalid-selection', 'UiS-programsiden samsvarer ikke med den valgte programkoden.')
  const name = clean($('h1').first().text()), selector = $('#study-plan-year-switcher'), endpoint = selector.attr('hx-get')
  if (!name || !endpoint || selector.attr('name') !== 'semester') fail('not-supported', 'UiS-programmet publiserer ikke en støttet emnemodell. Programbeskrivelsen og eldre PDF-utgaver kan fortsatt brukes i dokumentimport.')
  const url = uisProgramUrl(new URL(endpoint, source))
  if (!/^\/(?:nb|en)\/fs\/lazy\/study-plan\/\d+$/.test(url.pathname) || url.search) fail('source-changed', 'UiS-studieplanens publiserte lesekilde har endret format.')
  const editions = selector.find('option').toArray().map(option => ({ edition: $(option).val(), label: clean($(option).text()) }))
  if (!editions.length || editions.some(item => !/^\d{4}[HV]$/.test(item.edition))) fail('source-changed', 'UiS-planen mangler gjenkjennelige kildeutgaver.')
  return { name, code: selectedCode, endpoint: url.href, editions }
}
export function parseUisPlan(html, { program, cohort, sourceUrl, edition, name }) {
  const $ = load(html), wrapper = $('.subject-list-wrapper'), identity = wrapper.attr('data-study-program-url')
  if (!identity || decodeURIComponent(identity).split('#')[0] !== `/nb/study/${program}` || !wrapper.find('.semester-block').length) fail('source-changed', 'UiS returnerte ikke den valgte programmets emnemodell.')
  const periods = [], warnings = []
  wrapper.find('.semester-block').each((_, node) => {
    const block = $(node), number = Number(block.attr('data-sem'))
    if (!Number.isInteger(number) || number < 1 || number > 40 || periods.some(period => period.studySemester === number)) fail('source-changed', 'UiS-modellen har ugyldige eller gjentatte studiesemestre.')
    const period = { id: `${edition}:${number}`, studySemester: number, year: null, semester: null, label: `${number}. studiesemester · kalendersemester må avklares`, courses: [], requirements: [] }
    block.find('.course-group').each((_, groupNode) => {
      const group = $(groupNode), label = clean(group.find('.course-group__title').first().text()), description = clean(group.find('.course-group__description').first().text())
      if (label || description) period.requirements.push([label, description].filter(Boolean).join(': '))
    })
    block.find('a.subject-list-item').each((_, courseNode) => {
      const row = $(courseNode), code = clean(row.find('.code').text()), courseName = clean(row.find('.subject-list-item__title').text()), group = row.closest('.course-group')
      if (!code || !courseName || code.length > 100) fail('source-changed', 'En UiS-emnerad mangler kode eller navn.')
      const linked = new URL(row.attr('href'), origin), planPath = new URL(sourceUrl).pathname
      if (linked.origin === origin && linked.pathname === `${planPath}/exchange` && !linked.search && !linked.hash) {
        period.requirements.push(`${courseName} (${code}): utvekslingsplass, ikke et navngitt emne. Avklar innhold i studieplanen.`)
        return
      }
      const url = uisProgramUrl(new URL(row.attr('href'), origin))
      if (decodeURIComponent(url.pathname) !== `/nb/student/course/${code}` || url.search) fail('source-changed', 'UiS-emnekoden og emnelenken avviker.')
      let requires
      try { requires = JSON.parse(row.attr('data-requires') || '[]') } catch { fail('source-changed', 'UiS-emnets vilkår er uleselige.') }
      if (!Array.isArray(requires)) fail('source-changed', 'UiS-emnets vilkår har endret format.')
      const credits = asCredits(clean(row.find('.credits').text()).replace(/\s*studiepoeng$/i, ''))
      const choice = group.hasClass('elective') || requires.length ? 'V' : group.attr('data-group') === 'mandatory' && /^Obligatoriske emner$/i.test(clean(group.find('.course-group__title').first().text())) ? 'O' : ''
      const notes = [clean(group.find('.course-group__title').first().text()), clean(group.find('.course-group__description').first().text()), clean(row.find('.semesters').text()), requires.length ? `Kildepubliserte vilkår: ${JSON.stringify(requires)}` : ''].filter(Boolean).join('. ')
      if (period.courses.some(course => course.code === code)) fail('source-changed', 'Samme UiS-emne forekommer flere ganger i semesteret. Avklar alternative emnegrupper i kilden.')
      period.courses.push({ id: `uis:${program}:${edition}:${number}:${code}`, code, name: courseName, credits, choice, year: null, semester: null, campus: '', university: 'Universitetet i Stavanger', description: '', notes, sourceUrl: url.href, sourceProvider: 'uis-program', sourceRecordId: code, sourceVersion: edition })
      if (credits === null) warnings.push(`${code}: studiepoeng mangler i denne semesterkolonnen. Ukjent verdi er beholdt.`)
    })
    periods.push(period)
  })
  if (!periods.some(period => period.courses.length)) fail('not-supported', 'UiS-modellen har ingen navngitte emner i publiserte studiesemestre.')
  return { status: 'ok', program: { code: program, name, cohort: String(cohort), cohortFromStudent: true, sourceEdition: edition, sourceUrl, campuses: [] }, models: [{ id: edition, name: `Publisert planutgave ${edition}`, periods }], warnings: [...new Set([...warnings, 'Planutgaven gjelder et studieår; den bekrefter ikke ditt opptakskull eller kalenderåret for hvert studiesemester. Oppgi kull, år og semester selv.', 'Obligatoriske emner med særskilte publiserte vilkår krever ditt valg. Campus, fullstendige emnebeskrivelser, undervisning og personlig tilhørighet er ikke hentet.'])], completeness: { complete: true, pages: 1, returned: periods.reduce((count, period) => count + period.courses.length, 0), scope: 'Alle emner i den valgte kildeutgavens returnerte semesterblokker; kalenderår og studentens kull er avklaringer.' } }
}
export async function uisPrograms(institution, action, query, { fetchText }) {
  if (action === 'programs') {
    const guard = input => { const url = uisProgramUrl(input); if (url.pathname !== new URL(catalogue).pathname || [...url.searchParams.keys()].some(key => key !== 'page')) fail('source-changed', 'UiS-katalogen videresendte til et annet kildeutvalg.'); return url }
    const result = await collectPages(catalogue, fetchText, guard, parseUisCatalogue)
    const q = clean(query.q).toLocaleLowerCase('nb')
    return { status: 'ok', ...result, results: result.results.filter(row => !q || `${row.code} ${row.name}`.toLocaleLowerCase('nb').includes(q)), warnings: [...result.warnings, 'UiS-programmer i den nåværende offentlige emne-/studiekatalogen. Programutgaver, studentens kull og kalendersemester avklares separat.'] }
  }
  const source = pageUrl(query.sourceUrl), page = describePage(await cachedText(fetchText, source.href, pageUrl), query, source)
  if (action === 'program-cohorts') return { status: 'ok', results: page.editions.map(item => { const url = new URL(source); url.searchParams.set('semester', item.edition); return { cohort: item.edition, label: `${item.label} · planutgave, oppgi eget kull`, sourceUrl: url.href, requiresStudentCohort: true } }), warnings: ['Velgeren viser kildepubliserte studieår, ikke et bekreftet opptakskullarkiv. Eldre PDF-beskrivelser finnes separat i kilden.'] }
  if (action !== 'program-plan') fail('not-supported', 'UiS-programkilden støtter ikke handlingen.')
  if (query.cohortFromStudent !== 'true' || !/^\d{4}$/.test(String(query.cohort)) || +query.cohort < 1900 || +query.cohort > 2200) fail('invalid-selection', 'Oppgi ditt opptakskull uttrykkelig; kildeutgaven skal ikke bli et antatt kull.')
  const edition = source.searchParams.get('semester')
  if (!page.editions.some(item => item.edition === edition)) fail('invalid-selection', 'Velg en planutgave fra UiS-kildens årvelger.')
  const endpoint = new URL(page.endpoint); endpoint.searchParams.set('semester', edition)
  const guard = input => { const next = uisProgramUrl(input); if (next.href !== endpoint.href) fail('source-changed', 'UiS-planen videresendte til et annet program eller studieår.'); return next }
  return parseUisPlan(await cachedText(fetchText, endpoint.href, guard), { program: page.code, name: page.name, cohort: query.cohort, sourceUrl: source.href, edition })
}
