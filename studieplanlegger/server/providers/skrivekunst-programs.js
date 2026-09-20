import { load, clean, fail, cachedText, restrictedUrl } from './program-source.js'

const origin = 'https://www.skrivekunst.no'
const source = `${origin}/arsstudium/`
const code = 'arsstudium-skapande-skriving'
const university = 'Skrivekunstakademiet'

export function skrivekunstProgramUrl(input) {
  const url = new URL(input.href || input)
  if (url.origin === 'https://skrivekunst.no') url.hostname = 'www.skrivekunst.no'
  return restrictedUrl(url, { origin, paths: [/^\/arsstudium\/?$/] })
}

export function parseSkrivekunstProgramme(html) {
  const $ = load(html), body = clean($('main').length ? $('main').text() : $('body').text())
  const title = clean($('.entry-title').first().text() || $('main h1').first().text())
  const edition = body.match(/studieåret\s+(\d{2})\s*\/\s*(\d{2})/i)
  if (!/^Årsstudium$/i.test(title) || !/Årsstudium i skapande skriving\s*\(60\s*stp\.?\)/i.test(body)) fail('source-changed', 'Skrivekunstakademiets side bekrefter ikke det publiserte årsstudiet på 60 studiepoeng.')
  if (!/fulltidsstudium over to semest(?:er|re),\s*haust og vår/i.test(body) || !/undervisninga er obligatorisk og finn stad i Bergen/i.test(body)) fail('source-changed', 'Årsstudiets varighet eller studiested kan ikke bekreftes fra den publiserte siden.')
  if (!edition) fail('not-supported', 'Den publiserte siden mangler et entydig studieår. Velg manuell registrering eller dokumentimport.')
  const start = 2000 + Number(edition[1]), end = 2000 + Number(edition[2])
  if (end !== start + 1) fail('source-changed', 'Skrivekunstakademiets publiserte studieår har et ukjent intervall.')
  const sourceEdition = `${start}/${String(end).slice(-2)}`
  const name = 'Årsstudium i skapande skriving'
  return {
    program: { code, name, sourceUrl: source, campuses: ['Bergen'] },
    cohort: String(start),
    sourceEdition,
    model: {
      id: `published-${start}-${end}`,
      name: `Publisert årsstudium ${sourceEdition}`,
      periods: [{
        id: 'studiesemester-1-2',
        studySemester: null,
        requiresStudentStudySemester: true,
        allowedStudySemesters: [1, 2],
        allowedCalendarPeriodsByStudySemester: {
          1: { year: start, semester: 'autumn' },
          2: { year: end, semester: 'spring' }
        },
        year: null,
        semester: null,
        label: 'Hele årsstudiet · velg 1. eller 2. studiesemester',
        courses: [{
          id: `skrivekunst:${code}:${sourceEdition}`,
          code: '',
          name,
          credits: 60,
          choice: 'O',
          sourceProvider: 'skrivekunst-program',
          sourceRecordId: code,
          sourceVersion: sourceEdition,
          sourceUrl: source,
          university,
          description: '',
          notes: `Publisert studieår ${sourceEdition}. Dette er én samlet programenhet over studiesemester 1 og 2; studiepoengene gjelder hele årsstudiet. Kildens praktiske, teoretiske og formidlende deler er innholdskomponenter, ikke separate emner.`,
          year: null,
          semester: null,
          campus: 'Bergen',
          spansStudySemesters: [1, 2],
          requiresSemesterChoice: true
        }],
        requirements: [`Kilden knytter 1. studiesemester til høst ${start} og 2. studiesemester til vår ${end}. Ingen underemner, undervisningsdatoer, oppgaver eller eksamensfrister er publisert som importbare oppføringer.`]
      }]
    }
  }
}

export async function skrivekunstPrograms(institution, action, query, { fetchText }) {
  if (institution !== 'skrivekunst') fail('invalid-selection', 'Velg Skrivekunstakademiet.')
  const parsed = parseSkrivekunstProgramme(await cachedText(fetchText, source, skrivekunstProgramUrl))
  if (action === 'programs') {
    const q = clean(query.q).toLocaleLowerCase('nb'), visible = !q || `${parsed.program.code} ${parsed.program.name}`.toLocaleLowerCase('nb').includes(q)
    return { status: 'ok', results: visible ? [parsed.program] : [], warnings: ['Kilden publiserer ett studiepoenggivende årsstudium. Påbyggingskurset er et kurs og inngår ikke i programlisten.'], completeness: { complete: true, pages: 1, returned: 1, scope: 'Det ene publiserte studiepoenggivende årsstudiet.' } }
  }
  if (query.program !== code || skrivekunstProgramUrl(query.sourceUrl).href !== source) fail('invalid-selection', 'Velg årsstudiet fra Skrivekunstakademiets publiserte programside.')
  if (action === 'program-cohorts') return { status: 'ok', results: [{ cohort: parsed.cohort, label: `Studieåret ${parsed.sourceEdition}`, sourceUrl: source }], warnings: ['Studieåret beskriver den publiserte ettårsutgaven. Kalendersemester velges separat.'] }
  if (action !== 'program-plan') fail('not-supported', 'Denne Skrivekunstakademiet-handlingen støttes ikke.')
  if (String(query.cohort) !== parsed.cohort) fail('invalid-selection', 'Den publiserte siden bekrefter ikke valgt studieår.')
  return { status: 'ok', program: { ...parsed.program, cohort: parsed.cohort, sourceEdition: parsed.sourceEdition }, models: [parsed.model], warnings: ['Årsstudiet er én samlet 60-studiepoengsenhet over høst og vår. Kilden publiserer ikke formelle underemner eller emnekoder, og slike er ikke opprettet.', 'Studenten velger faktisk studiesemester og kalendersemester. Ingen undervisningsdato, personlig gruppe eller eksamensfrist er utledet.'], completeness: { complete: true, pages: 1, returned: 1, scope: 'Hele det publiserte årsstudiet som én flersemester-programenhet; ingen oppdiktede underemner.' } }
}
