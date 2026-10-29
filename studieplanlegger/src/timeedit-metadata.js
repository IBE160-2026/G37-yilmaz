export function hvlTimeEditMetadata(label, code, season) {
  // The public HVL search repeats the period around the course name. Only
  // extract fields from that observed contract; retain the full source label.
  const parts = label.split(',').map(value => value.trim())
  if (parts[0] !== code || parts[1] !== season || parts.at(-1) !== season || parts.length < 4) return { name: label, campus: '', campusVerified: false, variant: '' }
  const content = parts.slice(2, -1)
  const variant = content[0].startsWith(`${code} `) ? content.shift().slice(code.length + 1) : ''
  const places = new Set((variant.match(/\b(?:Bergen|Førde|Haugesund|Sogndal|Stord)\b/gi) || []).map(value => value.toLocaleLowerCase('nb')))
  const campus = places.size === 1 ? variant.match(/^(Bergen|Førde|Haugesund|Sogndal|Stord)(?:\s+-\s+.+)?$/)?.[1] || '' : ''
  return { name: content.join(', ') || label, campus, campusVerified: Boolean(campus), variant }
}

export function isHvlTimeEditSearchUrl(input, year, semester) {
  if (!Number.isInteger(year) || year < 1900 || year > 2200 || !['spring', 'autumn'].includes(semester)) return false
  try {
    const url = new URL(input)
    if (url.origin !== 'https://cloud.timeedit.net' || url.pathname !== '/hvl/web/pen/objects.html' || url.username || url.password || url.hash) return false
    const fixed = { fr: 't', partajax: 't', im: 'f', sid: '74', l: 'nb_NO', objects: '', types: '36', fe: `80.${encodeURIComponent(`${year} ${semester === 'spring' ? 'VÅR' : 'HØST'}`)}` }
    const keys = [...Object.keys(fixed), 'max', 'search_text']
    if (url.searchParams.size !== keys.length || keys.some(key => url.searchParams.getAll(key).length !== 1) || Object.entries(fixed).some(([key, value]) => url.searchParams.get(key) !== value)) return false
    const search = url.searchParams.get('search_text')
    return ['100', '1000', '5000'].includes(url.searchParams.get('max')) && Boolean(search.trim()) && search.length <= 120
  } catch { return false }
}
