import { test, expect } from '@playwright/test';

const initial = {
  id: 'p',
  name: 'Alex Example',
  role: 'professional',
  timezone: 'UTC',
  title: 'Counsellor',
  bio: 'Fictional profile.',
  specialisations: ['anxiety'],
  languages: ['en'],
};

test('edits a professional profile and previews the member-facing card', async ({
  page,
}) => {
  let account = { ...initial };
  await page.route('**/api/v1/users/me', (route) => {
    if (route.request().method() === 'PATCH')
      account = { ...account, ...route.request().postDataJSON() };
    return route.fulfill({ json: account });
  });
  await page.route('**/api/v1/notifications**', (route) =>
    route.fulfill({
      json: route.request().url().includes('unread-count')
        ? { count: 0 }
        : { items: [], nextCursor: null },
    }),
  );
  await page.route('**/api/v1/working-hours', (route) =>
    route.fulfill({ json: { timezone: 'UTC', ranges: [] } }),
  );
  await page.goto('/pro/profile');
  await page.getByLabel('Full name', { exact: true }).fill('Taylor Example');
  await page.getByRole('button', { name: 'Malay', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Taylor Example', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByText('Profile updated.')).toBeVisible();
  expect(account.name).toBe('Taylor Example');
  expect(account.languages).toEqual(['en', 'ms']);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('keeps a saved name when a timezone update fails and retries only the remaining change', async ({
  page,
}) => {
  let account = { ...initial, role: 'member' };
  let nameWrites = 0;
  let attempts = 0;
  await page.route('**/api/v1/users/me', (route) => {
    if (route.request().method() === 'PATCH') {
      nameWrites++;
      account = { ...account, ...route.request().postDataJSON() };
    }
    return route.fulfill({ json: account });
  });
  await page.route('**/api/v1/notifications**', (route) =>
    route.fulfill({
      json: route.request().url().includes('unread-count')
        ? { count: 0 }
        : { items: [], nextCursor: null },
    }),
  );
  await page.route('**/api/v1/users/me/timezone', (route) => {
    attempts++;
    if (attempts === 1)
      return route.fulfill({
        status: 503,
        json: {
          code: 'UNAVAILABLE',
          detail: 'Time zone unavailable. Please retry.',
        },
      });
    account.timezone = route.request().postDataJSON().timezone;
    return route.fulfill({
      json: { timezone: account.timezone, ranges: [], warnings: [] },
    });
  });
  await page.goto('/account');
  await page.getByLabel('Name', { exact: true }).fill('Sam Example');
  await page.getByRole('button', { name: /^City or time zone/ }).click();
  await page.getByPlaceholder('Search city or time zone').fill('Singapore');
  await page.getByRole('option', { name: /Asia\/Singapore/ }).click();
  await page.getByRole('button', { name: 'Save account' }).click();
  await expect(page.getByRole('alert')).toContainText('Your name was saved.');
  expect(account.name).toBe('Sam Example');
  await page.getByRole('button', { name: 'Save account' }).click();
  await expect(page.getByText('Account updated.')).toBeVisible();
  expect(nameWrites).toBe(1);
  expect(account.timezone).toBe('Asia/Singapore');
});

test('blocks selected local dates atomically and unblocks a date', async ({
  page,
}) => {
  let dates: { id: string; localDate: string; reason: string | null }[] = [];
  const payloads: unknown[] = [];
  await page.route('**/api/v1/users/me', (route) =>
    route.fulfill({ json: initial }),
  );
  await page.route('**/api/v1/notifications**', (route) =>
    route.fulfill({
      json: route.request().url().includes('unread-count')
        ? { count: 0 }
        : { items: [], nextCursor: null },
    }),
  );
  await page.route('**/api/v1/blocked-dates', (route) =>
    route.fulfill({ json: { timezone: 'UTC', items: dates } }),
  );
  await page.route('**/api/v1/blocked-dates/bulk', (route) => {
    const body = route.request().postDataJSON();
    payloads.push(body);
    dates = body.dates.map(
      (date: { localDate: string; reason?: string }, index: number) => ({
        id: `blocked-${index}`,
        ...date,
      }),
    );
    return route.fulfill({
      json: { items: dates.map((date) => ({ ...date, warnings: [] })) },
    });
  });
  await page.route('**/api/v1/blocked-dates/blocked-*', (route) => {
    const id = route.request().url().split('/').at(-1);
    dates = dates.filter((date) => date.id !== id);
    return route.fulfill({ status: 204 });
  });
  await page.goto('/pro/blocked-dates');
  const days = page.locator(
    '[data-value]:not([data-disabled]):not([data-outside-view])',
  );
  const first = await days.nth(0).getAttribute('data-value');
  const second = await days.nth(1).getAttribute('data-value');
  await days.nth(0).click();
  await days.nth(0).click();
  await expect(
    page.getByRole('button', { name: 'Block selected dates', exact: true }),
  ).toBeDisabled();
  await days.nth(0).click();
  await days.nth(1).click();
  await page.getByLabel('Reason (optional, only you see it)').fill('Time off');
  await page.getByRole('button', { name: 'Block selected dates' }).click();
  await expect(
    page.getByText('Blocked dates saved. Existing bookings have been kept.'),
  ).toBeVisible();
  await expect(
    page.locator('[data-value="' + first + '"]').first(),
  ).toHaveAttribute('data-disabled');
  await expect(
    page.getByRole('button', { name: 'Block selected dates', exact: true }),
  ).toBeDisabled();
  expect(payloads).toEqual([
    {
      dates: [
        { localDate: first, reason: 'Time off' },
        { localDate: second, reason: 'Time off' },
      ],
    },
  ]);
  await page
    .getByRole('button', { name: `Unblock ${first}`, exact: true })
    .click();
  await expect(page.getByText('Date unblocked.')).toBeVisible();
  expect(dates).toHaveLength(1);
});
