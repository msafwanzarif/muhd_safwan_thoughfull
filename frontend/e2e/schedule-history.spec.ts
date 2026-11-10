import { test, expect } from '@playwright/test';
test('shows cancelled and moved professional schedule sessions clearly', async ({
  page,
}, info) => {
  await page.clock.install({ time: new Date('2026-11-10T06:20:00Z') });
  const timezone = 'Asia/Kuala_Lumpur';
  const professional = { id: 'p', name: 'Dr. Mei Lin Wong', timezone };
  const member = { id: 'm', name: 'Sam Example', timezone };
  const items = [
    { id: 'soon', startAt: '2026-11-10T07:00:00Z', status: 'active' },
    { id: 'future', startAt: '2026-11-13T06:00:00Z', status: 'active' },
    { id: 'cancelled', startAt: '2026-11-12T03:00:00Z', status: 'cancelled' },
    { id: 'moved', startAt: '2026-11-16T01:00:00Z', status: 'rescheduled' },
  ].map((item) => ({
    ...item,
    professional,
    member,
    endAt: new Date(Date.parse(item.startAt) + 3000000).toISOString(),
    createdAt: '2026-11-01T00:00:00Z',
    reason: item.id === 'cancelled' ? 'Plans changed' : null,
    cancelledAt: item.id === 'cancelled' ? '2026-11-09T00:00:00Z' : null,
    cancelledBy: item.id === 'cancelled' ? 'm' : null,
    rescheduledFromId: null,
    rescheduledToId: item.id === 'moved' ? 'new-time' : null,
  }));
  await page.route('**/api/v1/users/me', (r) =>
    r.fulfill({
      json: {
        ...member,
        role: 'professional',
        title: null,
        bio: null,
        specialisations: [],
        languages: [],
      },
    }),
  );
  await page.route('**/api/v1/notifications**', (r) =>
    r.fulfill({
      json: r.request().url().includes('unread-count')
        ? { count: 0 }
        : { items: [], nextCursor: null },
    }),
  );
  await page.route(/\/api\/v1\/sessions(?:\?.*)?$/, (r) =>
    r.fulfill({
      json: { items, total: 4, page: 1, pageSize: 12, totalPages: 1 },
    }),
  );
  await page.route('**/api/v1/working-hours', (r) =>
    r.fulfill({ json: { timezone, ranges: [] } }),
  );
  await page.route('**/api/v1/blocked-dates', (r) =>
    r.fulfill({ json: { timezone, items: [] } }),
  );
  await page.route('**/api/v1/sessions/new-time', (r) =>
    r.fulfill({ json: { ...items[1], id: 'new-time' } }),
  );
  await page.goto('/pro/schedule?cancelled=1');
  await expect(
    page
      .getByText('Cancelled by Sam Example', { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText('Rescheduled by Sam Example', { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByText(/Moved to Fri 13 Nov, 14:00/)).toBeVisible();
  const cancelled = page
    .getByRole('article', { name: 'Session with Sam Example' })
    .filter({ hasText: 'Cancelled by Sam Example' });
  await expect(cancelled.locator('.schedule-time').first()).toHaveCSS(
    'text-decoration-line',
    'line-through',
  );
  await expect(
    cancelled.getByRole('button', { name: /Cancel session/ }),
  ).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Moved to/ })).toHaveAttribute(
    'href',
    '/pro/schedule?cancelled=1&session=new-time',
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: info.outputPath('schedule-history.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
