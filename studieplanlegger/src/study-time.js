import { Temporal } from '@js-temporal/polyfill'
import { OSLO, toInstant } from './planner.js'

export const STUDY_TIME_PRESETS = Object.freeze({
  daytime: Object.freeze({ kind: 'daytime', label: 'På dagtid i ukedagene', days: Object.freeze([1, 2, 3, 4, 5]), startTime: '09:00', endTime: '15:00', detail: 'Mandag–fredag kl. 09–15' }),
  evening: Object.freeze({ kind: 'evening', label: 'På kvelden i ukedagene', days: Object.freeze([1, 2, 3, 4, 5]), startTime: '18:00', endTime: '20:00', detail: 'Mandag–fredag kl. 18–20' }),
  weekend: Object.freeze({ kind: 'weekend', label: 'I helgene', days: Object.freeze([6, 7]), startTime: '10:00', endTime: '14:00', detail: 'Lørdag–søndag kl. 10–14' }),
})

const exactPreset = value => {
  const preset = value && STUDY_TIME_PRESETS[value.kind]
  return preset && value.startTime === preset.startTime && value.endTime === preset.endTime &&
    Array.isArray(value.days) && value.days.length === preset.days.length && value.days.every((day, index) => day === preset.days[index])
}

export function preferenceFor(kind) {
  const preset = STUDY_TIME_PRESETS[kind]
  return preset ? { kind: preset.kind, label: preset.label, days: [...preset.days], startTime: preset.startTime, endTime: preset.endTime } : null
}

export const validStudyTimePreference = value => Boolean(exactPreset(value))

function window(id, localDate, startTime, endTime, source) {
  try {
    const start = toInstant(`${localDate}T${startTime}`), end = toInstant(`${localDate}T${endTime}`)
    return Date.parse(end) > Date.parse(start) ? { id, start, end, label: source.label, source: source.kind } : null
  } catch { return null }
}

function osloDate(now) {
  return Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(OSLO).toPlainDate()
}

export function materializeStudyTime({ now = new Date(), preference, mode = 'saved', horizonDays = 28 } = {}) {
  const today = osloDate(now)
  if (mode === 'assumption') {
    const date = today.add({ days: 1 }).toString()
    return { kind: 'assumption', label: 'Foreløpig antakelse', detail: `${date} kl. 18:00–18:30`, conditional: true,
      windows: [window(`assumption:${date}`, date, '18:00', '18:30', { kind: 'assumption', label: 'Må bekreftes' })].filter(Boolean) }
  }
  if (mode === 'varies') {
    const slots = [['10:00', '11:00'], ['14:00', '15:00'], ['18:00', '19:00']]
    const windows = []
    for (let offset = 1; offset <= 7; offset++) {
      const date = today.add({ days: offset }).toString(), [start, end] = slots[(offset - 1) % slots.length]
      const item = window(`varies:${date}:${start}`, date, start, end, { kind: 'one-off', label: 'Konkret tidspunkt til vurdering' })
      if (item) windows.push(item)
    }
    return { kind: 'one-off', label: 'Det varierer', detail: 'Konkrete tidspunkter de neste sju dagene – vurder hvert forslag', conditional: true, windows }
  }
  if (!validStudyTimePreference(preference)) return null
  const preset = STUDY_TIME_PRESETS[preference.kind]
  const windows = []
  for (let offset = 0; offset <= horizonDays; offset++) {
    const date = today.add({ days: offset })
    if (!preference.days.includes(date.dayOfWeek)) continue
    const item = window(`preference:${preference.kind}:${date}`, date.toString(), preference.startTime, preference.endTime, { kind: 'preferred', label: preset.label })
    if (item && Date.parse(item.end) > +now) windows.push(item)
  }
  return { kind: 'preferred', label: preset.label, detail: preset.detail, conditional: true, windows }
}

export function availabilityFor(state, { now = new Date(), choice = 'saved' } = {}) {
  if (state.workWindows?.length && choice === 'saved') return { kind: 'confirmed', label: 'Registrert tilgjengelig tid', detail: 'Eksisterende arbeidstidsvinduer', conditional: false, windows: structuredClone(state.workWindows), preferenceAction: 'keep' }
  if (STUDY_TIME_PRESETS[choice]) {
    const preference = preferenceFor(choice)
    return { ...materializeStudyTime({ now, preference }), preference, preferenceAction: 'set' }
  }
  if (choice === 'varies') return { ...materializeStudyTime({ now, mode: 'varies' }), preferenceAction: state.studyTimePreference ? 'clear' : 'keep' }
  if (choice === 'assumption') return { ...materializeStudyTime({ now, mode: 'assumption' }), preferenceAction: 'keep' }
  const saved = materializeStudyTime({ now, preference: state.studyTimePreference })
  return saved ? { ...saved, preference: structuredClone(state.studyTimePreference), preferenceAction: 'keep' } : { ...materializeStudyTime({ now, mode: 'assumption' }), preferenceAction: 'keep' }
}
