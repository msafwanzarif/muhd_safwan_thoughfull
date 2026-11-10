import { test, expect } from '@playwright/test';
test('shows blocked and non-working dates without overflow', async ({
  page,
}, info) => {
  const mobile = info.project.name === 'mobile';
  await page.setViewportSize(
    mobile ? { width: 390, height: 1500 } : { width: 1280, height: 960 },
  );
  await page.clock.install({ time: new Date('2026-11-10T06:00:00Z') });
  await page.route('**/api/v1/users/me', (route) =>
    route.fulfill({
      json: {
        id: 'p',
        name: 'Dr. Mei Lin Wong',
        role: 'professional',
        timezone: 'Asia/Kuala_Lumpur',
        title: 'Counsellor',
        bio: '',
        specialisations: [],
        languages: [],
      },
    }),
  );
  await page.route('**/api/v1/notifications**', (route) =>
    route.fulfill({
      json: route.request().url().includes('unread-count')
        ? { count: 2 }
        : { items: [], nextCursor: null },
    }),
  );
  await page.route('**/api/v1/working-hours', (route) =>
    route.fulfill({
      json: {
        timezone: 'Asia/Kuala_Lumpur',
        ranges: [1, 2, 3, 4, 5].map((weekday) => ({
          weekday,
          startMinute: 540,
          lengthHours: 8,
        })),
      },
    }),
  );
  await page.route('**/api/v1/sessions**', (route) =>
    route.fulfill({
      json: { items: [], total: 0, page: 1, pageSize: 100, totalPages: 0 },
    }),
  );
  await page.route('**/api/v1/blocked-dates', (route) =>
    route.fulfill({
      json: {
        timezone: 'Asia/Kuala_Lumpur',
        items: [
          { id: 'b1', localDate: '2026-11-25', reason: 'Public holiday' },
          { id: 'b2', localDate: '2026-12-31', reason: 'Year-end leave' },
        ],
      },
    }),
  );
  await page.goto('/pro/blocked-dates');
  await expect(
    page.locator('[data-value="2026-11-25"]').first(),
  ).toHaveAttribute('data-disabled');
  const firstMonth = page.locator('.first-month');
  await firstMonth.locator('[data-value="2026-11-16"]').click();
  await expect(firstMonth.locator('[data-slot="headingLabel"]')).toHaveText(
    'November 2026',
  );
  if (!mobile) {
    const secondMonth = page.locator('.second-month');
    await expect(secondMonth.locator('[data-slot="headingLabel"]')).toHaveText(
      'December 2026',
    );
    await secondMonth.locator('[data-value="2026-12-24"]').click();
    await firstMonth.locator('[data-value="2026-11-17"]').click();
    await expect(firstMonth.locator('[data-slot="headingLabel"]')).toHaveText(
      'November 2026',
    );
    await expect(secondMonth.locator('[data-slot="headingLabel"]')).toHaveText(
      'December 2026',
    );
    await expect(
      page.getByRole('button', { name: 'Remove 2026-12-24 from selection' }),
    ).toBeVisible();
  }
  await firstMonth.locator('[data-value="2026-11-16"]').click();
  await expect(firstMonth.locator('[data-slot="headingLabel"]')).toHaveText(
    'November 2026',
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: info.outputPath('blocked-design.png'),
    animations: 'disabled',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
