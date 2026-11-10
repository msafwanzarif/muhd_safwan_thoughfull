import { expect, test } from '@playwright/test';

test('loads notification history, marks it read and links to the session', async ({
  page,
}, info) => {
  const professional = info.project.name === 'mobile';
  const path = professional ? '/pro/notifications' : '/notifications';
  const sessionId = '00000000-0000-4000-8000-000000000010';
  let unread = 2;
  const notification = (index: number) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    type: index === 2 ? 'session_cancelled' : 'session_booked',
    sessionId,
    data: {
      participantName: 'Alex Example',
      startAt: new Date(Date.now() + 3600000).toISOString(),
      reason: index === 2 ? 'Plans changed' : null,
    },
    readAt: unread ? null : new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  await page.route('**/api/v1/users/me', (route) =>
    route.fulfill({
      json: {
        id: 'm',
        name: 'Sam Example',
        timezone: 'UTC',
        role: professional ? 'professional' : 'member',
        title: null,
        bio: null,
        specialisations: [],
        languages: [],
      },
    }),
  );
  await page.route('**/api/v1/notifications/unread-count', (route) =>
    route.fulfill({ json: { count: unread } }),
  );
  await page.route(/\/api\/v1\/notifications(?:\?.*)?$/, (route) => {
    const older = new URL(route.request().url()).searchParams.has('cursor');
    return route.fulfill({
      json: {
        items: older ? [notification(1)] : [notification(3), notification(2)],
        nextCursor: older ? null : notification(2).id,
      },
    });
  });
  await page.route('**/api/v1/notifications/read-all', (route) => {
    unread = 0;
    return route.fulfill({ json: { count: 2 } });
  });
  await page.route('**/api/v1/notifications/*/read', (route) => {
    unread = Math.max(0, unread - 1);
    return route.fulfill({
      json: { ...notification(3), readAt: new Date().toISOString() },
    });
  });
  await page.goto(path);
  await page.route('**/api/v1/working-hours', (route) =>
    route.fulfill({ json: { timezone: 'UTC', ranges: [] } }),
  );
  await page.route('**/api/v1/blocked-dates', (route) =>
    route.fulfill({ json: { timezone: 'UTC', items: [] } }),
  );
  await page.route(/\/api\/v1\/sessions(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: { items: [], page: 1, pageSize: 12, total: 0, totalPages: 0 },
    }),
  );
  await page.route(`**/api/v1/sessions/${sessionId}`, (route) =>
    route.fulfill({
      status: 404,
      json: { code: 'NOT_FOUND', detail: 'Session not found' },
    }),
  );
  await expect(
    page.getByRole('heading', { name: /^Session booked/ }),
  ).toBeVisible();
  await expect(page.getByText('Reason: Plans changed')).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: '2 unread' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(
    page.getByRole('button', { name: 'View session', exact: true }),
  ).toHaveCount(3);
  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: '0 unread' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'View session', exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(
    new RegExp(
      `${professional ? '/pro/schedule' : '/sessions'}\\?session=${sessionId}`,
    ),
  );
});
