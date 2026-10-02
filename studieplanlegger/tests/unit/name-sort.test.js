import { describe, expect, it } from 'vitest'
import { nameFirstLabel, sortByVisibleName } from '../../src/name-sort.js'

describe('norsk katalogsortering', () => {
  it('sorterer en kopi etter synlig navn med Æ, Ø og Å på norsk plass', () => {
    const source = [{ id: '3', name: 'Årsstudium' }, { id: '1', name: 'Økonomi' }, { id: '0', name: 'Anatomi' }, { id: '2', name: 'Æresstudium' }]
    const sorted = sortByVisibleName(source)
    expect(sorted.map(item => item.name)).toEqual(['Anatomi', 'Æresstudium', 'Økonomi', 'Årsstudium'])
    expect(source.map(item => item.id)).toEqual(['3', '1', '0', '2'])
  })

  it('bevarer duplikater og bryter like navn på kode, nivå og stabil ID', () => {
    const source = [
      { id: 'b', name: 'Design', code: 'D2', level: 'Bachelor' },
      { id: 'c', name: 'Design', code: 'D1', level: 'Master' },
      { id: 'a', name: 'Design', code: 'D1', level: 'Master' },
    ]
    expect(sortByVisibleName(source).map(item => item.id)).toEqual(['a', 'c', 'b'])
    expect(sortByVisibleName([{ id: 'a', name: 'Lik' }, { id: 'a', name: 'Lik' }])).toHaveLength(2)
  })

  it('lager navn-først-etiketter', () => {
    expect(nameFirstLabel({ name: 'Algoritmer', code: 'IBE160' }, ['Bachelor'])).toBe('Algoritmer · IBE160 · Bachelor')
  })
})
