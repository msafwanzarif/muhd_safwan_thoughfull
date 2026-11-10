import { test, expect } from '@playwright/test';

test('saves whole-week hours, warns about kept sessions and requires timezone replacement ranges', async ({
  page,
}) => {
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
  await page.getByRole('option', { name: '4 hours', exact: true }).click();
  await page.getByRole('button', { name: 'Save week', exact: true }).click();
  await expect(page.getByText('Availability saved.')).toBeVisible();
  await expect(
    page.getByText('Existing sessions have been kept.'),
  ).toBeVisible();
  expect(ranges).toEqual([{ weekday: 1, startMinute: 540, lengthHours: 4 }]);
  await page
    .getByRole('button', { name: 'Add Tuesday range', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Change time zone' }),
  ).toBeDisabled();
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
