import { Temporal } from '@js-temporal/polyfill'

const zone = 'Europe/Oslo'
const cache = new Map()
const result = (status, message = '', extra = {}) => ({ status, message, options: [], ...extra })

// Keep the wall-clock value intact. A repeated autumn minute needs a separate,
// explicit occurrence; an offset-free legacy record must never pick one silently.
export function inspectDeadline(value) {
  if (value === '' || value == null) return result('empty')
  if (typeof value !== 'string') return result('invalid-date', 'Oppgi en gyldig dato for fristen.')
  if (cache.has(value)) return cache.get(value)
  const [date = '', time = '', ...extra] = value.split('T')
  let answer
  try {
    if (date.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number(date.slice(0, 4)) < 1) throw new Error('date')
    Temporal.PlainDate.from(date, { overflow: 'reject' })
  } catch { answer = result('invalid-date', 'Oppgi en gyldig dato for fristen.') }
  if (!answer && value === date) {
    // Unknown clock time stays date-only in storage and display. The following
    // Oslo midnight is an exclusive scheduling boundary, never an invented time.
    const boundary = Temporal.PlainDate.from(date).add({ days: 1 }).toZonedDateTime(zone)
    answer = result('valid', '', { dateOnly: true, instant: boundary.toInstant().toString(), offset: boundary.offset })
  }
  if (!answer && (extra.length || time.length !== 5 || !/^\d{2}:\d{2}$/.test(time) || Number(time.slice(0, 2)) > 23 || Number(time.slice(3)) > 59)) {
    answer = result('invalid-time', 'Oppgi et gyldig klokkeslett fra 00:00 til 23:59, for eksempel 20:30.')
  }
  if (!answer) {
    const plain = Temporal.PlainDateTime.from(value)
    const earlier = plain.toZonedDateTime(zone, { disambiguation: 'earlier' })
    const later = plain.toZonedDateTime(zone, { disambiguation: 'later' })
    const displayDate = `${Number(date.slice(8))}.${Number(date.slice(5, 7))}.${date.slice(0, 4)}`
    if (!earlier.toPlainDateTime().equals(plain) || !later.toPlainDateTime().equals(plain)) {
      answer = result('nonexistent', `Klokkeslettet ${time} finnes ikke ${displayDate} i norsk tid fordi klokken stilles frem til sommertid. Velg et annet klokkeslett.`)
    } else if (earlier.epochNanoseconds !== later.epochNanoseconds) {
      const option = (value, zoned, order) => ({ value, offset: zoned.offset, instant: zoned.toInstant().toString(),
        label: `${order} ${time} (${value === 'earlier' ? 'sommertid' : 'vintertid'}, UTC${zoned.offset})` })
      answer = result('ambiguous', `Klokkeslettet ${time} forekommer to ganger ${displayDate} når klokken stilles tilbake. Velg første eller andre forekomst.`, {
        options: [option('earlier', earlier, 'Første'), option('later', later, 'Andre')],
      })
    } else answer = result('valid', '', { instant: earlier.toInstant().toString(), offset: earlier.offset })
  }
  if (cache.size >= 512) cache.delete(cache.keys().next().value)
  for (const option of answer.options) Object.freeze(option)
  Object.freeze(answer.options)
  cache.set(value, Object.freeze(answer))
  return answer
}

export function deadlineInstant(value, disambiguation) {
  const info = inspectDeadline(value)
  if (info.status === 'valid' && (disambiguation === undefined || disambiguation === '')) return info.instant
  if (info.status === 'ambiguous') {
    const chosen = info.options.find(option => option.value === disambiguation)
    if (chosen) return chosen.instant
  }
  throw new RangeError(info.message || 'Velg en gyldig frist og forekomst av klokkeslettet.')
}

// Sorting an unresolved legacy deadline uses the beginning of its possible range
// only to place the repairable record. It does not resolve or persist its deadline.
function sortInstant(task) {
  const info = inspectDeadline(task?.deadlineLocal)
  if (info.status === 'valid') return Date.parse(info.instant)
  if (info.status === 'ambiguous') return Date.parse((info.options.find(option => option.value === task.deadlineDisambiguation) || info.options[0]).instant)
  return Infinity
}

export function compareDeadlines(first, second) {
  const a = sortInstant(first), b = sortInstant(second)
  return a === b ? 0 : a - b
}
