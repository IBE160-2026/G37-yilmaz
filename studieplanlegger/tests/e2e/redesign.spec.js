import { test, expect } from '@playwright/test';

const tasks = [
  { id: 'redesign-only-1', title: 'Fullfør funksjoner og løkker', course: 'TDT4110', deadlineLocal: '2026-09-08T14:00', estimatedMinutes: 90, remainingMinutes: 25, completed: false, priority: 3 },
  { id: 'redesign-only-2', title: 'Les kapittel 4 om databaser', course: 'IBE160', deadlineLocal: '2026-09-10T12:00', estimatedMinutes: 45, completed: false },
  { id: 'redesign-only-3', title: 'Forbered seminar', course: 'EXPH0300', deadlineLocal: '2026-09-11T09:00', estimatedMinutes: 20, completed: false },
];
async function seed(page) {
  await page.clock.install({ time: new Date('2026-09-07T08:00:00Z') });
  await page.addInitScript(data => localStorage.setItem('studieplanlegger:v1', JSON.stringify({ schemaVersion: 1, tasks: data })), tasks);
  await page.goto('/');
}

for (const width of [1440, 390]) {
  test(`redesign preserves suggestions, navigation and calendar at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await seed(page);
    await expect(page.locator('#page-heading')).toHaveText('Oversikt');
    await expect(page.locator('#compact-agenda')).toBeVisible();
    await expect(page.locator('.calendar-month-view')).toBeHidden();
    const illustration = page.locator('.focus-visual img');
    await expect(illustration).toBeVisible();
    expect(await illustration.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await page.locator('[data-minutes="15"]').click();
    await expect(page.locator('#available-minutes')).toHaveValue('15');
    await expect(page.locator('#dashboard-suggestions .primary-suggestion')).toContainText('deløkt');
    await page.locator('[data-minutes="30"]').click();
    await page.locator('#time-form button[type="submit"]').click();
    const primary = page.locator('.primary-suggestion:visible').first();
    await expect(primary).toContainText(tasks[0].title);
    await expect(primary.locator('.capacity-explanation summary')).toHaveText('Ingen studieøkt planlagt ennå.');
    await primary.getByRole('button', { name: 'Åpne oppgave', exact: false }).click();
    await expect(page.locator('#title')).toHaveValue(tasks[0].title);
    await page.locator('#cancel-task').click();
    await page.locator('#view-overview').click();
    await page.getByRole('button', { name: 'Månedsvisning', exact: true }).click();
    await expect(page.locator('.calendar-month-view')).toBeVisible();
    await page.locator('[data-calendar-date="2026-09-08"]').click();
    await expect(page.locator('.calendar-day-list')).toContainText(tasks[0].title);
    await page.getByRole('button', { name: 'Agenda', exact: true }).click();
    await page.locator('#compact-agenda').getByRole('button', { name: tasks[0].title, exact: false }).click();
    await expect(page.locator('#title')).toHaveValue(tasks[0].title);
    await page.locator('#cancel-task').click();
    await page.locator('#view-subjects').click();
    await expect(page.locator('#subjects-panel')).toBeVisible();
    await expect(page.locator('#page-heading')).toHaveText('Mine emner');
    if (width < 761) {
      await page.locator('#mobile-navigation-more').click();
      await page.locator('#view-capacity').click();
      await expect(page.locator('#capacity-panel')).toBeVisible();
      await expect(page.locator('#mobile-navigation-more')).toBeFocused();
    }
    await page.locator('#view-overview').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('studieplanlegger:v1')).tasks)).toEqual(tasks);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `artifacts/redesign-${width}.png`, fullPage: true });
  });
}

test('reduced motion, custom time and visible keyboard focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page);
  await page.locator('#available-minutes').fill('45');
  await expect(page.locator('[data-minutes="45"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#available-minutes').fill('abc');
  await page.locator('#time-form button[type="submit"]').click();
  await expect(page.locator('#available-minutes-error')).not.toBeEmpty();
  await page.locator('[data-minutes="30"]').click();
  await page.locator('#available-minutes').focus();
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => ({ width: getComputedStyle(document.activeElement).outlineWidth, style: getComputedStyle(document.activeElement).outlineStyle }));
  expect(focus.style).toBe('solid');
  expect(parseInt(focus.width)).toBeGreaterThanOrEqual(2);
  expect(await page.locator('.focus-visual img').evaluate(img => getComputedStyle(img).animationName)).toBe('none');
});
