import { load, clean, fail, cachedText, restrictedUrl, asCredits } from './program-source.js'

const origin = 'https://www.nla.no'
const catalogue = `${origin}/for-studenter/Studie-%20og%20emneplaner`
const prefix = '(?:/your-studies|/for-studenter/Studie-%20og%20emneplaner)'
const planPath = new RegExp(`^${prefix}/studieplan/([^/]+)(?:/(\\d{4}(?:-\\d{4})?))?/?$`)
const coursePath = new RegExp(`^${prefix}/emneplan/[^/]+(?:/\\d{4}(?:-\\d{4})?)?/?$`)
const validate = input => restrictedUrl(input, { origin, paths: [/^\/for-studenter\/Studie-%20og%20emneplaner\/?$/, planPath, coursePath] })
function ref(input) { const url = validate(input), match = url.pathname.match(planPath); if (!match) fail('invalid-selection', 'Velg en publisert studieplan fra NLA-katalogen.'); return { url, code: decodeURIComponent(match[1]), cohort: match[2] || '' } }
function props(html, type) {
  const $ = load(html); let found
  $('script[type="application/json"][data-react4xp-app-name="no.seeds.nla"]').each((_, element) => {
    let data; try { data = JSON.parse($(element).text()) } catch { return }
    if (data.jsxPath === type) found = data.props
  })
  if (!found) fail('source-changed', 'NLA-siden mangler det publiserte dataformatet. Åpne kilden eller bruk dokumentimport.')
  return found
}
export function parseNlaCatalogue(html) {
  const data = props(html, 'site/layouts/courses-overview-fs/courses-overview-fs').data
  if (!Array.isArray(data) || data.length > 5000) fail('source-changed', 'NLA-katalogen har endret struktur eller overskrider 5000 oppføringer.')
  const results = new Map()
  for (const item of data) {
    if (!item.href?.includes('/studieplan/')) continue
    const source = ref(item.href)
    if (!clean(item.title)) continue
    results.set(source.url.href, { code: source.code, name: clean(item.title), sourceUrl: source.url.href, campuses: [] })
  }
  return [...results.values()]
}
export function parseNlaCohorts(html, sourceUrl) {
  const data = props(html, 'StudieplanPage'), selected = ref(sourceUrl)
  const options = data.dropdown?.options
  if (!Array.isArray(options)) fail('source-changed', 'NLA-kilden har ingen publisert kullvelger.')
  const base = selected.url.href.replace(/\/\d{4}(?:-\d{4})?\/?$/, '').replace(/\/$/, '')
  return options.filter(option => /^\d{4}(?:-\d{4})?$/.test(option.value)).map(option => ({ cohort: option.value, label: clean(option.label), sourceUrl: `${base}/${option.value}` }))
}
export function matrix($, table) {
  const grid = []
  $(table).find('tr').filter((_, tr) => $(tr).closest('table')[0] === table).each((rowIndex, tr) => {
    if (rowIndex >= 120) fail('source-changed', 'Studietabellen er større enn importgrensen.')
    grid[rowIndex] ||= []; let column = 0
    $(tr).children('th,td').each((_, cell) => {
      while (grid[rowIndex][column]) column++
      const rows = Math.max(1, Number($(cell).attr('rowspan')) || 1), cols = Math.max(1, Number($(cell).attr('colspan')) || 1)
      if (rows > 60 || cols > 60 || column + cols > 120) fail('source-changed', 'Studietabellen har en ukjent oppbygning.')
      for (let r = rowIndex; r < rowIndex + rows; r++) { grid[r] ||= []; for (let c = column; c < column + cols; c++) grid[r][c] = cell }
      column += cols
    })
  })
  return grid
}
function semesterNumber(text) { const match = clean(text).match(/^(?:(\d{1,2})\.?\s*(?:studie)?semester|semester\s*(\d{1,2}))(?:\b|\s)/i); return match ? Number(match[1] || match[2]) : null }
export function parseNlaPlan(html, sourceUrl, cohort) {
  const data = props(html, 'StudieplanPage'), source = ref(sourceUrl), selected = String(cohort || source.cohort || data.dropdown?.selected || '')
  const item = data.items?.[selected]
  if (!item || String(data.dropdown?.selected) !== selected) fail('source-changed', 'NLA har ikke returnert det valgte kullet. En annen planversjon blir ikke importert som ditt kull.')
  const facts = new Map((item.table?.list || []).map(row => [clean(row.title).replace(/:$/, ''), clean(load(row.content || '').text())]))
  if (facts.get('Studieprogramkode') && facts.get('Studieprogramkode') !== source.code) fail('source-changed', 'Programkoden stemmer ikke med valgt NLA-plan.')
  const statedCohort = facts.get('Kull')?.match(/\d{4}/)?.[0]
  if (statedCohort && statedCohort !== selected.slice(0, 4)) fail('source-changed', 'Kullet i planinnholdet stemmer ikke med det valgte året.')
  const campuses = [], campusFact = item.table?.list?.find(row => /studiested/i.test(row.title))
  if (campusFact) { const $ = load(campusFact.content || ''); $('a').each((_, a) => { if (clean($(a).text())) campuses.push(clean($(a).text())) }); if (!campuses.length && clean($.text())) campuses.push(clean($.text())) }
  const known = new Map(), sections = item.accordions || []
  for (const section of sections.filter(section => /emneoversikt/i.test(section.title))) {
    const $ = load(section.content || '')
    $('a[href]').each((_, link) => {
      const href = $(link).attr('href'); if (!href.includes('/emneplan/')) return
      const url = validate(new URL(href, origin)), code = clean($(link).text()), line = clean($(link).parent().text())
      if (!/^[A-ZÆØÅa-z\d._-]+$/.test(code)) return
      const credits = line.match(/(?:-|·|•)\s*(\d+(?:[.,]\d+)?)\s*(?:Studiepoeng|stp\.?)/i)
      const name = line.slice(line.indexOf(code) + code.length).replace(/^\s*[-–]\s*/, '').replace(/\s*[-–]\s*\d+(?:[.,]\d+)?\s*(?:Studiepoeng|stp\.?)\s*$/i, '')
      known.set(code, { code, name: clean(name) || code, credits: credits ? asCredits(credits[1]) : null, sourceUrl: url.href })
    })
  }
  const periods = new Map(), warnings = [], unplaced = new Set(known.keys())
  for (const section of sections) {
    const $ = load(section.content || ''), prose = clean($.root().clone().find('table').remove().end().text())
    $('table').each((_, table) => {
      const grid = matrix($, table)
      const add = (number, header, cells) => {
        if (!number || number > 60) return
        let period = periods.get(number)
        const calendar = clean(header).match(/(Høst|Haust|Vår)\s+(\d{4})|(\d{4})\s+(Høst|Haust|Vår)/i)
        const year = calendar ? Number(calendar[2] || calendar[3]) : null, semester = calendar ? /^vår$/i.test(calendar[1] || calendar[4]) ? 'spring' : 'autumn' : null
        if (period && calendar && (period.year && period.year !== year || period.semester && period.semester !== semester)) fail('not-supported', `NLA oppgir motstridende kalenderperioder for ${number}. studiesemester. Tabellene kan ikke slås sammen sikkert. Kontroller kildeplanen eller bruk dokumentimport.`)
        if (!period) { period = { id: String(number), studySemester: number, label: `${number}. studiesemester${year ? ` · ${semester === 'spring' ? 'Vår' : 'Høst'} ${year}` : ' · velg kalendersemester'}`, year, semester, courses: [], requirements: [] }; periods.set(number, period) }
        else if (calendar && !period.year) {
          Object.assign(period, { year, semester, label: `${number}. studiesemester · ${semester === 'spring' ? 'Vår' : 'Høst'} ${year}` })
          for (const course of period.courses) Object.assign(course, { year, semester })
        }
        const texts = [...new Set(cells)].filter(Boolean).map(cell => clean($(cell).text()))
        for (const text of texts) {
          const matches = [...known.values()].filter(course => new RegExp(`(?:^|[^\\p{L}\\d_-])${course.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}\\d_-])`, 'u').test(text))
          for (const course of matches) {
            if (period.courses.some(existing => existing.code === course.code)) continue
            unplaced.delete(course.code)
            // Prose may describe exceptions and elective alternatives. Do not turn a
            // course's mere presence into a universal mandatory selection.
            const choice = /\bvalgemne|\beller\b|\balternativ/i.test(text) ? 'V' : /\bobligatorisk/i.test(text) ? 'O' : ''
            period.courses.push({ ...course, id: `nla:${source.code}:${selected}:${number}:${course.code}`, choice, sourceProvider: 'nla', sourceRecordId: `${course.code}:${selected}`, sourceVersion: selected, university: 'NLA Høgskolen', description: '', notes: `Utdrag fra studieplanen: ${text}`, year: period.year, semester: period.semester, campus: '' })
          }
          if (text && !matches.length && !semesterNumber(text) && /emne|valg|utveksling|praksis|studiepoeng|stp/i.test(text)) period.requirements.push(text)
        }
        if (prose && /oppbyg|struktur|studie/i.test(section.title)) period.requirements.push(prose.slice(0, 12000))
      }
      for (const row of grid) { const first = row.find(Boolean), text = first ? clean($(first).text()) : ''; const number = semesterNumber(text); if (number) add(number, text, row.filter(cell => cell !== first)) }
      // Some public plans put semesters in columns rather than rows.
      for (let r = 0; r < Math.min(3, grid.length); r++) grid[r].forEach((cell, column) => { const text = clean($(cell).text()), number = semesterNumber(text); if (number && column > 0) add(number, text, grid.slice(r + 1).map(row => row[column])) })
    })
  }
  const usable = [...periods.values()].filter(period => period.courses.length || period.requirements.length).sort((a, b) => a.studySemester - b.studySemester)
  if (!usable.some(period => period.courses.length)) fail('not-supported', 'Denne NLA-planen har ingen entydig emnetabell med studiesemestre som importøren kan lese. Program og kull er funnet. Bruk dokumentimport eller registrer emnene manuelt fra kilden.')
  const unplacedCourses = [...unplaced].map(code => ({ ...known.get(code), id: `nla:${source.code}:${selected}:unplaced:${code}`, choice: 'V', sourceProvider: 'nla', sourceRecordId: `${code}:${selected}`, sourceVersion: selected, university: 'NLA Høgskolen', description: '', notes: 'Emnet er publisert i emneoversikten uten entydig studiesemester. Velg det bare dersom det gjelder semesteret du har valgt.', year: null, semester: null, campus: '' }))
  if (unplaced.size) warnings.push(`${unplaced.size} emner står i emneoversikten uten entydig plassering i de leste semesterradene. De er ikke lagt til automatisk: ${[...unplaced].join(', ')}.`)
  if (usable.some(period => !period.year || !period.semester)) warnings.push('Studiesemestre og kull er hentet. Kalendersemester er ikke oppgitt i tabellen og må velges av studenten.')
  warnings.push('Kontroller valgregler i kildeutdragene. Undervisningstid og grupper er ikke hentet fra denne programkilden.')
  for (const period of usable) period.requirements = [...new Set(period.requirements)]
  return { status: 'ok', program: { code: source.code, name: clean(item.title), cohort: selected, sourceUrl, campuses: [...new Set(campuses)] }, models: [{ id: 'published', name: 'Publiserte emner i studieløpet', periods: usable, unplacedCourses }], warnings, completeness: { complete: !unplaced.size, pages: 1, returned: usable.reduce((count, period) => count + period.courses.length, 0), unplaced: unplaced.size } }
}

export async function nlaPrograms(institution, action, query, { fetchText }) {
  if (action === 'programs') {
    const all = parseNlaCatalogue(await cachedText(fetchText, catalogue, validate)), results = all.filter(row => !query.q || `${row.code} ${row.name}`.toLocaleLowerCase('nb-NO').includes(String(query.q).toLocaleLowerCase('nb-NO')))
    return { status: 'ok', results, warnings: ['Katalogen inneholder publiserte program fra flere år. Velg tilgjengelig kull for det enkelte programmet.'], sourceUrl: catalogue, completeness: { complete: true, pages: 1, returned: all.length } }
  }
  const source = ref(query.sourceUrl || '')
  if (query.program && query.program !== source.code) fail('invalid-selection', 'Programmet stemmer ikke med den publiserte kildelenken.')
  if (source.cohort && query.cohort && source.cohort !== String(query.cohort)) fail('invalid-selection', 'Valgt kull stemmer ikke med kildelenken.')
  const html = await cachedText(fetchText, source.url.href, validate)
  if (action === 'program-cohorts') { const results = parseNlaCohorts(html, source.url.href); return { status: 'ok', results, warnings: [], completeness: { complete: true, pages: 1, returned: results.length } } }
  if (action === 'program-plan') return parseNlaPlan(html, source.url.href, query.cohort)
  fail('not-supported', 'Denne handlingen støttes ikke av NLAs programimport.')
}
