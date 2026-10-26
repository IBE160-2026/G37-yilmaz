import { describe, expect, it, vi } from 'vitest'
import {
  COURSE_COLOR_STORAGE_KEY, COURSE_COLOR_COUNT, createCourseColorRegistry,
  registerCourseColors, courseColorSlot, courseColor, applyCourseColor, resolvedCourseId,
} from '../../src/course-colors.js'

const courses = Array.from({ length: 12 }, (_, index) => Object.freeze({
  id: `synthetic-course-${String(index + 1).padStart(2, '0')}`,
  code: index < 2 ? 'SAME101' : `TEST${index + 1}`,
  name: `Syntetisk emne ${index + 1}`,
  institution: index === 1 ? 'synthetic-b' : 'synthetic-a',
}))
const backingStore = saved => {
  const values = new Map(saved === undefined ? [] : [[COURSE_COLOR_STORAGE_KEY, saved]])
  return { getItem: vi.fn(key => values.get(key) ?? null), setItem: vi.fn((key, value) => values.set(key, value)) }
}
const slots = (registry, entries = courses) => entries.map(course => registry.slotFor(course.id))

describe('stable local course identities', () => {
  it('allocates twelve different slots independently of course names, codes, institutions and input ordering', () => {
    const original = JSON.stringify(courses)
    const first = createCourseColorRegistry(() => backingStore())
    const reversed = createCourseColorRegistry(() => backingStore())
    first.register(Object.freeze(courses))
    reversed.register(courses.toReversed())
    expect(new Set(slots(first)).size).toBe(COURSE_COLOR_COUNT)
    expect(slots(reversed)).toEqual(slots(first))
    expect(first.slotFor(courses[0].id)).not.toBe(first.slotFor(courses[1].id))
    expect(JSON.stringify(courses)).toBe(original)
  })

  it('keeps existing colours on rename, reimport, lookup from a filtered view, addition and reload', () => {
    const storage = backingStore(), registry = createCourseColorRegistry(() => storage)
    registry.register(courses.slice(0, 5))
    const initial = slots(registry, courses.slice(0, 5))
    const changed = courses.map(course => ({ ...course, code: 'NEW101', name: 'Nytt visningsnavn' })).toReversed()
    registry.register(changed)
    expect(slots(registry, courses.slice(0, 5))).toEqual(initial)
    const writes = storage.setItem.mock.calls.length
    for (const course of changed.slice(0, 3)) expect(registry.slotFor(course.id)).not.toBeNull()
    registry.register(changed.toReversed())
    expect(storage.setItem).toHaveBeenCalledTimes(writes)
    const reloaded = createCourseColorRegistry(() => storage)
    reloaded.register(changed)
    expect(slots(reloaded)).toEqual(slots(registry))
    expect(storage.setItem.mock.calls.every(([key]) => key === COURSE_COLOR_STORAGE_KEY)).toBe(true)
  })

  it('retains deleted IDs for undo and prefers unused slots without recolouring survivors', () => {
    const storage = backingStore(), registry = createCourseColorRegistry(() => storage)
    registry.register(courses.slice(0, 2))
    const initial = slots(registry, courses.slice(0, 2))
    registry.register([courses[1], courses[2]])
    expect(registry.slotFor(courses[2].id)).not.toBe(initial[1])
    expect(registry.slotFor(courses[2].id)).not.toBe(initial[0])
    const restored = createCourseColorRegistry(() => storage)
    restored.register(courses.slice(0, 3))
    expect(slots(restored, courses.slice(0, 2))).toEqual(initial)
    expect(new Set(slots(restored, courses.slice(0, 3))).size).toBe(3)
    restored.register([])
    expect(slots(restored, courses.slice(0, 2))).toEqual(initial)
  })

  it('reuses slots predictably beyond twelve and preserves both removed and restored identities', () => {
    const storage = backingStore(), registry = createCourseColorRegistry(() => storage)
    registry.register(courses)
    const initial = slots(registry)
    const additional = Array.from({ length: 12 }, (_, index) => ({ id: `synthetic-extra-${index}` }))
    registry.register([...courses, additional[0]])
    expect(registry.slotFor(additional[0].id)).toBe(1)
    registry.register([...courses.slice(1), additional[0]])
    expect(slots(registry)).toEqual(initial)
    const reloaded = createCourseColorRegistry(() => storage)
    reloaded.register([...courses, ...additional])
    expect(slots(reloaded)).toEqual(initial)
    expect(reloaded.slotFor(additional[0].id)).toBe(1)
    const counts = Array(COURSE_COLOR_COUNT).fill(0)
    for (const slot of slots(reloaded, [...courses, ...additional])) counts[slot - 1] += 1
    expect(counts).toEqual(Array(COURSE_COLOR_COUNT).fill(2))
  })

  it('moves only a restored ID if its historic slot was reused and another slot is now free', () => {
    const storage = backingStore(), registry = createCourseColorRegistry(() => storage)
    registry.register(courses)
    const original = slots(registry), replacement = { id: 'synthetic-replacement' }
    registry.register(courses.slice(1))
    registry.register([...courses.slice(1), replacement])
    expect(registry.slotFor(replacement.id)).toBe(original[0])
    // A second deletion frees a slot before undo restores the first course.
    registry.register([...courses.slice(2), replacement])
    const reloaded = createCourseColorRegistry(() => storage)
    reloaded.register([courses[0], ...courses.slice(2), replacement])
    expect(reloaded.slotFor(courses[0].id)).toBe(original[1])
    expect(reloaded.slotFor(replacement.id)).toBe(original[0])
    expect(slots(reloaded, courses.slice(2))).toEqual(original.slice(2))
    expect(reloaded.slotFor(courses[1].id)).toBe(original[1])
    expect(new Set(slots(reloaded, [courses[0], ...courses.slice(2), replacement])).size).toBe(12)
  })

  it('repairs only one collision when thirteen active courses shrink to twelve', () => {
    const storage = backingStore(), registry = createCourseColorRegistry(() => storage)
    const extra = { id: 'synthetic-extra' }
    registry.register(courses)
    registry.register([...courses, extra])
    const active = [courses[0], ...courses.slice(2), extra]
    const before = new Map(active.map(course => [course.id, registry.slotFor(course.id)]))
    registry.register(active)
    expect(new Set(slots(registry, active)).size).toBe(12)
    expect(active.filter(course => registry.slotFor(course.id) !== before.get(course.id))).toEqual([extra])
    expect(registry.slotFor(courses[1].id)).toBe(2)
  })

  it('merges newer historical IDs before a stale registry writes its next registration', () => {
    const storage = backingStore()
    const first = createCourseColorRegistry(() => storage), stale = createCourseColorRegistry(() => storage)
    first.register(courses.slice(0, 2))
    stale.register(courses.slice(0, 2))
    first.register(courses.slice(0, 4))
    const newer = slots(first, courses.slice(0, 4))
    stale.register([courses[0], courses[4]])
    const saved = JSON.parse(storage.getItem(COURSE_COLOR_STORAGE_KEY))
    expect(courses.slice(0, 4).map(course => saved.assignments[course.id])).toEqual(newer)
    expect(stale.slotFor(courses[4].id)).toBe(5)
    expect(first.sync()).toBe(true)
    expect(slots(first, courses.slice(0, 5))).toEqual(slots(stale, courses.slice(0, 5)))
    const writes = storage.setItem.mock.calls.length
    expect(stale.sync()).toBe(false)
    expect(first.sync()).toBe(false)
    expect(storage.setItem).toHaveBeenCalledTimes(writes)
  })

  it('adopts another registry collision repair instead of restoring an older slot for that ID', () => {
    const storage = backingStore(), replacement = { id: 'synthetic-replacement' }
    const first = createCourseColorRegistry(() => storage), stale = createCourseColorRegistry(() => storage)
    first.register(courses)
    stale.register(courses)
    first.register([...courses.slice(1), replacement])
    first.register([...courses.slice(2), replacement])
    const restored = [courses[0], ...courses.slice(2), replacement]
    first.register(restored)
    expect(first.slotFor(courses[0].id)).toBe(2)
    expect(stale.slotFor(courses[0].id)).toBe(1)
    stale.register(restored)
    expect(slots(stale, restored)).toEqual(slots(first, restored))
    expect(new Set(slots(stale, restored)).size).toBe(12)
    expect(stale.slotFor(courses[1].id)).toBe(2)
    expect(JSON.parse(storage.getItem(COURSE_COLOR_STORAGE_KEY)).assignments[courses[0].id]).toBe(2)
  })

  it('retries failed writes for unchanged IDs and keeps a pending collision repair', () => {
    const storage = backingStore(), registry = createCourseColorRegistry(() => storage)
    registry.register(courses)
    const extra = { id: 'synthetic-extra' }
    registry.register([...courses, extra])
    const active = [courses[0], ...courses.slice(2), extra]
    storage.setItem.mockImplementationOnce(() => { throw Error('full') })
    registry.register(active)
    const repaired = slots(registry, active)
    expect(registry.slotFor(extra.id)).toBe(2)
    expect(JSON.parse(storage.getItem(COURSE_COLOR_STORAGE_KEY)).assignments[extra.id]).toBe(1)
    registry.register(active.toReversed())
    expect(slots(registry, active)).toEqual(repaired)
    const reloaded = createCourseColorRegistry(() => storage)
    reloaded.register(active)
    expect(slots(reloaded, active)).toEqual(repaired)
    expect(new Set(repaired).size).toBe(12)
  })

  it('merges another registry updates before retrying a failed write on synchronization', () => {
    const storage = backingStore()
    const first = createCourseColorRegistry(() => storage), pending = createCourseColorRegistry(() => storage)
    first.register(courses.slice(0, 2))
    pending.register(courses.slice(0, 2))
    storage.setItem.mockImplementationOnce(() => { throw Error('full') })
    pending.register(courses.slice(0, 3))
    first.register([courses[0], courses[1], courses[3]])
    pending.sync()
    const saved = JSON.parse(storage.getItem(COURSE_COLOR_STORAGE_KEY))
    expect(courses.slice(0, 4).every(course => Number.isInteger(saved.assignments[course.id]))).toBe(true)
    pending.register(courses.slice(0, 4))
    first.sync()
    expect(slots(first, courses.slice(0, 4))).toEqual(slots(pending, courses.slice(0, 4)))
    expect(new Set(slots(first, courses.slice(0, 4))).size).toBe(4)
  })

  it.each(['access', 'read', 'missing'])('recovers from unavailable %s without overwriting unseen persisted IDs', failure => {
    const storage = backingStore(), source = createCourseColorRegistry(() => storage)
    source.register(courses.slice(0, 3))
    let unavailable = true
    const getItem = storage.getItem
    storage.getItem = vi.fn(key => {
      if (unavailable && failure === 'read') throw Error('denied')
      return getItem(key)
    })
    const registry = createCourseColorRegistry(() => {
      if (unavailable && failure === 'access') throw Error('denied')
      return unavailable && failure === 'missing' ? undefined : storage
    })
    registry.register([courses[3]])
    expect(registry.slotFor(courses[3].id)).toBe(1)
    expect(storage.setItem).toHaveBeenCalledTimes(1)
    unavailable = false
    registry.register(courses.slice(0, 4))
    const saved = JSON.parse(storage.getItem(COURSE_COLOR_STORAGE_KEY))
    expect(courses.slice(0, 4).every(course => Number.isInteger(saved.assignments[course.id]))).toBe(true)
    expect(slots(registry, courses.slice(0, 3))).toEqual(slots(source, courses.slice(0, 3)))
    expect(new Set(slots(registry, courses.slice(0, 4))).size).toBe(4)
  })

  it('updates existing coloured nodes on storage/focus sync without replacing a draft or writing domain data', async () => {
    const storage = backingStore(), listeners = new Map(), properties = new Map()
    const draft = { value: 'Syntetisk ulagret utkast' }
    const node = { style: { setProperty: (key, value) => properties.set(key, value) }, dataset: {}, draft }
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('addEventListener', (type, listener) => listeners.set(type, listener))
    vi.stubGlobal('document', { querySelectorAll: vi.fn(() => [node]), activeElement: draft })
    vi.resetModules()
    try {
      const module = await import('../../src/course-colors.js')
      module.registerCourseColors(courses)
      module.applyCourseColor(node, courses[0].id)
      const remote = createCourseColorRegistry(() => storage), replacement = { id: 'synthetic-replacement' }
      remote.register([...courses.slice(1), replacement])
      remote.register([...courses.slice(2), replacement])
      remote.register([courses[0], ...courses.slice(2), replacement])
      const writes = storage.setItem.mock.calls.length
      listeners.get('storage')({ key: 'unrelated-key', storageArea: storage })
      expect(node.dataset.courseSlot).toBe('1')
      // Read the latest storage rather than trusting an older queued event value.
      listeners.get('storage')({ key: COURSE_COLOR_STORAGE_KEY, storageArea: storage, newValue: '{}' })
      expect(node.dataset.courseSlot).toBe('2')
      expect(properties.get('--course-color')).toBe('var(--course-2-marker)')
      expect(properties.get('--course-bg')).toBe('var(--course-2-bg)')
      expect(properties.get('--course-text')).toBe('var(--course-2-text)')
      expect(node.draft).toBe(draft)
      expect(draft.value).toBe('Syntetisk ulagret utkast')
      expect(document.activeElement).toBe(draft)
      listeners.get('focus')()
      expect(storage.setItem).toHaveBeenCalledTimes(writes)
      expect(storage.setItem.mock.calls.every(([key]) => key === COURSE_COLOR_STORAGE_KEY)).toBe(true)
    } finally {
      vi.unstubAllGlobals()
      vi.resetModules()
    }
  })

  it('uses neutral for absent, unregistered and display-only identifiers without creating preferences', () => {
    const storage = backingStore(), registry = createCourseColorRegistry(() => storage)
    registry.register([{}, { id: '' }, { id: ' ' }, null])
    for (const id of [undefined, null, '', ' ', 42, 'SAME101', 'unregistered']) expect(registry.slotFor(id)).toBeNull()
    expect(storage.setItem).not.toHaveBeenCalled()
    registry.register([{ id: 'ID' }, { id: 'id' }, { id: 'ID' }])
    expect(registry.slotFor('ID')).not.toBe(registry.slotFor('id'))
  })

  it.each(['{broken', 'null', '[]', '{"version":2,"assignments":{"a":3}}', '{"version":1,"assignments":[]}'])('recovers safely from invalid saved preferences: %s', saved => {
    const storage = backingStore(saved), registry = createCourseColorRegistry(() => storage)
    expect(() => registry.register(courses)).not.toThrow()
    expect(new Set(slots(registry)).size).toBe(COURSE_COLOR_COUNT)
  })

  it('preserves valid saved preferences and skips corrupt entries, including unsafe property names', () => {
    const storage = backingStore('{"version":1,"assignments":{"saved":9,"also-saved":3,"bad-zero":0,"bad-high":13,"bad-text":"4","":2,"__proto__":7}}')
    const registry = createCourseColorRegistry(() => storage)
    registry.register([{ id: 'saved' }, { id: 'also-saved' }, { id: '__proto__' }, { id: 'new' }])
    expect(registry.slotFor('saved')).toBe(9)
    expect(registry.slotFor('also-saved')).toBe(3)
    expect(registry.slotFor('__proto__')).toBe(7)
    expect(registry.slotFor('new')).not.toBe(9)
    expect(registry.slotFor('bad-zero')).toBeNull()
    expect(registry.slotFor('bad-high')).toBeNull()
    expect(registry.slotFor('bad-text')).toBeNull()
    expect(JSON.parse(storage.getItem(COURSE_COLOR_STORAGE_KEY)).assignments.__proto__).toBe(7)
  })

  it('repairs impossible duplicate automatic preferences while preserving the first assigned ID', () => {
    const storage = backingStore(JSON.stringify({ version: 1, assignments: Object.fromEntries(courses.map(course => [course.id, 4])) }))
    const registry = createCourseColorRegistry(() => storage)
    registry.register(courses.toReversed())
    expect(registry.slotFor(courses[0].id)).toBe(4)
    expect(new Set(slots(registry)).size).toBe(12)
    const reloaded = createCourseColorRegistry(() => storage)
    reloaded.register(courses)
    expect(slots(reloaded)).toEqual(slots(registry))
  })

  it('resolves legacy display text only to one known stable ID without changing the task', () => {
    const task = Object.freeze({ id: 'synthetic-task', course: ' test3 ' })
    const before = JSON.stringify(task)
    expect(resolvedCourseId(task, courses)).toBe(courses[2].id)
    expect(resolvedCourseId({ course: courses[3].name }, courses)).toBe(courses[3].id)
    expect(resolvedCourseId({ course: 'SAME101' }, courses)).toBeNull()
    expect(resolvedCourseId({ courseId: courses[0].id, course: 'SAME101' }, courses)).toBe(courses[0].id)
    expect(resolvedCourseId({ courseId: 'missing-id', course: 'TEST3' }, courses)).toBe('missing-id')
    expect(resolvedCourseId({ course: 'unknown' }, courses)).toBeNull()
    expect(resolvedCourseId({}, courses)).toBeNull()
    expect(JSON.stringify(task)).toBe(before)
  })

  it.each(['access', 'read', 'write'])('works in memory when local storage denies %s', failure => {
    const storage = backingStore()
    if (failure === 'read') storage.getItem = () => { throw Error('denied') }
    if (failure === 'write') storage.setItem = () => { throw Error('full') }
    const registry = createCourseColorRegistry(() => { if (failure === 'access') throw Error('denied'); return storage })
    expect(() => registry.register(courses)).not.toThrow()
    const before = slots(registry)
    registry.register(courses.toReversed())
    expect(slots(registry)).toEqual(before)
    expect(new Set(before).size).toBe(COURSE_COLOR_COUNT)
  })

  it('applies semantic variables for all variants and clears stale identity when a node becomes unassigned', () => {
    registerCourseColors(courses)
    const properties = new Map(), node = { style: { setProperty: (key, value) => properties.set(key, value) }, dataset: {} }
    applyCourseColor(node, courses[0].id)
    const slot = courseColorSlot(courses[0].id)
    expect(properties.get('--course-color')).toBe(`var(--course-${slot}-marker)`)
    expect(properties.get('--course-bg')).toBe(`var(--course-${slot}-bg)`)
    expect(properties.get('--course-text')).toBe(`var(--course-${slot}-text)`)
    expect(courseColor(courses[0].id)).toBe(properties.get('--course-color'))
    expect(node.dataset.courseColorId).toBe(courses[0].id)
    applyCourseColor(node)
    expect(properties.get('--course-color')).toBe('var(--course-neutral-marker)')
    expect(properties.get('--course-bg')).toBe('var(--course-neutral-bg)')
    expect(properties.get('--course-text')).toBe('var(--course-neutral-text)')
    expect(node.dataset.courseSlot).toBe('neutral')
    expect(node.dataset).not.toHaveProperty('courseColorId')
  })
})
