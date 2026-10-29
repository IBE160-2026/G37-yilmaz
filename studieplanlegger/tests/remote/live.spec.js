import { test } from '@playwright/test'
import { observe, browserMode } from './diagnostics.js'

// Config grep limits these existing actual-transport tests to the approved
// HiMolde IT 2026/IBE110/IBE430/IBE160 and NTNU ARK1001/EXPH0100 cases.
// No route interception or synthetic response belongs in this project.
import '../e2e/himolde-program-teaching-live.spec.js'
import '../e2e/connected-public-teaching-live.spec.js'

// One unavailable upstream must not suppress checks of the other bounded cases.
test.describe.configure({ mode: 'default' })

const observations = new WeakMap()
test.beforeEach(async ({ page }) => { observations.set(page, observe(page)) })
test.afterEach(async ({ page }, info) => {
  if (info.status !== 'skipped') await browserMode(page)
  await observations.get(page).finish(info)
})
