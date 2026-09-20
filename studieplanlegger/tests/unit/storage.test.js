import { it, expect, vi } from 'vitest'
import { createStorage, STORAGE_KEY } from '../../src/storage.js'
import { editTask, deleteTask } from '../../src/tasks.js'
const task = { id: 'a', title: 'Title', course: 'Course', deadlineLocal: '2026-09-10T12:30', estimatedMinutes: 45, completed: false }
it('reads missing and valid without writing', () => {
  const backing = { getItem: vi.fn(() => null), setItem: vi.fn() }
  const storage = createStorage(() => backing)
  expect(storage.read()).toEqual({ ok: true, tasks: [] })
  backing.getItem.mockReturnValue(JSON.stringify({ schemaVersion: 1, tasks: [task] }))
  expect(storage.read()).toEqual({ ok: true, tasks: [task] })
  expect(backing.setItem).not.toHaveBeenCalled()
})
it.each(['{', 'null', '{}', '{"schemaVersion":2,"tasks":[]}', JSON.stringify({ schemaVersion: 1, tasks: [task, task] }), JSON.stringify({ schemaVersion: 1, tasks: [{ ...task, title: '' }] })])('preserves bad raw %s', raw => {
  const backing = { getItem: () => raw, setItem: vi.fn() }
  expect(createStorage(() => backing).read().ok).toBe(false)
  expect(backing.setItem).not.toHaveBeenCalled()
  expect(backing.getItem()).toBe(raw)
})
it('catches access and read exceptions', () => {
  expect(createStorage(() => { throw Error() }).read().ok).toBe(false)
  expect(createStorage(() => ({ getItem() { throw Error() } })).read().ok).toBe(false)
})
it('validates before one complete write; retries failure', () => {
  const prior = JSON.stringify({ schemaVersion: 1, tasks: [task] })
  let raw = prior
  let failWrite = true
  const candidate = [task, { ...task, id: 'b' }]
  const backing = {
    getItem: vi.fn(key => { expect(key).toBe(STORAGE_KEY); return raw }),
    setItem: vi.fn((key, value) => {
      expect(key).toBe(STORAGE_KEY)
      if (failWrite) throw Error()
      raw = value
    }),
  }
  const storage = createStorage(() => backing)
  expect(storage.write([task, task]).ok).toBe(false)
  expect(backing.setItem).not.toHaveBeenCalled()
  expect(storage.write(candidate).ok).toBe(false)
  expect(raw).toBe(prior)
  expect(storage.read()).toEqual({ ok: true, tasks: [task] })
  failWrite = false
  expect(storage.write(candidate).ok).toBe(true)
  expect(backing.setItem).toHaveBeenCalledTimes(2)
  expect(JSON.parse(raw)).toEqual({ schemaVersion: 1, tasks: candidate })
  expect(storage.read()).toEqual({ ok: true, tasks: candidate })
})

it.each(['edit', 'delete'])('%s candidate validates the full list, preserves raw on failure and retries one write', action => {
  const saved = [task, { ...task, id: 'selected', completed: true }]
  const prior = JSON.stringify({ schemaVersion: 1, tasks: saved })
  let raw = prior
  let failWrite = true
  const backing = {
    getItem: () => raw,
    setItem: vi.fn((key, value) => {
      expect(key).toBe(STORAGE_KEY)
      if (failWrite) throw Error('storage unavailable')
      raw = value
    }),
  }
  const storage = createStorage(() => backing)
  const result = action === 'edit'
    ? editTask(saved, 'selected', { ...task, title: 'Rettet', estimatedMinutes: '90' })
    : deleteTask(saved, 'selected')
  const invalid = result.tasks.map((task, index) => index === 0 ? { ...task, course: 42 } : task)
  expect(storage.write(invalid)).toEqual({ ok: false, reason: 'invalid' })
  expect(backing.setItem).not.toHaveBeenCalled()
  expect(storage.write(result.tasks)).toEqual({ ok: false, reason: 'unwritable' })
  expect(raw).toBe(prior)
  expect(storage.read()).toEqual({ ok: true, tasks: saved })
  failWrite = false
  expect(storage.write(result.tasks)).toEqual({ ok: true })
  expect(backing.setItem).toHaveBeenCalledTimes(2)
  expect(storage.read()).toEqual({ ok: true, tasks: result.tasks })
})
