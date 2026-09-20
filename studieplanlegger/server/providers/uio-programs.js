import { load, clean, fail, cachedText, restrictedUrl } from './program-source.js'

const origin = 'https://www.uio.no'
const catalogueUrl = `${origin}/studier/program/`
const university = 'Universitetet i Oslo'

export function uioProgramUrl(input) {
  return restrictedUrl(input, { origin, paths: [
    /^\/studier\/program\/?$/,
    /^\/studier\/program\/[a-z0-9-]+\/(?:index\.html)?$/,
    /^\/studier\/program\/[a-z0-9-]+\/oppbygging\/(?:index\.html)?$/,
    /^\/studier\/emner\/[a-z0-9-]+\/[a-z0-9-]+\/[A-ZÆØÅ0-9-]+\/(?:index\.html)?$/i,
  ] })
}

const slugFrom = url => decodeURIComponent(url.pathname).match(/^\/studier\/program\/([^/]+)\//)?.[1] || ''
const canonicalProgram = input => {
  const url = uioProgramUrl(input), slug = slugFrom(url)
  if (!slug || /\/oppbygging\//.test(url.pathname)) fail('invalid-selection', 'Velg et program fra UiOs offentlige programliste.')
  return new URL(`/studier/program/${slug}/`, origin)
}

export function parseUioCatalogue(html) {
  const $ = load(html), found = new Map()
  $('a[href]').each((_index, node) => {
    let url
    try { url = canonicalProgram(new URL($(node).attr('href'), catalogueUrl)) } catch { return }
    const item = $(node).closest('li'), name = clean(item.find('h3').first().text() || $(node).text())
    if (!name) return
    const level = clean(item.find('.facet').toArray().map(entry => $(entry).text()).find(value => /bachelor|master|årsstud|profesjon|ph\.?d/i.test(value)) || '')
    found.set(url.href, { code: slugFrom(url), name, level, sourceUrl: url.href, campuses: [] })
  })
  if (!found.size) fail('source-changed', 'UiOs programkatalog har ingen lesbare programoppføringer.')
  return [...found.values()]
}

function tableCredits($, table) {
  const result = []
  $(table).find('tr').each((_index, row) => {
    const cells = $(row).children('td')
    if (!cells.length || !cells.toArray().every(cell => /studiepoeng/i.test(clean($(cell).text())))) return
    cells.each((_cellIndex, cell) => {
      const value = clean($(cell).text()).match(/(\d+(?:[.,]\d+)?)\s*studiepoeng/i)?.[1]
      result.push(value ? Number(value.replace(',', '.')) : null)
    })
  })
  return result
}

function courseLink($, node, query, studySemester, column, credits, choice) {
  const link = $(node), url = uioProgramUrl(new URL(link.attr('href'), origin))
  if (!/\/studier\/emner\//.test(url.pathname)) fail('source-changed', 'En emnelenke i UiO-planen peker utenfor den offentlige emnekatalogen.')
  const parts = decodeURIComponent(url.pathname).split('/').filter(Boolean)
  const code = parts.at(-1).toLowerCase() === 'index.html' ? parts.at(-2) : parts.at(-1)
  const label = clean(link.text()), name = clean(label.replace(new RegExp(`^${code}\\s*[–-]\\s*`, 'i'), '')) || code
  return { id: `uio:${query.program}:${studySemester}:${column}:${code}`, code, name, credits, choice,
    sourceProvider: 'uio-program', sourceRecordId: code, sourceVersion: 'current-public', sourceUrl: url.href,
    university, description: '', notes: `Gjeldende publisert oppbygging. Kilden knytter emnet til studiesemester ${studySemester}, men ikke til studentens opptakskull eller kalenderår.`, year: null, semester: null, campus: '' }
}

export function parseUioPlan(html, query, selected) {
  if (query.cohortFromStudent !== 'true' || !/^\d{4}$/.test(String(query.cohort)) || +query.cohort < 1900 || +query.cohort > 2200) fail('invalid-selection', 'Oppgi ditt opptakskull. UiOs gjeldende oppbygging er ikke en kullvelger.')
  const $ = load(html), parent = $('a[href]').filter((_index, node) => canonicalHref($(node).attr('href')) === selected.sourceUrl).first()
  const name = clean(parent.text()) || selected.name
  const table = $('table').filter((_index, node) => $(node).find('th').toArray().some(cell => /^\d+\.\s*semester$/i.test(clean($(cell).text())))).first()
  if (!table.length) fail('not-supported', 'UiOs oppbyggingsside har ingen støttet semestertabell. Bruk dokumentimport eller registrer emnene manuelt fra kilden.')
  const credits = tableCredits($, table), periods = []
  table.find('tr').each((_index, row) => {
    const match = clean($(row).children('th').first().text()).match(/^(\d+)\.\s*semester$/i)
    if (!match) return
    const studySemester = Number(match[1]), period = { id: String(studySemester), studySemester, year: null, semester: null, label: `${studySemester}. studiesemester · velg kalendersemester`, courses: [], requirements: [] }
    let column = 0
    $(row).children('td').each((_cellIndex, cell) => {
      const links = $(cell).find('a[href]').filter((_i, link) => /\/studier\/emner\//.test(String($(link).attr('href')))).toArray()
      const label = clean($(cell).text()), optional = /optional|specialization/i.test($(cell).attr('class') || '') || /fritt emne|fordypning|velg/i.test(label) || links.length > 1 && /\s(?:\/|eller)\s/i.test(label)
      const span = Math.max(1, Number($(cell).attr('colspan')) || 1)
      if (!links.length) { if (label) period.requirements.push(label); column += span; return }
      const points = credits.slice(column, column + span)
      const cellCredits = links.length === 1 && points.length === span && points.every(Number.isFinite) ? points.reduce((sum, value) => sum + value, 0) : null
      for (const link of links) {
        const item = courseLink($, link, query, studySemester, column, cellCredits, optional ? 'V' : 'O')
        if (!period.courses.some(course => course.code === item.code)) period.courses.push(item)
      }
      column += span
    })
    periods.push(period)
  })
  if (!periods.some(period => period.courses.length)) fail('not-supported', 'UiOs semestertabell inneholder ingen støttede emnelenker.')
  return { status: 'ok', program: { ...selected, name, cohort: String(query.cohort), cohortFromStudent: true, sourceEdition: 'current-public' }, models: [{ id: 'current-public', name: 'Gjeldende publisert oppbygging · kontroller mot ditt kull', periods }],
    warnings: ['UiO publiserer denne siden som gjeldende oppbygging uten en kullidentitet. Opptakskullet er oppgitt av studenten og må kontrolleres mot overgangsordninger.', 'Kalendersemester velges uttrykkelig. Frie emner og alternativer er valg; appen velger dem ikke.', 'Undervisning, campus og personlige grupper hentes ikke fra programoppbyggingen.'],
    completeness: { complete: false, pages: 1, returned: periods.reduce((sum, period) => sum + period.courses.length, 0), reason: 'Gjeldende side er ikke en historisk kullversjon, og åpne valg publiserer ikke en uttømmende personlig emneliste.' } }
}

function canonicalHref(value) {
  try { return canonicalProgram(new URL(value, origin)).href } catch { return '' }
}

export async function uioPrograms(_institution, action, query, { fetchText }) {
  const validateCatalogue = input => { const url = uioProgramUrl(input); if (url.href !== catalogueUrl) fail('source-changed', 'UiO videresendte programkatalogen.'); return url }
  const programs = parseUioCatalogue(await cachedText(fetchText, catalogueUrl, validateCatalogue))
  if (action === 'programs') {
    const q = clean(query.q).toLocaleLowerCase('nb')
    const results = programs.filter(item => !q || `${item.code} ${item.name}`.toLocaleLowerCase('nb').includes(q))
    return { status: 'ok', results, warnings: ['Listen er den komplette synlige programlisten i én offentlig katalogrespons. Et program må i tillegg ha en lesbar oppbyggingsside.'], completeness: { complete: true, pages: 1, returned: programs.length, scope: 'Alle unike programlenker i UiOs offentlige programkatalog.' } }
  }
  const selectedUrl = canonicalProgram(query.sourceUrl).href, selected = programs.find(item => item.code === query.program && item.sourceUrl === selectedUrl)
  if (!selected) fail('invalid-selection', 'Valgt UiO-program finnes ikke med samme identitet i den offentlige katalogen.')
  if (action === 'program-cohorts') return { status: 'ok', results: [{ cohort: 'student', requiresStudentCohort: true, label: 'Gjeldende oppbygging – oppgi ditt opptakskull', sourceUrl: selectedUrl }], warnings: ['UiO publiserer ikke kullvalg på denne oppbyggingssiden. Kontroller overgangsordninger for ditt kull.'], completeness: { complete: false, pages: 1, returned: 1, publishedCohorts: 0, reason: 'Kull må oppgis av studenten.' } }
  if (action !== 'program-plan') fail('not-supported', 'Denne UiO-handlingen er ikke støttet.')
  const planUrl = `${selectedUrl}oppbygging/`, guard = input => { const url = uioProgramUrl(input); if (url.href !== planUrl) fail('source-changed', 'UiO videresendte til en annen oppbyggingsside.'); return url }
  return parseUioPlan(await cachedText(fetchText, planUrl, guard), query, selected)
}
