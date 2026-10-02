const negativeExamTitle = /\b(?:prøve(?:\s*-\s*|\s*)eksamen|mock(?:\s*-\s*|\s+)(?:exam|examination)|practice(?:\s*-\s*|\s+)(?:exam|examination)|eksamensforbered\w*|forbered\w*(?:\s+til)?\s+eksamen|exam(?:\s*-\s*|\s+)prepar\w*|forelesning\w*\s+(?:om|i)\s+eksamen|lecture\w*\s+(?:about|on)\s+(?:the\s+)?exam)\b/iu
const examTitle = /(?:^|[\s:–—-])(?:(?:skole|hjemme|muntlig|skriftlig)eksamen|eksamen|exam|examination)(?:$|[\s:–—-])/iu

export function normalizeActivityKind(value) {
  const kind = String(value || '').toLocaleLowerCase('nb')
  return kind === 'exam' ? 'exam' : kind === 'assessment' ? 'assessment' : ''
}

// Legacy recognition is deliberately title-only and narrow. Descriptions and
// generic assessment words are not evidence that an activity is an exam.
export function isExamEvent(event = {}) {
  if (event.activityKind === 'personal') return false
  const structured = normalizeActivityKind(event.activityKind)
  if (structured) return structured === 'exam'
  const title = String(event.title || '').trim()
  return Boolean(title && examTitle.test(` ${title} `) && !negativeExamTitle.test(title))
}

export function eventPresentation(event = {}) {
  return isExamEvent(event)
    ? { isExam: true, symbol: '📝', label: 'Eksamen', className: 'is-exam' }
    : { isExam: false, symbol: 'U', label: 'Undervisning', className: '' }
}
