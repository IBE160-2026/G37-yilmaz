import { semesterWindow } from './planner.js'
import { institutionById } from './institutions.js'

// Institution-level datatype evidence is independent from the authority of a
// particular calendar subscription to cancel previously imported occurrences.
export const institutionDatatypeCoverage = (institution, datatype) => institutionById(institution)?.datatypes[datatype] || null

// Only a verified URL contract proves a complete window. Opaque TimeEdit links,
// rolling feeds and arbitrary stored coverage flags are not such proof.
export function sourceCoverage(source, course) {
  if (source.kind !== 'url') return { kind: 'snapshot' }
  try {
    const url = new URL(source.url), year = Number(course.year)
    const sem = `${String(year).slice(-2)}${course.semester === 'spring' ? 'v' : 'h'}`
    if (url.origin === 'https://tp.educloud.no' && !url.username && !url.password && !url.hash && url.pathname === '/ntnu/timeplan/ical.php' && year >= 2000 && year <= 2099 &&
      [...url.searchParams.keys()].every(key => ['sem', 'id[]', 'type'].includes(key)) &&
      url.searchParams.getAll('sem').length === 1 && url.searchParams.get('sem') === sem &&
      url.searchParams.getAll('type').length === 1 && url.searchParams.get('type') === 'course' &&
      url.searchParams.getAll('id[]').length === 1 && url.searchParams.get('id[]').toUpperCase() === course.code.toUpperCase()) {
      return { kind: 'fixed', ...semesterWindow(course.semester, year), proof: 'ntnu-tp-semester-url' }
    }
  } catch { /* Missing/invalid connection metadata never proves completeness. */ }
  return { kind: 'unknown' }
}
export function disappearancePolicy(source, course, parsed) {
  const coverage = sourceCoverage(source, course)
  return { authoritative: Boolean(parsed.authoritative && coverage.kind !== 'unknown'), absenceWindow: coverage.kind === 'fixed' ? coverage : undefined, cancellations: parsed.cancellations || [] }
}
export const UNKNOWN_COVERAGE_WARNING = 'Lenken dokumenterer ikke et fast, fullstendig semester. Manglende økter beholdes; bare uttrykkelige avlysninger fra kilden behandles som avlyst.'
