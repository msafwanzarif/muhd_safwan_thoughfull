import { test, expect } from '@playwright/test';
test('displays upcoming, locked, cancelled and rescheduled member sessions', async ({
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
        role: 'member',
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
  await page.goto('/sessions?cancelled=1');
  await expect(page.getByText('Starts in 40 minutes.')).toBeVisible();
  await expect(
    page
      .locator('#session-soon')
      .getByRole('button', { name: 'Cancel session' }),
  ).toHaveCount(0);
  await expect(
    page
      .locator('#session-future')
      .getByRole('button', { name: 'Reschedule', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Cancelled by Sam Example', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Book again' })).toHaveAttribute(
    'href',
    '/professionals/p',
  );
  await expect(
    page.getByRole('link', { name: 'See the new time' }),
  ).toHaveAttribute('href', '/sessions?cancelled=1&session=new-time');
  await expect(page.getByText('Page 1 of 1')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: info.outputPath('member-sessions.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
