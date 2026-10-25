import { institutions } from './institutions.js'
const normal = value => String(value || '').trim().toLocaleLowerCase('nb-NO')
export const documentInstitution = value => institutions.find(item => [normal(item.id), normal(item.name)].includes(normal(value)))?.id || ({ 'høgskolen i molde': 'himolde' })[normal(value)] || normal(value)
export const documentCourseIdentity = row => JSON.stringify([documentInstitution(row.university), normal(row.code), Number(row.year), row.semester, row.sourceObjectId || '', normal(row.campus), normal(row.campusCode)])
export function invalidateDocumentCourseName(row) {
  if (!row.verifiedCourseName || row.verifiedCourseName.identity === documentCourseIdentity(row)) return
  if (row.verifiedCourseName.courseTarget && row.courseTarget === row.verifiedCourseName.courseTarget) row.courseTarget = ''
  if (row.title === row.verifiedCourseName.name) row.title = ''
  delete row.verifiedCourseName
  delete row.resolutionNote
}
