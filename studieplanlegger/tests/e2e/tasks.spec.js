import { navigate } from './helpers.js'
import { fillDeadline, openMenu, openTaskDetails } from './helpers.js'
import { test, expect } from '@playwright/test'
const key = 'studieplanlegger:v1'
const task = { id: 'old', title: 'Eksisterende', course: 'IBE160', deadlineLocal: '2026-09-20T12:00', estimatedMinutes: 60, completed: false }
async function expectResetForm(page) {
  const create = await page.locator('#new-task').isVisible() ? page.locator('#new-task') : page.locator('#connected-onboarding').getByRole('button', { name: 'Legg til første oppgave', exact: true })
  await create.click()
  for (const id of ['title', 'course', 'deadlineLocal', 'remainingMinutes']) {
    await expect(page.locator(`#${id}`)).toHaveValue('')
    await expect(page.locator(`#${id}-error`)).toHaveText('')
    await expect(page.locator(`#${id === 'deadlineLocal' ? 'deadlineTime' : id}`)).toHaveAttribute('aria-invalid', 'false')
  }
}
async function fill(page, title = ' Ny oppgave ') {
  const create = await page.locator('#new-task').isVisible() ? page.locator('#new-task') : page.locator('#connected-onboarding').getByRole('button', { name: 'Legg til første oppgave', exact: true })
  await create.click()
  await page.getByLabel('Tittel', { exact: true }).fill(title)
  await openTaskDetails(page)
  await page.getByLabel('Emne (valgfritt)', { exact: true }).fill(' IBE160 ')
  await fillDeadline(page, '2026-10-25T02:30')
  await page.locator('#remainingMinutes').fill('45')
}
async function instrument(page, raw = null) {
  await page.addInitScript(({ key, raw }) => {
    if (raw !== null) localStorage.setItem(key, raw)
    window.writes = []
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (k, v) {
      window.writes.push({ value: v, visible: document.querySelector('#task-list').textContent, feedback: document.querySelector('#feedback').textContent })
      if (window.failWrite) throw Error('test')
      return original.call(this, k, v)
    }
  }, { key, raw })
}
test('one write before success, reload, reopen and literal text', async ({ page, context }, testInfo) => {
  await instrument(page)
  await page.goto('/')
  await navigate(page, 'all')
  await fill(page, '<img src=x onerror=alert(1)>')
  await page.getByRole('button', { name: 'Lagre', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Oppgave lagret')
  const writes = await page.evaluate(() => window.writes)
  expect(writes).toHaveLength(1)
  expect(writes[0].visible).toBe('')
  expect(writes[0].feedback).not.toContain('Oppgave lagret')
  const saved = JSON.parse(writes[0].value).tasks[0]
  expect(saved).toMatchObject({ title: '<img src=x onerror=alert(1)>', course: 'IBE160', deadlineLocal: '2026-10-25T02:30', estimatedMinutes: null, remainingMinutes: 45, completed: false })
  expect(saved.id.length).toBeGreaterThan(0)
  await expectResetForm(page)
  await page.reload()
  await navigate(page, 'all')
  await expect(page.locator('#task-list li')).toHaveCount(1)
  await expect(page.locator('#task-list li')).toHaveAttribute('data-task-id', saved.id)
  expect(await page.evaluate(() => window.writes)).toEqual([])
  await page.close()
  const reopened = await context.newPage()
  await reopened.goto('/')
  await navigate(reopened, 'all')
  await expect(reopened.locator('#task-list li')).toHaveCount(1)
  await expect(reopened.locator('#task-list li')).toHaveAttribute('data-task-id', saved.id)
  await expect(reopened.locator('#task-list')).toContainText('25. oktober kl. 02:30')
  await expect(reopened.locator('#task-list')).toContainText('Ikke fullført')
  await expect(reopened.locator('#task-list')).toContainText('<img src=x onerror=alert(1)>')
  await expect(reopened.locator('#task-list')).toContainText('IBE160')
  await expect(reopened.locator('#task-list')).toContainText('Gjenstående arbeid: 45 min')
  await expect(reopened.locator('#task-list img')).toHaveCount(0)
})
test('write failure retains prior tasks and draft; retry appends once', async ({ page }, testInfo) => {
  const raw = JSON.stringify({ schemaVersion: 1, tasks: [task] })
  await instrument(page, raw)
  await page.goto('/')
  await navigate(page, 'all')
  await fill(page)
  await fillDeadline(page, '2026-09-01T12:30')
  await page.evaluate(() => { window.failWrite = true })
  await page.getByRole('button', { name: 'Lagre', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Endringen ble ikke lagret')
  await expect(page.locator('#title')).toHaveValue(' Ny oppgave ')
  await expect(page.locator('#course')).toHaveValue(' IBE160 ')
  await expect(page.locator('#deadlineLocal')).toHaveValue('2026-09-01T12:30')
  await expect(page.locator('#remainingMinutes')).toHaveValue('45')
  await expect(page.locator('#task-list li')).toHaveCount(1)
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw)
  await page.evaluate(() => { window.failWrite = false })
  await page.getByRole('button', { name: 'Lagre', exact: true }).click()
  await expect(page.locator('#task-list li')).toHaveCount(2)
  await expect(page.locator('#task-list li').first()).toContainText('Ny oppgave')
  const ids = await page.locator('#task-list li').evaluateAll(items => items.map(item => item.dataset.taskId))
  expect(new Set(ids).size).toBe(2)
  expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).tasks.map(t => t.title)).toEqual(['Eksisterende', 'Ny oppgave'])
  expect(await page.evaluate(() => window.writes.length)).toBe(2)
})
test('invalid fields and cancel never write; retain valid inputs', async ({ page }, testInfo) => {
  await instrument(page)
  await page.goto('/')
  await navigate(page, 'all')
  await fill(page, ' ')
  await fillDeadline(page, '2026-03-29T02:30')
  await page.locator('#remainingMinutes').fill('9007199254740992')
  await page.getByRole('button', { name: 'Lagre', exact: true }).click()
  for (const id of ['title', 'deadlineLocal', 'remainingMinutes']) {
    await expect(page.locator(`#${id === 'deadlineLocal' ? 'deadlineTime' : id}`)).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator(`#${id === 'deadlineLocal' ? 'deadlineTime' : id}`)).toHaveAttribute('aria-describedby', id === 'remainingMinutes' ? 'remainingMinutes-help remainingMinutes-error' : `${id}-error`)
    await expect(page.locator(`#${id}-error`)).not.toHaveText('')
  }
  await expect(page.locator('#course')).toHaveValue(' IBE160 ')
  await expect(page.locator('#title')).toBeFocused()
  await page.locator('#cancel-task').click()
  await expectResetForm(page)
  expect(await page.evaluate(() => window.writes)).toEqual([])
})
test('equal deadlines retain creation order and existing completed status after reload', async ({ page }, testInfo) => {
  const completed = { ...task, completed: true }
  await page.goto('/')
  await page.evaluate(({ key, completed }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, tasks: [completed] })), { key, completed })
  await page.reload()
  await navigate(page, 'all')
  await fill(page)
  await fillDeadline(page, completed.deadlineLocal)
  await page.getByRole('button', { name: 'Lagre', exact: true }).click()
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).tasks, key)
  expect(saved).toHaveLength(2)
  expect(saved[0]).toEqual(completed)
  expect(saved[1]).toMatchObject({ title: 'Ny oppgave', completed: false, deadlineLocal: completed.deadlineLocal })
  expect(saved[1].id).not.toBe(completed.id)
  await page.reload()
  await navigate(page, 'all')
  const items = page.locator('#task-list li')
  await expect(items).toHaveCount(2)
  await expect(items.nth(0)).toHaveAttribute('data-task-id', completed.id)
  await expect(items.nth(0)).toContainText('Fullført')
  await expect(items.nth(1)).toHaveAttribute('data-task-id', saved[1].id)
  await expect(items.nth(1)).toContainText('Ikke fullført')
})
for (const raw of ['{', JSON.stringify({ schemaVersion: 2, tasks: [] }), JSON.stringify({ schemaVersion: 1, tasks: [{ ...task, estimatedMinutes: 0 }] }), JSON.stringify({ schemaVersion: 1, tasks: [task, task] })]) {
  test(`bad read preserves ${raw}`, async ({ page }, testInfo) => {
    await instrument(page, raw)
    await page.goto('/')
    await expect(page.locator('#new-task')).toBeDisabled()
    await expect(page.locator('#empty-tasks')).not.toBeVisible()
    await expect(page.getByRole('button', { name: /^Rediger / })).toHaveCount(0)
    await expect(page.locator('#task-list').getByRole('button', { name: /^Slett / })).toHaveCount(0)
    await expect(page.locator('#task-list').getByRole('checkbox')).toHaveCount(0)
    await expect(page.locator('.personalization-settings input')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Slett arbeidshistorikk', exact: true })).toBeDisabled()
    await page.locator('#retry-read').click()
    await expect(page.getByRole('button', { name: /^Rediger / })).toHaveCount(0)
    await expect(page.locator('#task-list').getByRole('button', { name: /^Slett / })).toHaveCount(0)
    await expect(page.locator('#task-list').getByRole('checkbox')).toHaveCount(0)
    await expect(page.locator('.personalization-settings input')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Slett arbeidshistorikk', exact: true })).toBeDisabled()
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw)
    expect(await page.evaluate(() => window.writes)).toEqual([])
    await page.evaluate(key => localStorage.removeItem(key), key)
    await page.locator('#retry-read').click()
    await expect(page.locator('#new-task')).toBeEnabled()
    await expect(page.locator('#connected-onboarding')).toBeVisible()
    await expect(page.locator('#connected-onboarding').getByRole('button', { name: 'Legg til første oppgave', exact: true })).toBeEnabled()
  })
}
for (const method of ['getter', 'getItem']) {
  test(`read exception ${method} recovers`, async ({ page }, testInfo) => {
    const raw = JSON.stringify({ schemaVersion: 1, tasks: [task] })
    await page.addInitScript(({ method, key, raw }) => {
      const storage = window.localStorage
      const originalRead = Storage.prototype.getItem
      const originalWrite = Storage.prototype.setItem
      originalWrite.call(storage, key, raw)
      window.inspectRaw = () => originalRead.call(storage, key)
      window.writes = []
      Storage.prototype.setItem = function (k, value) {
        window.writes.push({ key: k, value })
        return originalWrite.call(this, k, value)
      }
      window.failRead = true
      if (method === 'getter') {
        Object.defineProperty(window, 'localStorage', { get() { if (window.failRead) throw Error(); return storage } })
      } else {
        Storage.prototype.getItem = function (...args) { if (window.failRead) throw Error(); return originalRead.apply(this, args) }
      }
    }, { method, key, raw })
    await page.goto('/')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.locator('#new-task')).toBeDisabled()
    await expect(page.locator('#empty-tasks')).not.toBeVisible()
    await expect(page.getByRole('button', { name: /^Rediger / })).toHaveCount(0)
    await expect(page.locator('#task-list').getByRole('button', { name: /^Slett / })).toHaveCount(0)
    await expect(page.locator('#task-list').getByRole('checkbox')).toHaveCount(0)
    await expect(page.locator('.personalization-settings input')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Slett arbeidshistorikk', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Prøv igjen' }).click()
    await expect(page.locator('#new-task')).toBeDisabled()
    expect(await page.evaluate(() => window.inspectRaw())).toBe(raw)
    expect(await page.evaluate(() => window.writes)).toEqual([])
    await page.evaluate(() => { window.failRead = false })
    await page.locator('#retry-read').click()
    await expect(page.locator('#new-task')).toBeEnabled()
    await expect(page.locator('#new-task')).toBeFocused()
    await navigate(page, 'all')
    await expect(page.locator('#task-list li')).toHaveCount(1)
    await expect(page.locator('#task-list li')).toHaveAttribute('data-task-id', task.id)
    await expect(page.locator('#task-list')).toContainText(task.title)
    await openMenu(page, task.title)
    await expect(page.locator('#task-list').getByRole('button', { name: /^Rediger / })).toBeEnabled()
    await expect(page.locator('#task-list').getByRole('button', { name: /^Slett / })).toBeEnabled()
    await expect(page.locator('#task-list').getByRole('checkbox')).toBeEnabled()
    expect(await page.evaluate(() => window.inspectRaw())).toBe(raw)
    expect(await page.evaluate(() => window.writes)).toEqual([])
  })
}

test('does not show an empty list or enable creation before storage has been read', async ({ page }, testInfo) => {
  await instrument(page, '{invalid json')
  let release
  const held = new Promise(resolve => { release = resolve })
  await page.route('**/src/main.js', async route => { await held; await route.continue() })
  try {
    await page.goto('/', { waitUntil: 'commit' })
    await expect(page.locator('#new-task')).toBeDisabled()
    await expect(page.locator('#empty-tasks')).not.toBeVisible()
  } finally { release() }
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('#empty-tasks')).not.toBeVisible()
  expect(await page.evaluate(() => window.writes)).toEqual([])
})
