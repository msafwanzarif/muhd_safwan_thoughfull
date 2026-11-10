import { expect, test } from '@playwright/test';

test('matches the supplied desktop and mobile schedule layout', async ({
  page,
}, info) => {
  const mobile = info.project.name === 'mobile';
  await page.setViewportSize(
    mobile ? { width: 390, height: 1250 } : { width: 1280, height: 1028 },
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-11-10T06:20:00Z') });
  const names = [
    'Alex Tan',
    'Nur Aisyah',
    'Jordan Lee',
    'Daniel Ong',
    'Hana Kim',
    'Rafael Santos',
    'Alex Tan',
  ];
  const starts = [
    '10T15:00',
    '10T16:00',
    '11T09:00',
    '11T13:00',
    '12T09:30',
    '12T11:30',
    '13T14:00',
  ];
  const booked = [
    '2026-11-02',
    '2026-11-04',
    '2026-10-30',
    '2026-11-03',
    '2026-11-05',
    '2026-11-01',
    '2026-11-09',
  ];
  const previousId = '00000000-0000-4000-8000-000000000099';
  const account = {
    id: 'p',
    name: 'Dr. Mei Lin Wong',
    role: 'professional',
    timezone: 'Asia/Kuala_Lumpur',
    title: 'Clinical Psychologist',
    bio: 'Fictional professional.',
    specialisations: [],
    languages: [],
  };
  const sessions = starts.map((value, index) => {
    const startAt = new Date(`2026-11-${value}:00+08:00`).toISOString();
    return {
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      member: {
        id: `m-${index}`,
        name: names[index],
        timezone: account.timezone,
      },
      professional: {
        id: account.id,
        name: account.name,
        timezone: account.timezone,
      },
      startAt,
      endAt: new Date(Date.parse(startAt) + 3000000).toISOString(),
      createdAt: `${booked[index]}T00:00:00Z`,
      status: 'active',
      reason: null,
      cancelledAt: null,
      cancelledBy: null,
      rescheduledFromId: index === 4 ? previousId : null,
      rescheduledToId: null,
    };
  });
  await page.route('**/api/v1/users/me', (route) =>
    route.fulfill({ json: account }),
  );
  await page.route('**/api/v1/working-hours', (route) =>
    route.fulfill({
      json: {
        timezone: account.timezone,
        ranges: [1, 2, 3, 4, 5].map((weekday) => ({
          weekday,
          startMinute: 540,
          lengthHours: 8,
        })),
      },
    }),
  );
  await page.route('**/api/v1/blocked-dates', (route) =>
    route.fulfill({ json: { timezone: account.timezone, items: [] } }),
  );
  await page.route('**/api/v1/notifications**', (route) =>
    route.fulfill({
      json: route.request().url().includes('unread-count')
        ? { count: 2 }
        : { items: [], nextCursor: null },
    }),
  );
  await page.route(`**/api/v1/sessions/${previousId}`, (route) =>
    route.fulfill({
      json: { ...sessions[4], id: previousId, startAt: '2026-11-11T01:30:00Z' },
    }),
  );
  await page.route(/\/api\/v1\/sessions(?:\?.*)?$/, (route) => {
    expect(new URL(route.request().url()).searchParams.get('pageSize')).toBe(
      '7',
    );
    return route.fulfill({
      json: { items: sessions, page: 1, pageSize: 7, total: 18, totalPages: 3 },
    });
  });
  await page.goto('/pro/schedule');
  await expect(
    page.getByRole('article', { name: 'Session with Alex Tan', exact: true }),
  ).toHaveCount(2);
  await expect(
    page
      .getByText('Starts in 40 min', { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  if (!mobile)
    await expect(
      page.getByText('Rescheduled from Wed 11 Nov', { exact: true }),
    ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: info.outputPath('schedule-design.png'),
    animations: 'disabled',
  });
  const firstRow = await page
    .getByRole('article', { name: 'Session with Alex Tan', exact: true })
    .first()
    .boundingBox();
  expect(firstRow?.x).toBe(mobile ? 16 : 280);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (mobile) {
    await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('tab', { name: 'Week', exact: true }),
    ).toHaveCount(0);
  } else {
    await expect(
      page.getByText('Showing 1–7 of 18 upcoming sessions', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Professional navigation' }),
    ).toBeVisible();
  }
});
