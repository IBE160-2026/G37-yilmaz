import { load, clean, fail, cachedText, restrictedUrl, asCredits } from './program-source.js'
import { readNmhPdf, parseNmhPdf } from './nmh-pdf.js'

const origin = 'https://student.nmh.no', university = 'Norges musikkhøgskole'
const text = value => clean(value).replace(/\u00ad/g, '')
const bookYear = input => { const year = String(input || ''); if (!/^\d{4}$/.test(year) || +year < 1900 || +year > 2200) fail('invalid-selection', 'Velg et konkret år for NMHs startkullkatalog.'); return year }
const bookUrl = year => `${origin}/studiehandboker/startkull-${bookYear(year)}`
const sourceUrl = input => restrictedUrl(input, { origin, paths: [/^\/studiehandboker\/startkull-\d{4}(?:\/(?:studier|studieprogram|emner|valgemner(?:-\d{4}-\d{2})?)\/(?:nye-valgemner\/)?[a-z\d-]+)?$/] })
const cohortIn = url => url.pathname.match(/\/startkull-(\d{4})(?:\/|$)/)?.[1]
const metadata = ($, label) => text($('main dt').filter((_i, node) => text($(node).text()) === label).first().next('dd').text())
function guardedPage(fetchText, source) {
  const expected = sourceUrl(source).href
  return cachedText(fetchText, expected, input => { const url = sourceUrl(input); if (url.href !== expected) fail('source-changed', 'NMH videresendte til en annen plan- eller kullutgave.'); return url })
}
export function parseNmhCatalogue(html, year) {
  year = bookYear(year)
  const $ = load(html), programs = [], courses = [], seen = new Set()
  if (text($('main h1').text()) !== `Startkull ${year}`) fail('source-changed', 'NMHs katalog bekrefter ikke valgt startkull.')
  $('main a[href]').each((_i, node) => {
    const match = text($(node).text()).match(/^([A-ZÆØÅ\d-]+)\s+-\s+(.+)$/)
    if (!match) return
    const url = sourceUrl(new URL($(node).attr('href'), bookUrl(year)))
    if (cohortIn(url) !== year || seen.has(url.href)) return
    seen.add(url.href)
    const target = /\/(?:studier|studieprogram)\//.test(url.pathname) ? programs : /\/(?:emner|valgemner(?:-\d{4}-\d{2})?)\//.test(url.pathname) ? courses : null
    target?.push({ code: match[1], name: match[2], sourceUrl: url.href, sourceRecordId: match[1], sourceVersion: year, sourceCohort: year, campuses: [] })
  })
  if (!programs.length || !courses.length) fail('source-changed', 'NMHs startkullkatalog mangler gjenkjennelige program- eller emnelister.')
  return { programs, courses }
}
async function catalogue(fetchText, year) { return parseNmhCatalogue(await guardedPage(fetchText, bookUrl(year)), year) }
function describe(html, query, url) {
  const $ = load(html), code = metadata($, 'Studieprogramkode'), cohort = cohortIn(url), name = text($('main h1').first().text())
  if (!/\/(?:studier|studieprogram)\//.test(url.pathname) || code !== query.program || metadata($, 'Startkull') !== cohort || !name || (query.cohort && String(query.cohort) !== cohort)) fail('invalid-selection', 'NMHs programside bekrefter ikke valgt program og opptakskull.')
  return { $, code, name, cohort, sourceUrl: url.href }
}
export async function nmhPrograms(institution, action, query, { fetchText, fetchBytes }) {
  if (action === 'programs') {
    const year = bookYear(query.year), data = await catalogue(fetchText, year), q = text(query.q).toLocaleLowerCase('nb')
    return { status: 'ok', results: data.programs.filter(program => !q || `${program.code} ${program.name}`.toLocaleLowerCase('nb').includes(q)), sourceUrl: bookUrl(year), warnings: [`Katalogår ${year} betyr startkull ${year}, ikke kalendersemesteret du følger. Programlisten alene bekrefter ikke at programmets emneoversikt er publisert.`], completeness: { complete: true, pages: 1, returned: data.programs.length, scope: `Alle programlenker i NMHs offentlige startkullkatalog ${year}.` } }
  }
  const url = sourceUrl(query.sourceUrl), info = describe(await guardedPage(fetchText, url), query, url)
  if (action === 'program-cohorts') return { status: 'ok', results: [{ cohort: info.cohort, label: `Startkull ${info.cohort}`, sourceUrl: url.href }], warnings: ['Dette er det publiserte startkullet i den valgte katalogen. Bytt katalogår for å undersøke en annen kildeutgave.'] }
  if (action !== 'program-plan') fail('not-supported', 'Denne NMH-handlingen er ikke støttet.')
  const links = info.$('main a[href]').filter((_i, node) => /studieprogrambeskrivelsen.*emneoversikt|studieplan.*emneoversikt/i.test(text(info.$(node).text())))
  if (links.length !== 1) fail('not-supported', 'NMHs kildeutgave har ingen entydig publisert emneoversikt som importøren kan lese. Flere kontrollerte 2025- og 2026-programsider viser tom «Emneoversikt». Bruk offentlig emnesøk, dokumentimport eller manuell registrering; en eldre plan brukes ikke automatisk for ditt kull.')
  const pdfUrl = new URL(links.attr('href'), url), validatePdf = input => {
    const candidate = restrictedUrl(input, { origin: 'https://nmh-nettsted.s3.amazonaws.com', paths: [/^\/files\/Studieh%C3%A5ndb%C3%B8ker\/\d{4}\/[a-z\d%._()-]+\.pdf$/i] })
    if (!decodeURIComponent(candidate.pathname).includes(`/Studiehåndbøker/${info.cohort}/`) || candidate.href !== pdfUrl.href) fail('invalid-selection', 'PDF-lenken stemmer ikke med valgt NMH-kull og publisert kilde.')
    return candidate
  }
  validatePdf(pdfUrl)
  const fulltimeOnly = /Gjelder kun for heltidsstudiet/i.test(text(links.parent().text()))
  return parseNmhPdf(await readNmhPdf(fetchBytes, pdfUrl.href, validatePdf), { ...info, pdfUrl: pdfUrl.href, fulltimeOnly })
}
export async function searchNmh(query, fetchText) {
  const year = bookYear(query.year), q = text(query.q).toLocaleLowerCase('nb'), data = await catalogue(fetchText, year)
  return { status: 'ok', results: data.courses.filter(course => !q || `${course.code} ${course.name}`.toLocaleLowerCase('nb').includes(q)).map(course => ({ ...course, year: +year, semester: query.semester, campus: '', university })), warnings: [`Emnesøket bruker den offentlige katalogen for startkull ${year}. Det valgte kalendersemesteret bekreftes ikke av denne katalogen; kontroller kildeutgaven.`], completeness: { complete: true, pages: 1, returned: data.courses.length, scope: 'Alle emnelenker i valgt offentlig startkullkatalog; ingen antatt programtilhørighet.' } }
}
export async function nmhDetails(query, fetchText) {
  const url = sourceUrl(query.sourceUrl), cohort = cohortIn(url)
  if (!/\/(?:emner|valgemner(?:-\d{4}-\d{2})?)\//.test(url.pathname) || !['spring', 'autumn'].includes(query.semester)) fail('invalid-selection', 'Velg en publisert NMH-emneside og et kalendersemester.')
  const year = bookYear(query.year), $ = load(await guardedPage(fetchText, url)), code = metadata($, 'Emnekode'), name = text($('main h1').first().text())
  if (code !== query.code || metadata($, 'Startkull') !== cohort || !name) fail('invalid-selection', 'NMH-emnets kode eller kildekull stemmer ikke med valget.')
  const content = $('main').clone(); content.find('script,style,nav').remove()
  return { status: 'ok', course: { id: `nmh:${code}:${cohort}:${year}:${query.semester}`, code, name, credits: asCredits(metadata($, 'Studiepoeng')), university, campus: '', year: +year, semester: query.semester, description: text(content.text()), notes: `Emnebeskrivelsen gjelder startkull ${cohort}. Kalendersemesteret er valgt av studenten og må kontrolleres separat.`, sourceProvider: 'nmh', sourceRecordId: code, sourceVersion: cohort, sourceUrl: url.href }, warnings: ['Startkull i emnebeskrivelsen er ikke et bekreftet undervisningssemester. Velg undervisning og grupper separat fra den offentlige timeplanen.'], calendarUrl: null }
}
