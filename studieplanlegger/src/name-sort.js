const collator = new Intl.Collator('nb-NO', {
  usage: 'sort',
  sensitivity: 'base',
  numeric: true,
})
const identityCollator = new Intl.Collator('nb-NO', { sensitivity: 'variant', numeric: true })

const text = value => String(value ?? '').trim()

export function visibleName(item) {
  if (item?.nameStatus === 'provisional' && !text(item.name)) return `${text(item.code)} (foreløpig navn)`
  return text(item?.name || item?.label || item?.title)
}

export function sortByVisibleName(items, selectors = {}) {
  const nameOf = selectors.name || visibleName
  const codeOf = selectors.code || (item => item?.code)
  const levelOf = selectors.level || (item => item?.level)
  const idOf = selectors.id || (item => item?.id ?? item?.sourceObjectId ?? item?.value)
  return [...(items || [])]
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      for (const value of [
        collator.compare(text(nameOf(left.item)), text(nameOf(right.item))),
        collator.compare(text(codeOf(left.item)), text(codeOf(right.item))),
        collator.compare(text(levelOf(left.item)), text(levelOf(right.item))),
        identityCollator.compare(text(idOf(left.item)), text(idOf(right.item))),
      ]) if (value) return value
      return left.index - right.index
    })
    .map(({ item }) => item)
}

export function nameFirstLabel(item, extra = []) {
  const name = visibleName(item), code = text(item?.code)
  const sameCode = name.toLocaleLowerCase('nb-NO') === code.toLocaleLowerCase('nb-NO') || name.toLocaleLowerCase('nb-NO').startsWith(`${code.toLocaleLowerCase('nb-NO')} `) || name.toLocaleLowerCase('nb-NO').startsWith(`${code.toLocaleLowerCase('nb-NO')}–`)
  return [name, sameCode || item?.nameStatus === 'provisional' && !text(item.name) ? '' : code, ...extra.map(text)].filter(Boolean).join(' · ')
}
