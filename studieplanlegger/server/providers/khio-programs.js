import { load, clean, fail, cachedText, restrictedUrl, collectPages, asCredits } from './program-source.js'
import { studentCohort } from './current-program-source.js'

const origin = 'https://khio.no', catalogue = `${origin}/studieprogrammer`
const text = value => clean(value).replace(/\u00ad/g, '')
const programmeUrl = input => restrictedUrl(input, { origin, paths: [/^\/studieprogrammer(?:\/[a-z\d-]+)?$/], keys: ['page'] })
const courseUrl = input => restrictedUrl(input, { origin, paths: [/^\/emner\/[a-z\d-]+$/] })
function guardedPage(fetchText, source, validator) {
  const expected = validator(source).href
  return cachedText(fetchText, expected, input => { const url = validator(input); if (url.href !== expected) fail('source-changed', 'KHiO videresendte til en annen program- eller emnekilde.'); return url })
}
const metadata = ($, label) => text($('main dt').filter((_i, node) => text($(node).text()) === label).first().next('dd').text())
export function parseKhioCatalogue($, current) {
  const results = []
  $('main a[href]').each((_i, node) => {
    const row = $(node), name = text(row.find('.deadline-list li').first().text())
    if (!name) return
    const url = programmeUrl(new URL(row.attr('href'), current)), code = url.pathname.split('/')[2]?.toUpperCase()
    if (!code || url.search) fail('source-changed', 'KHiOs programkort mangler en entydig programlenke.')
    results.push({ code, name, sourceUrl: url.href, campuses: [] })
  })
  if (!results.length) fail('source-changed', 'KHiOs programliste har ingen gjenkjennelige programkort.')
  return { results }
}
function describe(html, program, sourceUrl) {
  const $ = load(html), code = metadata($, 'Studieprogramkode'), name = text($('main h1').first().text())
  if (code !== program || new URL(sourceUrl).pathname !== `/studieprogrammer/${program.toLowerCase()}` || !name) fail('invalid-selection', 'KHiO-programkoden og den publiserte siden stemmer ikke overens.')
  const edition = text($('#studieplan p.small').first().text()).match(/studieplanen gjelder fra (høst|vår)semesteret (\d{4})/i)
  if (!edition || !$('#emnestruktur [role=tabpanel] table').length) fail('not-supported', 'KHiO-programmet mangler en støttet planutgave med emnestruktur. Programoppføringen alene er ikke programimport; bruk den publiserte planen i dokumentimport.')
  return { $, code, name, sourceEdition: `${edition[2]}${/^vår$/i.test(edition[1]) ? 'V' : 'H'}`, editionLabel: text($('#studieplan p.small').first().text()), sourceUrl }
}
export function parseKhioPlan(html, query, sourceUrl) {
  const cohort = studentCohort(query), info = describe(html, query.program, sourceUrl), { $ } = info, periods = []
  const tabs = $('#emnestruktur [role=tab]'), panels = $('#emnestruktur [role=tabpanel]'), planText = text($('#studieplan .content').clone().find('script,style').remove().end().text())
  if (tabs.length !== panels.length || !tabs.length) fail('source-changed', 'KHiOs studieår og emnetabeller kan ikke kobles entydig.')
  panels.each((index, node) => {
    const label = text($(tabs[index]).text()), year = label.match(/^År\s+(\d+)$/i)?.[1]
    if (!year || +year < 1 || +year > 20 || periods.some(period => period.sourceStudyYear === +year)) fail('source-changed', 'KHiOs kilde oppgir ikke en entydig studieårsinndeling.')
    const period = { id: `year-${year}`, sourceStudyYear: +year, studySemester: null, requiresStudentStudySemester: true, label: `${year}. studieår · oppgi studiesemester`, year: null, semester: null, courses: [], requirements: [info.editionLabel, `Kilden plasserer disse emnene i ${year}. studieår, ikke i et bestemt studiesemester. Velg bare emner som gjelder semesteret ditt. Studiepoengene gjelder hele emnet, også når det går over flere semestre.`] }
    const table = $(node).find('table'), headers = table.find('th').map((_i, node) => text($(node).text())).get()
    if (headers.join('|') !== 'Emnekode|Emnenavn|Studiepoeng') fail('source-changed', 'KHiOs emnetabell har endret kolonner.')
    table.find('tbody tr').each((_i, row) => {
      const cells = $(row).children('td'), code = text(cells.eq(0).text()), link = cells.eq(1).find('a[href]'), name = text(link.text())
      if (!/^[A-ZÆØÅ\d-]{2,20}$/.test(code) || !name || link.length !== 1) fail('source-changed', 'En KHiO-emnerad mangler entydig kode, navn eller kilde.')
      const url = courseUrl(new URL(link.attr('href'), sourceUrl)), credits = asCredits(text(cells.eq(2).text()))
      if (period.courses.some(course => course.code === code)) fail('source-changed', 'KHiO gjentar samme emne i et studieår. Kontroller kildeutvalget.')
      const choice = /^Valg\b/i.test(name) ? 'V' : /alle emne(?:r|ne) er obligatoriske/i.test(planText) ? 'O' : ''
      period.courses.push({ id: `khio-program:${info.code}:${cohort}:${year}:${code}`, code, name, credits, choice, courseGroup: `${year}. studieår`, year: null, semester: null, campus: '', university: 'Kunsthøgskolen i Oslo', description: '', notes: `${info.editionLabel} Kilden plasserer ${code} i ${year}. studieår. Studiesemester og kalendersemester må avklares; emnets studiepoeng gjelder hele emnet.`, requiresSemesterChoice: true, sourceProvider: 'khio-program', sourceRecordId: code, sourceVersion: info.sourceEdition, sourceUrl: url.href })
    })
    periods.push(period)
  })
  if (!periods.some(period => period.courses.length)) fail('not-supported', 'KHiO-programmets emnestruktur er tom.')
  return { status: 'ok', program: { code: info.code, name: info.name, cohort, cohortFromStudent: true, sourceEdition: info.sourceEdition, sourceUrl, campuses: [] }, models: [{ id: info.sourceEdition, name: `Publisert planutgave ${info.sourceEdition} · emner per studieår`, periods }], warnings: ['KHiO oppgir når planutgaven gjelder fra, men ikke en fullstendig liste over opptakskull. Ditt kull er en uttrykkelig avklaring og må kontrolleres mot planutgaven.', 'Emnestrukturen oppgir studieår. Studiesemester, kalenderår, vår/høst, valgemner og campus velges av deg. Ingen emner blir forhåndsvalgt på grunnlag av studieåret.', 'Undervisning og personlige grupper er separate fra studieplanen. Kalenderfil eller kalenderlenke kan importeres senere.'], completeness: { complete: false, pages: 1, returned: periods.reduce((n, period) => n + period.courses.length, 0), reason: 'Alle rader i den publiserte studieårsstrukturen er lest. Kull og semesterplassering er ikke bekreftet av denne kilden.' } }
}
export function parseKhioCourse(html, query, sourceUrl) {
  const $ = load(html), code = metadata($, 'Emnekode'), name = text($('main h1').first().text())
  if (code !== query.code || !name || !/^\d{4}$/.test(String(query.year)) || +query.year < 1900 || +query.year > 2200 || !['spring', 'autumn'].includes(query.semester)) fail('invalid-selection', 'KHiO-emnet stemmer ikke med valgt kode eller kalendersemester.')
  const description = $('main').clone(); description.find('script,style,nav').remove()
  const content = text(description.text())
  return { status: 'ok', course: { id: `khio:${code}:${query.year}:${query.semester}`, code, name, credits: asCredits(metadata($, 'Studiepoeng')), university: 'Kunsthøgskolen i Oslo', year: +query.year, semester: query.semester, campus: '', description: content, notes: 'Emnebeskrivelsen viser emnets innhold. Kalendersemesteret er valgt av studenten og bekreftes ikke av emnesiden.', sourceProvider: 'khio', sourceRecordId: code, sourceVersion: metadata($, 'Inngår i studieprogram') || 'current-public', sourceUrl }, warnings: ['Emnebeskrivelsen verifiserer ikke undervisningsdatoer, semesterplassering eller personlig gruppetilhørighet.'], calendarUrl: null }
}
export async function khioPrograms(institution, action, query, { fetchText }) {
  if (action === 'details') return khioDetails(query, fetchText)
  if (action === 'programs') {
    const data = await collectPages(catalogue, fetchText, input => { const url = programmeUrl(input); if (url.pathname !== '/studieprogrammer') fail('invalid-selection', 'KHiO-katalogen videresendte til en annen side.'); return url }, parseKhioCatalogue), q = text(query.q).toLocaleLowerCase('nb')
    return { status: 'ok', ...data, results: data.results.filter(program => !q || `${program.code} ${program.name}`.toLocaleLowerCase('nb').includes(q)) }
  }
  const source = programmeUrl(query.sourceUrl)
  if (source.search || !/^[A-Z\d-]+$/.test(query.program || '')) fail('invalid-selection', 'Velg en publisert KHiO-programside.')
  const html = await guardedPage(fetchText, source, programmeUrl), info = describe(html, query.program, source.href)
  if (action === 'program-cohorts') return { status: 'ok', results: [{ cohort: 'student', requiresStudentCohort: true, label: `Planutgave ${info.sourceEdition} · oppgi ditt opptakskull`, sourceUrl: source.href }], warnings: [info.editionLabel, 'Planutgavens startdato blir ikke brukt som ditt opptakskull.'] }
  if (action !== 'program-plan') fail('not-supported', 'Denne KHiO-handlingen er ikke støttet.')
  return parseKhioPlan(html, query, source.href)
}
export async function khioDetails(query, fetchText) {
  const source = courseUrl(query.sourceUrl)
  return parseKhioCourse(await guardedPage(fetchText, source, courseUrl), query, source.href)
}
