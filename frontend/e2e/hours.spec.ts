import { test, expect } from '@playwright/test';

test('saves whole-week hours, warns about kept sessions and requires timezone replacement ranges', async ({
  page,
}, info) => {
  let timezone = 'UTC';
  let ranges: { weekday: number; startMinute: number; lengthHours: number }[] =
    [];
  let replacement: unknown;
  const warning = {
    id: '00000000-0000-4000-8000-000000000001',
    startAt: new Date(Date.now() + 86400000).toISOString(),
    endAt: new Date(Date.now() + 89400000).toISOString(),
  };
  await page.route('**/api/v1/users/me', (route) =>
    route.fulfill({
      json: {
        id: 'p',
        name: 'Alex Example',
        role: 'professional',
        timezone,
        title: 'Counsellor',
        bio: 'Fictional.',
        specialisations: [],
        languages: [],
      },
    }),
  );
  await page.route('**/api/v1/notifications**', (route) =>
    route.fulfill({
      json: route.request().url().includes('unread-count')
        ? { count: 0 }
        : { items: [], nextCursor: null },
    }),
  );
  await page.route('**/api/v1/working-hours', (route) => {
    if (route.request().method() === 'PUT')
      ranges = route.request().postDataJSON().ranges;
    return route.fulfill({ json: { timezone, ranges, warnings: [warning] } });
  });
  await page.route('**/api/v1/users/me/timezone', (route) => {
    replacement = route.request().postDataJSON();
    timezone = route.request().postDataJSON().timezone;
    ranges = route.request().postDataJSON().ranges;
    return route.fulfill({ json: { timezone, ranges, warnings: [] } });
  });
  await page.goto('/pro/hours');
  await page
    .getByRole('button', { name: 'Add Monday range', exact: true })
    .click();
  await page.getByRole('combobox', { name: 'Monday range 1 length' }).click();
  await page
    .getByRole('option', {
      name: info.project.name === 'mobile' ? '4h' : '4 hours',
      exact: true,
    })
    .click();
  await page
    .getByRole('combobox', { name: 'Monday range 1 start minute' })
    .click();
  await page.getByRole('option', { name: '15', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Monday range 1 start hour' })
    .click();
  await page.getByRole('option', { name: '10', exact: true }).click();
  const startHour = page.getByRole('combobox', {
    name: 'Monday range 1 start hour',
  });
  const startMinute = page.getByRole('combobox', {
    name: 'Monday range 1 start minute',
  });
  await startHour.click();
  await expect(
    page.getByRole('option', { name: '20', exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  await startMinute.click();
  await page.getByRole('option', { name: '00', exact: true }).click();
  await startHour.click();
  await page.getByRole('option', { name: '20', exact: true }).click();
  await startMinute.click();
  await expect(
    page.getByRole('option', { name: '15', exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'Monday range 1 length' }).click();
  await expect(
    page.getByRole('option', {
      name: info.project.name === 'mobile' ? '5h' : '5 hours',
      exact: true,
    }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  await startHour.click();
  await page.getByRole('option', { name: '10', exact: true }).click();
  await startMinute.click();
  await page.getByRole('option', { name: '15', exact: true }).click();
  await page.getByRole('button', { name: 'Save week', exact: true }).click();
  await expect(
    page.getByText('Saved. 1 booked session is now outside your hours.'),
  ).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'Saved.' }),
  ).toBeVisible();
  expect(ranges).toEqual([{ weekday: 1, startMinute: 615, lengthHours: 4 }]);
  await page
    .getByRole('button', { name: 'Add Tuesday range', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Change time zone' }),
  ).toBeDisabled();
  page.once('dialog', (dialog) => dialog.dismiss());
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Open sidebar' }).click();
  await page.getByRole('link', { name: 'Schedule', exact: true }).click();
  await expect(page).toHaveURL(/\/pro\/hours$/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await page.getByRole('button', { name: 'Change time zone' }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('button', { name: 'Save time zone and replacement week' }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: 'New city or time zone' }).click();
  await page.getByPlaceholder('Search city or time zone').fill('Singapore');
  await page.getByRole('option', { name: /Asia\/Singapore/ }).click();
  await expect(
    dialog.getByRole('button', { name: 'Save time zone and replacement week' }),
  ).toBeDisabled();
  await dialog
    .getByRole('button', { name: 'Add Wednesday range', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: 'Save time zone and replacement week' })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(replacement).toEqual({
    timezone: 'Asia/Singapore',
    ranges: [{ weekday: 3, startMinute: 540, lengthHours: 1 }],
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
