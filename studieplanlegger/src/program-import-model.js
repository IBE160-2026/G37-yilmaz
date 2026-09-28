export function selectedAlternative(period, selectedCourseIds) {
  const selected = new Set(selectedCourseIds)
  return (period?.alternativeGroups || []).map(group => {
    const complete = group.options.filter(option => option.courseIds.every(id => selected.has(id)))
    const partial = group.options.filter(option => option.courseIds.some(id => selected.has(id)) && !option.courseIds.every(id => selected.has(id)))
    return { group, complete, partial }
  })
}

export function validateProgrammeSelection(period, selectedCourses) {
  const selectedIds = selectedCourses.map(course => course.id)
  for (const { group, complete, partial } of selectedAlternative(period, selectedIds)) {
    const groupIds = new Set(group.options.flatMap(option => option.courseIds))
    const selectedInGroup = new Set(selectedIds.filter(id => groupIds.has(id)))
    const exact = complete.filter(option => option.courseIds.length === selectedInGroup.size)
    if (exact.length === 1) continue
    if (partial.length) throw new Error(`${group.label}: velg hele alternativet, ikke bare deler av det.`)
    throw new Error(`${group.label}: velg nøyaktig ett av de publiserte alternativene.`)
  }
  return true
}

export const teachingStatusLabel = status => ({
  idle: 'Ikke hentet',
  searching: 'Henter …',
  available: 'Valg tilgjengelig – velg riktig timeplan',
  ready: 'Undervisning klar for import',
  'selection-required': 'Undervisning funnet – velg aktiviteter',
  unavailable: 'Ingen samsvarende timeplan funnet',
  empty: 'Ingen undervisning funnet',
  failed: 'Kunne ikke hentes',
  'access-required': 'Krever tilgang',
}[status] || 'Ikke hentet')

const normalCode = value => String(value || '').trim().toLocaleUpperCase('nb-NO')
export function exactTeachingObject(results, courseCode) {
  const exact = (results || []).filter(result => normalCode(result.code) === normalCode(courseCode))
  return exact.length === 1 ? exact[0] : null
}

export function suggestedCommonSeries(events, source = {}) {
  const commonGroups = new Set((source.commonGroups || []).filter(Boolean))
  return [...new Set((events || []).filter(event => !event.groupMissing && (event.commonSeries === true || commonGroups.has(event.group))).map(event => event.group).filter(Boolean))].filter(group =>
    !/parallell|gruppe\s*\d|seminar\s*\d|lab(?:aktivitet)?\s*\d|øving\s*\d|oving\s*\d|exercise\s*\d/i.test(group))
}

export function programmeAdditionScope(modelId, periodId, calendar) {
  return { addedModelId: modelId || '', addedPeriodId: periodId || '', year: calendar?.year, semester: calendar?.semester }
}

export function isProgrammeAdditionInScope(course, scope) {
  return course.addedModelId === scope.addedModelId && course.addedPeriodId === scope.addedPeriodId
    && Number(course.year) === Number(scope.year) && course.semester === scope.semester
}
