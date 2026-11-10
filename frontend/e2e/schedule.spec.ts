import { expect, test } from '@playwright/test';

test('shows a professional schedule and allows cancellation inside 24 hours', async ({
  page,
}, info) => {
  let cancelled = false;
  const queries: URLSearchParams[] = [];
  const start = new Date(Date.now() + 3600000);
  const blockedDate = start.toISOString().slice(0, 10);
  await page.route('**/api/v1/blocked-dates', (route) =>
    route.fulfill({
      json: {
        timezone: 'UTC',
        items: [
          { id: 'blocked-date', localDate: blockedDate, reason: 'Time off' },
        ],
      },
    }),
  );
  const session = {
    id: '00000000-0000-4000-8000-000000000001',
    member: { id: 'm', name: 'Sam Example', timezone: 'UTC' },
    professional: { id: 'p', name: 'Alex Example', timezone: 'UTC' },
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + 3000000).toISOString(),
    createdAt: new Date().toISOString(),
    cancelledAt: null,
    cancelledBy: null,
    reason: null,
    rescheduledFromId: null,
    rescheduledToId: null,
    status: 'active',
  };
  await page.route('**/api/v1/users/me', (route) =>
    route.fulfill({
      json: {
        id: 'p',
        name: 'Alex Example',
        role: 'professional',
        timezone: 'UTC',
        title: 'Counsellor',
        bio: 'Fictional.',
        specialisations: [],
        languages: [],
      },
    }),
  );
  await page.route('**/api/v1/working-hours', (route) =>
    route.fulfill({
      json: {
        timezone: 'UTC',
        ranges: Array.from({ length: 7 }, (_, weekday) => ({
          weekday,
          startMinute: 540,
          lengthHours: 8,
        })),
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
  await page.route(/\/api\/v1\/sessions(?:\?.*)?$/, (route) => {
    const query = new URL(route.request().url()).searchParams;
    queries.push(query);
    const week = query.has('from');
    const second = query.get('page') === '2';
    const value = {
      ...session,
      id: second ? '00000000-0000-4000-8000-000000000002' : session.id,
      status: cancelled ? 'cancelled' : 'active',
    };
    const items = cancelled && query.has('status') ? [] : [value];
    return route.fulfill({
      json: {
        items,
        page: second ? 2 : 1,
        pageSize: week ? 100 : 12,
        total: week ? 101 : items.length,
        totalPages: week ? 2 : 1,
      },
    });
  });
  await page.route('**/cancel', (route) => {
    cancelled = true;
    return route.fulfill({
      json: {
        id: session.id,
        status: 'cancelled',
        cancelledBy: 'p',
        cancelledAt: new Date().toISOString(),
        reason: null,
      },
    });
  });
  await page.goto('/pro/schedule');
  await expect(
    page.getByRole('heading', { name: 'Sam Example' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Cancel session', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'You can cancel at any time',
  );
  await page.getByRole('button', { name: 'Yes, cancel session' }).click();
  await expect(
    page.getByRole('heading', { name: 'No sessions to show' }),
  ).toBeVisible();
  await page.getByRole('switch', { name: 'Show cancelled' }).click();
  await expect(
    page.getByRole('heading', { name: 'Sam Example' }),
  ).toBeVisible();
  if (info.project.name === 'desktop') {
    await page.getByRole('tab', { name: 'Week', exact: true }).click();
    await expect
      .poll(() =>
        queries.some(
          (query) =>
            query.has('from') && query.has('to') && query.get('page') === '2',
        ),
      )
      .toBe(true);
    await expect(
      page.getByRole('button', { name: /Sam Example.*cancelled/ }),
    ).toHaveCount(2);
    await page
      .getByRole('button', {
        name: `Blocked ${blockedDate}. Show reason`,
        exact: true,
      })
      .click();
    await expect(page.getByText('Time off', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    const column = page.locator(`[data-date="${blockedDate}"]`);
    const rows = await column.locator('[aria-hidden="true"]').count();
    expect(rows).toBeGreaterThan(0);
    await expect(column.locator('.outside-hours')).toHaveCount(rows);
    await expect(
      column.getByRole('button', { name: /Sam Example.*cancelled/ }),
    ).toHaveCount(2);
    await page.getByRole('button', { name: 'Next week' }).click();
    await expect(page).toHaveURL(/week=/);
  } else {
    await expect(
      page.getByRole('tab', { name: 'Week', exact: true }),
    ).toHaveCount(0);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
