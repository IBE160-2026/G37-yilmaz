import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const source = readFileSync(new URL('../../public/theme-init.js', import.meta.url), 'utf8')
const key = 'ajour:appearance:v1'
function boot({ stored, dark = false, deniedRead = false, deniedWrite = false } = {}) {
  const values = new Map(stored === undefined ? [] : [[key, stored]])
  const writes = [], osListeners = [], windowListeners = {}
  const root = { dataset: {}, style: {} }, meta = {}
  const media = { matches: dark, addEventListener: (_, fn) => osListeners.push(fn) }
  const storage = {
    getItem: key => { if (deniedRead) throw Error('Synthetic denied read'); return values.get(key) ?? null },
    setItem: (key, value) => { if (deniedWrite) throw Error('Synthetic denied write'); writes.push([key, value]); values.set(key, value) },
  }
  const window = { localStorage: storage, matchMedia: () => media, addEventListener: (name, fn) => { windowListeners[name] = fn } }
  const document = { documentElement: root, querySelector: () => meta }
  runInNewContext(source, { window, document })
  return {
    appearance: window.ajourAppearance, root, meta, writes, values,
    os(value) { media.matches = value; osListeners.forEach(fn => fn({ matches: value })) },
    external(value) { if (value === null) values.delete(key); else values.set(key, value); windowListeners.storage({ key }) },
  }
}

describe('theme bootstrap before the application module', () => {
  it('paints the OS theme without any app markup and tracks subsequent OS changes without writing', () => {
    const page = boot({ dark: true })
    expect(page.appearance.getState()).toEqual({ preference: 'system', theme: 'dark' })
    expect(page.root.dataset.theme).toBe('dark')
    expect(page.root.style).toMatchObject({ colorScheme: 'dark', backgroundColor: '#211d24' })
    expect(page.meta.content).toBe('#211d24')
    page.os(false)
    expect(page.root.dataset.theme).toBe('light')
    expect(page.writes).toEqual([])
  })

  it('persists explicit preference separately, ignores OS changes and restores on reload', () => {
    const page = boot({ dark: true })
    page.appearance.setPreference('light')
    page.os(false); page.os(true)
    expect(page.appearance.getState()).toEqual({ preference: 'light', theme: 'light' })
    expect(page.writes.map(([name]) => name)).toEqual([key])
    expect(boot({ dark: true, stored: page.values.get(key) }).root.dataset.theme).toBe('light')
    page.appearance.setPreference('system')
    expect(page.root.dataset.theme).toBe('dark')
    page.os(false)
    expect(page.root.dataset.theme).toBe('light')
  })

  it.each([true, false])('toggles System to the opposite displayed theme with OS dark=%s', dark => {
    const page = boot({ dark })
    page.appearance.toggle()
    const expected = dark ? 'light' : 'dark'
    expect(page.appearance.getState()).toEqual({ preference: expected, theme: expected })
    expect(JSON.parse(page.values.get(key))).toEqual({ version: 1, theme: expected })
  })

  it.each(['{invalid', 'null', '[]', '"dark"', '{"version":2,"theme":"dark"}', '{"version":1,"theme":"sepia"}'])('uses valid defaults for invalid storage %s', stored => {
    expect(boot({ stored, dark: true }).appearance.getState()).toEqual({ preference: 'system', theme: 'dark' })
  })

  it('remains usable when storage access and writes fail', () => {
    const page = boot({ dark: true, deniedRead: true, deniedWrite: true })
    page.appearance.toggle()
    expect(page.root.dataset.theme).toBe('light')
    page.os(true)
    expect(page.root.dataset.theme).toBe('light')
    page.appearance.setPreference('system')
    expect(page.root.dataset.theme).toBe('dark')
  })

  it('synchronizes controls and other tabs without triggering persistence or unrelated app work', () => {
    const page = boot(), observations = []
    const stop = page.appearance.subscribe(state => observations.push(state))
    page.external('{"version":1,"theme":"dark"}')
    expect(observations.at(-1)).toEqual({ preference: 'dark', theme: 'dark' })
    page.external(null)
    expect(observations.at(-1)).toEqual({ preference: 'system', theme: 'light' })
    stop(); page.os(true)
    expect(observations).toHaveLength(3)
    expect(page.writes).toEqual([])
  })
})
