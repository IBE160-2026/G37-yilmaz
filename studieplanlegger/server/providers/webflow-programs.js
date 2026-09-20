import { createHash } from 'node:crypto'
import { load, clean, fail, cachedText, restrictedUrl, collectPages, asCredits } from './program-source.js'

const sources = {
  steiner: { origin: 'https://www.steinerhoyskolen.no', catalogue: '/for-studenter/ressurser', name: 'Steinerhøyskolen', plan: /^\/studier\/[^/]+\/?$/ },
  hfdk: { origin: 'https://www.hfdk.no', catalogue: '/for-studenter/studieplan-og-emner', name: 'Høyskolen for dansekunst', plan: /^\/for-studenter\/studieplan-og-emner\/?$/ },
}
export function webflowProgramUrl(input, institution) {
  const source = sources[institution]
  if (!source) fail('invalid-selection', 'Ukjent lærested.')
  return restrictedUrl(input, { origin: source.origin, paths: [source.plan, /^\/for-studenter\/ressurser\/?$/], keys: ['page'] })
}
const keyFor = url => decodeURIComponent(url.pathname.replace(/\/$/, '').split('/').at(-1))
const stableName = name => createHash('sha256').update(clean(name).toLocaleLowerCase('nb')).digest('hex').slice(0, 20)
function visibleDocument(html) {
  const $ = load(html)
  // Webflow renders disabled semester copies and language variants in the HTML.
  // Accordion height is not a content filter; only explicit hidden content is.
  $('script,style,.w-condition-invisible,[hidden],[lang="En"]').remove()
  return $
}
function programName($, institution) {
  if (institution === 'steiner') return clean($('.study_introduction h1').first().text() || $('h1').first().text())
  return clean($.root().text()).match(/studiet\s+(bachelor i [^,.]+?)\s+gi studentene/i)?.[1] || ''
}
function course(source, query, studyYear, values) {
  const record = values.code || stableName(values.name)
  return { id: `${query.institution}:${query.program}:${studyYear}:${record}`, code: '', description: '', credits: null,
    ...values, sourceProvider: query.institution, sourceRecordId: `${query.program}:${record}`, sourceVersion: 'published',
    sourceUrl: query.sourceUrl, university: source.name, year: null, semester: null, campus: '', choice: '',
    notes: values.notes || 'Emnet står i publisert oppbygging. Oppbyggingen bekrefter ikke opptakskull eller at emnet er obligatorisk for alle.' }
}
function period(number, requirements = []) {
  return { id: String(number), studySemester: number, label: `${number}. studiesemester · velg kalendersemester`, year: null, semester: null, courses: [], requirements }
}
function steinerPeriods($, source, query) {
  const periods = new Map()
  $('.studieaar').each((_, block) => {
    const year = Number(clean($(block).find('h4').first().text()).match(/^(\d+)\.\s*studieår/i)?.[1])
    if (!year || year > 20) return
    $(block).find('[table]').each((_, column) => {
      const term = $(column).attr('table')
      const entries = $(column).find('.emne_filter')
      if (!entries.length) return
      if (!['fall', 'spring', 'both'].includes(term)) fail('source-changed', 'Semesterkolonnen har et ukjent format.')
      const numbers = term === 'both' ? [year * 2 - 1, year * 2] : [year * 2 - (term === 'fall' ? 1 : 0)]
      for (const number of numbers) {
        if (!periods.has(number)) periods.set(number, period(number))
        const target = periods.get(number)
        entries.each((_, row) => {
          const name = clean($(row).find('.emne_name').text()), code = clean($(row).find('.emne_code').text())
          const points = asCredits($(row).find('.course_points > div').first().text())
          if (!name) fail('source-changed', 'En publisert emnerad mangler navn.')
          if (/^(valgbar|valgfri|valgemner?|fordypningsvalg)\b/i.test(name) && !code) {
            target.requirements.push(`${name}${points === null ? '' : `: ${points} studiepoeng`}. Velg det konkrete emnet fra dokumentene; valgområdet er ikke et emne.`)
            return
          }
          const text = `${year}. studieår, ${term === 'both' ? 'høst og vår' : term === 'fall' ? 'høst' : 'vår'}. ${term === 'both' ? 'Studiepoengene gjelder hele emnet over to semestre, ikke hvert semester. ' : ''}Kull og kalenderår må kontrolleres av studenten.`
          const item = course(source, query, year, { code, name, credits: points, notes: text })
          if (!target.courses.some(existing => existing.sourceRecordId === item.sourceRecordId)) target.courses.push(item)
        })
      }
    })
  })
  return [...periods.values()].sort((a, b) => a.studySemester - b.studySemester)
}
function hfdkPeriods($, source, query) {
  const root = $('h2').filter((_, node) => /^Studieløp$/i.test(clean($(node).text()))).first().parent(), periods = []
  root.find('.div-block-130').each((_, block) => {
    const year = Number(clean($(block).find('strong').first().text()).match(/^(\d+)\.\s*år$/i)?.[1])
    if (!year || year > 20) fail('source-changed', 'Studieåret i emneoversikten er uklart.')
    const lines = selector => {
      const content = $(block).find(selector).clone(); content.find('br').replaceWith('\n')
      return content.text().split('\n').map(clean).filter(Boolean)
    }
    const names = lines('.text-block-84.studiel-p'), credits = lines('.text-block-85.studiel-p')
    if (!names.length || names.length !== credits.length || credits.some(value => asCredits(value) === null)) fail('source-changed', 'Navn og studiepoeng i årsoversikten stemmer ikke overens.')
    const notes = `${year}. studieår. Kilden fordeler ikke emnene mellom høst og vår. Velg bare emnene som gjelder ditt studiesemester. Studiepoeng gjelder hele årsemnet.`
    for (const number of [year * 2 - 1, year * 2]) {
      const target = period(number, [notes]); target.label = `${number}. studiesemester · avklar emner fra ${year}. studieår`
      target.courses = names.map((name, index) => ({ ...course(source, query, year, { name, credits: asCredits(credits[index]), notes }), requiresSemesterChoice: true }))
      periods.push(target)
    }
  })
  return periods
}
export function parseWebflowPlan(html, institution, query) {
  const source = sources[institution], url = webflowProgramUrl(query.sourceUrl, institution)
  if (!source.plan.test(url.pathname) || keyFor(url) !== query.program) fail('invalid-selection', 'Program og kildelenke stemmer ikke overens.')
  if (query.cohortFromStudent !== 'true' || !/^\d{4}$/.test(String(query.cohort)) || +query.cohort < 1900 || +query.cohort > 2200) fail('invalid-selection', 'Oppgi ditt opptakskull. Programmet har ingen publisert kullvelger.')
  const $ = visibleDocument(html), name = programName($, institution)
  const input = { ...query, institution, sourceUrl: url.href }
  const periods = institution === 'steiner' ? steinerPeriods($, source, input) : hfdkPeriods($, source, input)
  if (!name || !periods.some(item => item.courses.length)) fail('not-supported', 'Denne programsiden har ingen støttet emneoppbygging. Bruk dokumentimport eller registrer emnene manuelt fra kilden.')
  const campus = institution === 'steiner' ? clean($('.detailes_item').filter((_, item) => /^(Sted|Location):/i.test(clean($(item).find('.details_description').text()))).find('.details_value').text()) : ''
  return { status: 'ok', program: { code: query.program, name, cohort: String(query.cohort), cohortFromStudent: true, sourceUrl: url.href, campuses: campus ? [campus] : [] },
    models: [{ id: 'published', name: 'Publisert emneoppbygging', periods }],
    warnings: ['Kull og kalendersemester er studentens avklaring; programsiden bekrefter ikke en historisk kullversjon.', 'Emnetype må bekreftes av studenten. Valgområder blir ikke opprettet som oppdiktede emner.', institution === 'hfdk' ? 'Årsoversikten oppgir ikke studiesemester. De valgte emnene knyttes til semesteret du avklarer.' : 'Emner som går over høst og vår beholder hele emnets studiepoeng.', 'Undervisning, grupper og personlige timeplaner er ikke hentet fra programoppbyggingen.'],
    completeness: { complete: false, pages: 1, returned: periods.reduce((n, item) => n + item.courses.length, 0), reason: 'Kullversjon, fullstendige valgemner og undervisning er ikke dokumentert av denne kilden.' } }
}
export async function webflowPrograms(institution, action, query, { fetchText }) {
  const source = sources[institution], catalogue = `${source.origin}${source.catalogue}`, validate = url => webflowProgramUrl(url, institution)
  if (action === 'programs') {
    const data = await collectPages(catalogue, fetchText, validate, (_$, url) => {
      const $ = visibleDocument(_$.html()), results = new Map()
      if (institution === 'hfdk') {
        const name = programName($, institution)
        if (name) results.set(url, { code: keyFor(new URL(url)), name, sourceUrl: url, campuses: [] })
      } else $('a[href]').each((_, link) => {
        const target = new URL($(link).attr('href'), url)
        if (target.origin !== source.origin || !source.plan.test(target.pathname)) return
        const selected = validate(target), name = clean($(link).text())
        if (name) results.set(selected.href, { code: keyFor(selected), name, sourceUrl: selected.href, campuses: [] })
      })
      if (!results.size) fail('source-changed', 'Katalogen har ingen lesbare studielenker.')
      return { results: [...results.values()] }
    })
    const q = clean(query.q).toLocaleLowerCase('nb')
    return { status: 'ok', ...data, results: data.results.filter(item => !q || `${item.code} ${item.name}`.toLocaleLowerCase('nb').includes(q)), warnings: [...data.warnings, 'Listen viser offentlige studiesider. Import krever at den valgte siden publiserer en støttet emneoppbygging.'] }
  }
  const url = validate(query.sourceUrl)
  if (!source.plan.test(url.pathname) || keyFor(url) !== query.program) fail('invalid-selection', 'Velg et program fra den offentlige listen.')
  if (action === 'program-cohorts') return { status: 'ok', results: [{ cohort: 'student', requiresStudentCohort: true, label: 'Oppgi ditt opptakskull – ikke verifisert av kilden', sourceUrl: url.href }], warnings: ['Kilden har ingen offentlig kullvelger.'] }
  if (action !== 'program-plan') fail('not-supported', 'Handlingen støttes ikke av denne programimportøren.')
  const guard = input => { const next = validate(input); if (next.pathname !== url.pathname) fail('source-changed', 'Programmet videresendte til en annen side.'); return next }
  return parseWebflowPlan(await cachedText(fetchText, url.href, guard), institution, query)
}
