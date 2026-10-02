import { Temporal } from '@js-temporal/polyfill'
import { validDeadline } from './tasks.js'

const OSLO = 'Europe/Oslo'
const fold = value => String(value || '').trim().toLocaleLowerCase('nb')
const cleanSentence = value => String(value || '').trim().replace(/[.!?]+$/u, '').trim()
const exactMatches = (values, label, fields) => values.filter(value => fields.some(field => fold(value[field]) === fold(label)))

export function resolveExactTask(tasks, label) {
  const matches = exactMatches(tasks, label, ['title'])
  if (matches.length) return matches.length === 1 ? { ok: true, value: matches[0] } : { ok: false, reason: 'ambiguous', matches }
  const wanted = fold(label), aliasMatches = tasks.filter(task => {
    const title = fold(task.title)
    return [`${title}en`, `${title}et`, `${title}a`].includes(wanted)
  })
  return aliasMatches.length === 1 ? { ok: true, value: aliasMatches[0], alias: true } : { ok: false, reason: aliasMatches.length ? 'ambiguous' : 'not-found', matches: aliasMatches }
}
export function resolveExactCourse(courses, label) {
  const matches = exactMatches(courses, label, ['code', 'name'])
  return matches.length === 1 ? { ok: true, value: matches[0] } : { ok: false, reason: matches.length ? 'ambiguous' : 'not-found', matches }
}

const weekdays = { mandag: 1, tirsdag: 2, onsdag: 3, torsdag: 4, fredag: 5, lørdag: 6, søndag: 7 }
const months = { januar: 1, februar: 2, mars: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8, september: 9, oktober: 10, november: 11, desember: 12 }
const osloToday = now => Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(OSLO).toPlainDate()
function datePart(text, now) {
  const today = osloToday(now), lower = cleanSentence(fold(text))
  if (lower === 'i dag') return today
  if (lower === 'i morgen') return today.add({ days: 1 })
  const weekday = lower.match(/^(?:førstkommende\s+|neste\s+)?(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)$/u)
  if (weekday) return today.add({ days: ((weekdays[weekday[1]] - today.dayOfWeek + 7) % 7) || 7 })
  let match = lower.match(/^(\d{1,2})[.]\s*(\d{1,2})[.]?(?:\s*(\d{4}))?$/)
  if (match) return Temporal.PlainDate.from({ year: match[3] ? Number(match[3]) : today.year, month: Number(match[2]), day: Number(match[1]) }, { overflow: 'reject' })
  match = lower.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) return Temporal.PlainDate.from(lower)
  match = lower.match(/^(\d{1,2})[.]?\s+(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)(?:\s+(\d{4}))?$/u)
  if (match) {
    return Temporal.PlainDate.from({ year: match[3] ? Number(match[3]) : today.year, month: months[match[2]], day: Number(match[1]) }, { overflow: 'reject' })
  }
  throw new RangeError('Ukjent eller tvetydig dato.')
}
export function parseOsloDeadline(value, now = new Date()) {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(String(value).trim())) return validDeadline(String(value).trim()) ? { ok: true, deadlineLocal: String(value).trim() } : { ok: false, error: 'Datoen eller klokkeslettet finnes ikke i Oslo.' }
  const match = cleanSentence(value).match(/^(.*?)(?:\s+kl\.?\s*(\d{1,2})(?::([0-5]\d))?\.?)?$/iu)
  if (!match?.[1]?.trim()) return { ok: false, error: 'Oppgi en dato.' }
  try {
    const dateValue = datePart(match[1].trim(), now), date = dateValue.toString()
    const explicitYear = /\b\d{4}\b/u.test(match[1]) || /^\d{4}-/u.test(match[1])
    if (!explicitYear && Temporal.PlainDate.compare(dateValue, osloToday(now)) < 0) return { ok: false, error: 'Datoen er passert i inneværende år. Velg år.', needsYearChoice: true, yearChoices: [dateValue.year, dateValue.year + 1], dateWithoutYear: match[1].trim() }
    const deadlineLocal = match[2] === undefined ? date : `${date}T${String(Number(match[2])).padStart(2, '0')}:${match[3] || '00'}`
    return validDeadline(deadlineLocal) ? { ok: true, deadlineLocal } : { ok: false, error: 'Datoen eller klokkeslettet finnes ikke i Oslo.' }
  } catch { return { ok: false, error: 'Bruk i dag, i morgen, en ukedag, 4.10 (D.M), 12. oktober, DD.MM.ÅÅÅÅ eller ÅÅÅÅ-MM-DD.' } }
}
export function parseRemainingMinutes(value) {
  const normalized = cleanSentence(fold(value)).replace(/^(?:en|ett)\s+(?=time$)/u, '1 ').replace(/^to\s+(?=timer$)/u, '2 ')
  if (!normalized || ['vet ikke', 'ukjent', 'mye'].includes(normalized)) return { ok: true, minutes: null, unknown: true }
  const match = normalized.match(/^(\d+(?:[.,]\d+)?)\s*(min(?:utt(?:er)?)?|t(?:ime|imer)?)$/u)
  if (!match) return { ok: false, error: 'Bruk minutter eller timer, for eksempel 90 min, to timer eller 1,5 timer.' }
  const amount = Number(match[1].replace(',', '.')), minutes = match[2].startsWith('t') ? amount * 60 : amount
  return Number.isSafeInteger(minutes) && minutes >= 0 ? { ok: true, minutes } : { ok: false, error: 'Arbeidstiden må bli et helt antall minutter.' }
}

const taskContext = task => ({ id: task.id, title: task.title, course: task.course || '', courseId: task.courseId || '', deadlineLocal: task.deadlineLocal || '', remainingMinutes: task.remainingMinutes ?? null })
const failed = (proposal, ...errors) => ({ ok: false, proposal, errors: errors.flat().filter(Boolean) })
const completed = proposal => ({ ok: true, proposal, errors: [] })
function taskProposal(action, taskLabel, valueInput, tasks, now) {
  const title = cleanSentence(taskLabel), target = resolveExactTask(tasks, title), key = action === 'deadline' ? 'deadlineLocal' : 'remainingMinutes'
  const parsed = action === 'deadline' ? parseOsloDeadline(valueInput, now) : parseRemainingMinutes(valueInput)
  const proposal = { action, taskTitle: title, taskId: target.ok ? target.value.id : '', oldValue: target.ok ? (target.value[key] ?? (action === 'deadline' ? '' : null)) : undefined,
    ...(action === 'deadline' ? { deadlineInput: cleanSentence(valueInput), deadlineLocal: parsed.deadlineLocal || '' } : { remainingInput: cleanSentence(valueInput), remainingMinutes: parsed.minutes ?? null }) }
  if (target.reason === 'ambiguous') {
    proposal.taskChoices = target.matches.map(task => ({ ...taskContext(task), oldValue: task[key] ?? (action === 'deadline' ? '' : null) }))
    return failed(proposal, 'Flere oppgaver har nøyaktig dette navnet. Velg riktig oppgave ut fra emne og frist.')
  }
  if (!target.ok) return failed(proposal, 'Fant ingen oppgave med nøyaktig dette navnet. Korriger oppgavenavnet.')
  if (!parsed.ok) return failed(proposal, parsed.error)
  return completed(proposal)
}
function createProposal(body, courses, now) {
  let text = cleanSentence(body), courseLabel = '', deadlineInput = '', remainingInput = ''
  const work = text.match(/\s+(?:med\s+)?(?:gjenstår|gjenstående(?:\s+arbeid)?|arbeid)\s+(.+?)$/iu)
  if (work) { remainingInput = cleanSentence(work[1]); text = text.slice(0, work.index).trim() }
  const deadline = text.match(/\s+(?:med\s+)?(?:frist|leveres|innen)\s+(.+?)$/iu)
  if (deadline) { deadlineInput = cleanSentence(deadline[1]); text = text.slice(0, deadline.index).trim() }
  const noCourse = text.match(/\s+(?:i|for)\s+(?:uten emne|ikke et emne)\s*$/iu)
  if (noCourse) text = text.slice(0, noCourse.index).trim()
  const knownNames = courses.flatMap(course => [course.code, course.name]).filter(Boolean).sort((a, b) => b.length - a.length)
  const known = knownNames.find(name => fold(text).endsWith(` i ${fold(name)}`) || fold(text).endsWith(` for ${fold(name)}`))
  const code = text.match(/\s+(?:i|for)\s+([\p{L}]{2,}\s*-?\s*\d[\p{L}\d._-]*)$/u)
  if (known) { const separator = fold(text).endsWith(` i ${fold(known)}`) ? 3 : 5; courseLabel = text.slice(-known.length); text = text.slice(0, -(known.length + separator)).trim() }
  else if (code) { courseLabel = code[1].replace(/\s+/g, ''); text = text.slice(0, code.index).trim() }
  const proposal = { action: 'create', title: cleanSentence(text), course: courseLabel, courseId: '', deadlineInput, deadlineLocal: '', remainingInput, remainingMinutes: null }
  const errors = []
  if (!proposal.title) errors.push('Oppgaven må ha en tittel.')
  if (courseLabel) {
    const course = resolveExactCourse(courses, courseLabel)
    if (!course.ok) errors.push(course.reason === 'ambiguous' ? 'Flere emner matcher nøyaktig. Velg riktig emne.' : 'Fant ikke emnet. Korriger bare emnefeltet eller la det stå tomt.')
    else { proposal.courseId = course.value.id; proposal.course = course.value.code || course.value.name }
  }
  if (deadlineInput) { const date = parseOsloDeadline(deadlineInput, now); if (!date.ok) { errors.push(date.error); Object.assign(proposal, { needsYearChoice: date.needsYearChoice, yearChoices: date.yearChoices }) } else proposal.deadlineLocal = date.deadlineLocal }
  if (remainingInput) { const workValue = parseRemainingMinutes(remainingInput); if (!workValue.ok) errors.push(workValue.error); else proposal.remainingMinutes = workValue.minutes }
  return errors.length ? failed(proposal, errors) : completed(proposal)
}
function parseTextRegistrationAt(input, { tasks = [], courses = [], now }) {
  const raw = String(input || '').trim()
  if (!raw) return failed(null, 'Skriv én handling: opprett oppgave, endre frist eller endre gjenstående arbeid.')
  if (/[?]$/.test(raw) || /^(?:kan|skal|bør|må|hva|hvordan|når|hvor|hvem|hvorfor)\b/iu.test(raw) || /\b(?:jeg\s+)?lurer\s+på\s+om\b/iu.test(raw)) return failed(null, 'Spørsmål lagres ikke som oppgaver. Skriv en kort, deklarativ tittel.')
  const starts = raw.match(/(?:^|\s+(?:og|samt)\s+)(?:legg\s+til|lag\s+oppgave|opprett|ny\s+oppgave|endre\s+(?:fristen|frist)|sett\s+(?:gjenstår|gjenstående))/giu) || []
  if (starts.length > 1) return failed(null, 'Bare én handling kan bekreftes om gangen. Velg opprett oppgave, endre frist eller endre gjenstående arbeid.')
  let match = raw.match(/^endre\s+(?:fristen|frist)\s+(?:for|på)\s+[«"]?(.+?)[»"]?\s+til\s+(.+)$/iu)
  if (match) return taskProposal('deadline', match[1], match[2], tasks, now)
  match = raw.match(/^(?:sett|endre)\s+(?:gjenstår|gjenstående(?:\s+arbeid)?)\s+(?:for|på)\s+[«"]?(.+?)[»"]?\s+til\s+(.+)$/iu)
  if (match) return taskProposal('remaining', match[1], match[2], tasks, now)
  if (/\b(?:endr(?:e|er)|flytt(?:e|er)?|slett(?:e|er)?|fjern(?:e|er)?|avlys(?:e|er)?|utsett(?:e|er)?)\b/iu.test(raw)) return failed(null, 'Jeg kjenner ikke igjen en trygg og entydig endring. Presiser handling og mål.')
  const activity = cleanSentence(raw).match(/^(?:legg\s+til\s+)?(?:(?:egen|personlig)\s+aktivitet:?\s*)?(.+?)\s+(\d{1,2}[.]\d{1,2}[.]?(?:\s*\d{4})?|\d{1,2}[.]?\s+(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)(?:\s+\d{4})?)(?:\s+kl\.?\s*(\d{1,2}(?::[0-5]\d)?)(?:\s*[–-]\s*(\d{1,2}(?::[0-5]\d)?))?)?$/iu)
  if (activity && !/\b(?:innen|frist|leveres)\b/iu.test(raw) && (activity[3] || /^(?:legg\s+til\s+)?(?:egen|personlig)\s+aktivitet/iu.test(raw))) {
    const clock = value => value ? value.includes(':') ? value : String(value).padStart(2, '0') + ':00' : ''
    const parsed = parseOsloDeadline(activity[2], now), proposal = { action: 'activity', title: cleanSentence(activity[1]), dateInput: activity[2], dateLocal: parsed.deadlineLocal || '', startLocal: clock(activity[3]), endLocal: clock(activity[4]) }
    if (!parsed.ok) return failed({ ...proposal, needsYearChoice: parsed.needsYearChoice, yearChoices: parsed.yearChoices }, parsed.error)
    return completed(proposal)
  }
  if (activity && !/\b(?:innen|frist|leveres)\b/iu.test(raw) && !/^(?:legg\s+til|lag\s+oppgave|opprett|ny\s+oppgave)\b/iu.test(raw)) {
    const parsed = parseOsloDeadline(activity[2], now), proposal = { action: 'ambiguous-date', title: cleanSentence(activity[1]), dateInput: activity[2], dateLocal: parsed.deadlineLocal || '', deadlineInput: activity[2], deadlineLocal: parsed.deadlineLocal || '', startLocal: '', endLocal: '', course: '', courseId: '', remainingInput: '', remainingMinutes: null }
    if (!parsed.ok) return failed({ ...proposal, needsYearChoice: parsed.needsYearChoice, yearChoices: parsed.yearChoices }, parsed.error)
    return completed(proposal)
  }
  match = raw.match(/^(?:legg\s+til(?:\s+oppgave)?|lag\s+oppgave|opprett(?:\s+oppgave)?|ny\s+oppgave)\s*:?[\s]+(.+)$/iu)
  if (match) return createProposal(match[1], courses, now)
  return createProposal(raw, courses, now)
}

export function parseTextRegistration(input, { tasks = [], courses = [], now = new Date() } = {}) {
  const result = parseTextRegistrationAt(input, { tasks, courses, now })
  if (result.proposal) result.proposal.referenceTime = now.toISOString()
  return result
}
