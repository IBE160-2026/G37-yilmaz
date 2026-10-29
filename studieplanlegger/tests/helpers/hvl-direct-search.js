// Minimal public-label contract observed 2026-10-29 at HVL's open TimeEdit
// DAT100 search: https://cloud.timeedit.net/hvl/web/pen/ri1Q28.html .
// Titles/variants retain the source structure; record IDs below are synthetic.
export const hvlVariants = ['', 'Bergen - Dataingeniør', 'Bergen - Informasjonsteknologi', 'Førde - Informasjonsteknologi', 'Haugesund - Informasjonsteknologi']
export const hvlLabels = hvlVariants.map(variant => `DAT100, 2026 HØST, ${variant ? `DAT100 ${variant}, ` : ''}Grunnleggende programmering, 2026 HØST`)
export const hvlSearchHtml = hvlLabels.map((label, index) => `<div class="searchObject" data-id="${72900 + index}.36" data-name="${label}"></div>`).join('')

// Persisted shape from the old direct-import path, with optional student edits.
export function legacyHvlCourse(item, name = item.label) {
  const { variant, ...oldItem } = item
  return { ...oldItem, id: `hvl:${item.sourceObjectId}:${item.year}:${item.semester}`, name, campus: item.label, campusVerified: true, credits: null, description: '', notes: 'Syntetisk studentnotat som skal beholdes', sourceBase: { name: item.label, credits: null, description: '' } }
}
