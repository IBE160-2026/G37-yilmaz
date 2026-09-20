import { expect } from '@playwright/test'

export const key = 'studieplanlegger:v1'
export const task = (id, deadlineLocal = '2026-09-03T12:00', estimatedMinutes = 30, completed = false) => ({
  id, title: `Oppgave ${id}`, course: 'IBE160', deadlineLocal, estimatedMinutes, completed,
})
export const rows = page => page.locator('#task-list > li')
export const row = (page, title) => rows(page).filter({ has: page.getByRole('heading', { name: title, exact: true, includeHidden: true }) })
export const checkbox = (page, title) => row(page, title).getByRole('checkbox', { name: `Fullført «${title}»`, exact: true, includeHidden: true })
export const edit = (page, title) => row(page, title).getByRole('button', { name: `Rediger «${title}»`, exact: true, includeHidden: true })
export const remove = (page, title) => row(page, title).getByRole('button', { name: `Slett «${title}»`, exact: true, includeHidden: true })
export const save = page => page.locator('#task-form').getByRole('button', { name: 'Lagre', exact: true })
export const raw = page => page.evaluate(key => localStorage.getItem(key), key)
export const saved = async page => JSON.parse(await raw(page))
// Legacy lifecycle assertions compare every study-data field; undo/trash has
// independent exact restoration and persistence regression coverage.
export const studyData = async page => { const { history, ...data } = await saved(page); return data }
export const writes = page => page.evaluate(() => window.writeAttempts)
export const ids = page => rows(page).evaluateAll(items => items.map(item => item.dataset.taskId))

export async function freeze(page, now = '2026-09-03T12:00:00+02:00') {
  // Pause before navigation. All later time changes are explicit test actions.
  await page.clock.install({ time: new Date(Date.parse(now) - 60_000) })
  await page.clock.pauseAt(new Date(now))
}

export async function seed(page, tasks, { view = 'week', now = '2026-09-03T12:00:00+02:00' } = {}) {
  await freeze(page, now)
  await page.goto('/')
  // Seed exactly once; reload and reopened pages must read what user actions saved.
  await page.evaluate(({ key, tasks }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, tasks })), { key, tasks })
  await instrumentWrites(page)
  await page.reload()
  await navigate(page, view)
  expect(await writes(page)).toEqual([])
}

// Navigate through the actual responsive controls, including the mobile overflow.
export async function navigate(page, view, { keyboard = false } = {}) {
  const target = page.locator(`#view-${view}`)
  const more = page.locator('#mobile-navigation-more')
  const activate = async control => {
    if (keyboard) {
      if (!await control.evaluate(element => element === document.activeElement)) await tabTo(page, control)
      await page.keyboard.press('Enter')
    } else await control.click()
  }
  if (!await target.isVisible()) {
    await expect(more).toBeVisible()
    await activate(more)
    await expect(more).toHaveAttribute('aria-expanded', 'true')
  }
  await expect(target).toBeVisible()
  await activate(target)
  await expect(target).toHaveAttribute('aria-pressed', 'true')
}

// Native modality blocks background focus even where controls are not disabled.
export async function expectModal(page, formId) {
  const dialog = page.locator('dialog').filter({ has: page.locator(`#${formId}`) })
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true)
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
  const focused = await page.evaluate(() => document.activeElement.id)
  await page.locator('#view-all').focus()
  expect(await page.evaluate(() => document.activeElement.id)).toBe(focused)
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
}

export async function instrumentWrites(page) {
  await page.addInitScript(key => {
    window.writeAttempts = []
    const originalWrite = Storage.prototype.setItem
    const originalRead = Storage.prototype.getItem
    Storage.prototype.setItem = function (storageKey, value) {
      if (storageKey === key) {
        window.writeAttempts.push({
          key: storageKey, value, previous: originalRead.call(this, storageKey),
          visible: document.querySelector('#task-list')?.textContent,
          rows: Array.from(document.querySelectorAll('#task-list > li'), item => ({
            id: item.dataset.taskId, text: item.textContent, status: item.querySelector('.status-badge')?.textContent,
          })),
          feedback: document.querySelector('#feedback')?.textContent,
        })
        if (window.failWrite) throw Error('Injected test write failure')
      }
      return originalWrite.call(this, storageKey, value)
    }
  }, key)
}

export async function filter(page, minutes = '30', { alternatives = true } = {}) {
  await navigate(page, 'time')
  await page.locator('#available-minutes').fill(minutes)
  await page.locator('#time-form').getByRole('button', { name: 'Vis forslag', exact: true }).click()
  // Older regression flows operate on arbitrary matching tasks. New suggestion tests
  // opt out to verify that a fresh selection initially shows only the main proposal.
  if (alternatives) await showAlternatives(page)
}

export async function showAlternatives(page) {
  const toggle = page.locator('#toggle-alternatives')
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
}

export async function fillDraft(page, fields) {
  for (const [field, value] of Object.entries(fields)) {
    if (field === 'deadlineLocal') await fillDeadline(page, String(value))
    else {
      const control = field === 'estimatedMinutes' ? 'remainingMinutes' : field
      if (!['title', 'remainingMinutes'].includes(control)) await openTaskDetails(page)
      await page.locator(`#${control}`).fill(String(value))
    }
  }
}

export async function openTaskDetails(page) {
  const details = page.locator('#task-form .task-optional-details')
  if (await details.count() && !await details.evaluate(element => element.open)) await details.locator(':scope > summary').click()
}

export async function openImportMethod(page, kind) {
  const choice = page.locator(`[data-method="${kind}"]`)
  if (!await choice.isVisible()) await page.locator('#connected-import-open').click()
  await choice.click()
}

export async function openCourseImport(page) {
  await openImportMethod(page, 'institution')
  const details = page.locator('details').filter({ has: page.locator('#course-import-form') })
  if (!await details.evaluate(node => node.open)) await details.locator(':scope > summary').click()
}

export async function fillDeadline(page, value) {
  await openTaskDetails(page)
  const [date = '', time = ''] = value.split('T')
  await page.locator('#deadlineDate').fill(date)
  await page.locator('#deadlineTime').fill(time)
}

export async function openMenu(page, title) {
  await openRowMenu(row(page, title))
}

export async function openRowMenu(item) {
  const menu = item.locator('.task-menu')
  if (await menu.count() && !await menu.evaluate(element => element.open)) {
    await menu.locator('summary').focus()
    await menu.locator('summary').press('Enter')
  }
}

export function deadlineLabel(value, currentYear) {
  const [date, time] = value.split('T')
  const [year, month, day] = date.split('-').map(Number)
  const months = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember']
  return `${day}. ${months[month - 1]}${currentYear !== undefined && year !== currentYear ? ` ${year}` : ''} kl. ${time}`
}

// Follow the real keyboard order while allowing the redesigned navigation and
// native date segments to have different numbers of intermediate Tab stops.
export async function tabTo(page, control, key = 'Tab') {
  for (let stop = 0; stop < 150; stop++) {
    await page.keyboard.press(key)
    if (await control.evaluate(element => element === document.activeElement)) {
      await expectFocusFits(page, control)
      return
    }
  }
  await expectFocusFits(page, control)
}

export async function deleteTask(page, title, accept = true) {
  await openMenu(page, title)
  const dialogPromise = page.waitForEvent('dialog')
  const actionPromise = remove(page, title).click()
  const dialog = await dialogPromise
  expect(dialog.type()).toBe('confirm')
  expect(dialog.message()).toContain(title)
  if (accept) await dialog.accept()
  else await dialog.dismiss()
  await actionPromise
}

export async function expectFocusFits(page, control) {
  await expect(control).toBeFocused()
  await expect(control).toHaveCSS('outline-style', 'solid')
  const bounds = await control.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const outlineWidth = Number.parseFloat(style.outlineWidth)
    const outset = Math.max(0, outlineWidth + Number.parseFloat(style.outlineOffset))
    return {
      left: rect.left - outset, top: rect.top - outset,
      right: rect.right + outset, bottom: rect.bottom + outset,
      width: innerWidth, height: innerHeight, outlineWidth,
      pageFits: document.documentElement.scrollWidth <= innerWidth,
    }
  })
  expect(bounds.outlineWidth).toBeGreaterThan(0)
  expect(bounds.pageFits).toBe(true)
  expect(bounds.left, 'Focused control outline crosses the left viewport edge').toBeGreaterThanOrEqual(0)
  expect(bounds.top, 'Focused control outline crosses the top viewport edge').toBeGreaterThanOrEqual(0)
  expect(bounds.right, 'Focused control outline crosses the right viewport edge').toBeLessThanOrEqual(bounds.width)
  expect(bounds.bottom, 'Focused control outline crosses the bottom viewport edge').toBeLessThanOrEqual(bounds.height)
}
