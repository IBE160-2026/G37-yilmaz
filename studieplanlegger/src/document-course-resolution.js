// Only the two existing v1 providers. No document text, event titles or private
// calendar URLs leave the browser; searches carry public course identity only.
import { documentInstitution as institution, documentCourseIdentity, invalidateDocumentCourseName } from './document-course-identity.js'
const normal = value => String(value || '').trim().toLocaleLowerCase('nb-NO')
export function retryDocumentCourseNames(preview) {
  for (const [key, value] of Object.entries(preview.courseLookupCache || {})) if (!value) delete preview.courseLookupCache[key]
}
async function request(path, signal) {
  const response = await fetch(path, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error('Kilden kunne ikke nås')
  return response.json()
}
export async function resolveDocumentCourses(preview, { signal, api = request, courses = [], onProgress = () => {} } = {}) {
  const cache = preview.courseLookupCache ||= {}
  const deadline = Date.now() + 20_000
  let requests = 0
  for (const row of preview.rows) invalidateDocumentCourseName(row)
  for (const row of preview.rows.filter(row => row.kind === 'course' && row.selected && !row.title && (!row.courseTarget || row.courseTarget === '?'))) {
    signal?.throwIfAborted()
    if (!row.selected || row.title || row.courseTarget && row.courseTarget !== '?') continue
    const identity = { ...row }
    const provider = institution(identity.university)
    if (!provider) { row.resolutionNote = 'Velg lærested for å finne emnenavn. Du kan også godkjenne emnekoden som foreløpig navn eller beholde aktivitetene uten emne.'; continue }
    const saved = courses.filter(course => documentCourseIdentity(course) === documentCourseIdentity(row))
    if (saved.length === 1) { row.courseTarget = saved[0].id; row.title = saved[0].name; if (saved[0].nameStatus !== undefined) row.nameStatus = saved[0].nameStatus; else delete row.nameStatus; row.verifiedCourseName = { identity: documentCourseIdentity(identity), name: row.title, courseTarget: row.courseTarget }; row.resolutionNote = 'Koblet til lagret emne med samme institusjon og periode.'; continue }
    if (saved.length > 1) { row.courseTarget = '?'; row.resolutionNote = 'Flere lagrede emner har samme identitet. Velg emnet aktivitetene skal knyttes til.'; continue }
    if (!['himolde', 'ntnu'].includes(provider)) { row.resolutionNote = 'Automatisk navnesøk er ikke tilgjengelig for dette lærestedet. Velg lagret emne, foreløpig navn eller uten emne.'; continue }
    if (!row.code || !row.year || !['spring', 'autumn'].includes(row.semester) || row.courseNameConflict) { row.resolutionNote = 'Kontroller emnekode, kalendersemester og år før navnesøk. Ulike emnenavn i kilden må avklares.'; continue }
    if (Date.now() >= deadline || requests >= 20) { row.resolutionNote = 'Automatisk navnesøk nådde grensen. Oppgi navn eller prøv igjen fra Rett.'; continue }
    const query = { q: identity.code, year: String(identity.year), semester: identity.semester }
    const key = documentCourseIdentity(identity)
    onProgress(`Kontrollerer emnenavn for ${identity.code} …`)
    try {
      if (!Object.hasOwn(cache, key)) {
        requests++
        const lookupSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(Math.max(1, deadline - Date.now()))]) : AbortSignal.timeout(Math.max(1, deadline - Date.now()))
        const data = await api(`/api/import/providers/${provider}/${provider === 'himolde' ? 'teaching-search' : 'search'}?${new URLSearchParams(query)}`, lookupSignal)
        let matches = data.status === 'ok' && data.completeness?.complete !== false && !data.truncated ? (data.results || []).filter(item => normal(item.code) === normal(identity.code) && (!identity.campus || normal(item.campus) === normal(identity.campus)) && (!identity.campusCode || normal(item.campusCode) === normal(identity.campusCode)) && (!identity.sourceObjectId || item.sourceObjectId === identity.sourceObjectId || item.id === identity.sourceObjectId)) : []
        if (provider === 'himolde') matches = matches.filter(item => {
          try { const url = new URL(item.sourceUrl); return url.origin === 'https://tp.educloud.no' && url.pathname === '/himolde/app/schedule' && url.searchParams.get('semester') === `${String(identity.year).slice(-2)}${identity.semester === 'spring' ? 'v' : 'h'}` && url.searchParams.get('scheduleType') === 'course' && url.searchParams.get('course') === item.id && item.id === `${item.code}¤${item.term}` } catch { return false }
        })
        else matches = matches.filter(item => institution(item.university) === provider && Number(item.year) === Number(identity.year) && item.semester === identity.semester)
        let name = ''
        if (matches.length === 1) {
          const selected = matches[0]
          if (provider === 'himolde') name = selected.name
          else {
            const details = await api(`/api/import/providers/ntnu/details?${new URLSearchParams({ code: selected.code, year: String(identity.year), semester: identity.semester, ...(selected.sourceUrl ? { sourceUrl: selected.sourceUrl } : {}), ...(selected.campus ? { campus: selected.campus } : {}) })}`, lookupSignal)
            if (details.status && !['ok', 'not-found', 'semester-unavailable'].includes(details.status)) throw new Error('Emnedetaljene kunne ikke kontrolleres')
            const course = details.course
            if ((!details.status || details.status === 'ok') && course && normal(course.code) === normal(identity.code) && institution(course.university) === provider && Number(course.year) === Number(identity.year) && course.semester === identity.semester && (!selected.campus || normal(course.campus) === normal(selected.campus)) && (!identity.campusCode || normal(course.campusCode) === normal(identity.campusCode)) && (!selected.campusCode || normal(course.campusCode) === normal(selected.campusCode))) name = course.name
          }
        }
        if (data.status !== 'ok' && !['not-found', 'no-matching-results', 'semester-unavailable'].includes(data.status)) throw new Error('Kilden kunne ikke kontrolleres')
        cache[key] = typeof name === 'string' && name.trim() && name.length <= 1000 ? name.trim() : ''
      }
      signal?.throwIfAborted()
      if (!row.selected || documentCourseIdentity(row) !== key || row.title || row.courseTarget && row.courseTarget !== '?') continue
      if (cache[key]) { row.title = cache[key]; row.verifiedCourseName = { identity: documentCourseIdentity(row), name: row.title }; row.resolutionNote = `Emnenavnet er kontrollert hos ${provider === 'himolde' ? 'HiMolde TP' : 'NTNU emnekatalog'} for ${row.code}, ${row.semester === 'spring' ? 'vår' : 'høst'} ${row.year}.` }
      else row.resolutionNote = 'Kilden ga ikke ett entydig emne. Velg lagret emne, oppgi navn eller velg uten emne.'
    } catch (error) {
      signal?.throwIfAborted()
      if (!row.selected || documentCourseIdentity(row) !== key || row.title || row.courseTarget && row.courseTarget !== '?') continue
      row.resolutionNote = 'Emnenavnet kunne ikke kontrolleres. Utkastet er beholdt; oppgi navn, velg lagret emne eller uten emne.'
    }
  }
}
