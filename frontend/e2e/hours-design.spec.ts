import { test, expect } from '@playwright/test';
test('renders the working hours design at desktop and mobile sizes', async ({
  page,
}, info) => {
  const mobile = info.project.name === 'mobile';
  await page.setViewportSize(
    mobile ? { width: 390, height: 2000 } : { width: 1280, height: 1300 },
  );
  const timezone = 'Asia/Kuala_Lumpur';
  const ranges = [1, 2, 3, 4, 5].flatMap((weekday) => [
    { weekday, startMinute: weekday === 4 ? 570 : 540, lengthHours: 3 },
    { weekday, startMinute: weekday === 4 ? 840 : 780, lengthHours: 4 },
  ]);
  await page.route('**/api/v1/users/me', (route) =>
    route.fulfill({
      json: {
        id: 'p',
        name: 'Dr. Mei Lin Wong',
        role: 'professional',
        timezone,
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
    route.fulfill({ json: { timezone, ranges, warnings: [] } }),
  );
  await page.goto('/pro/hours');
  await expect(
    page.getByRole('combobox', { name: 'Monday range 1 length' }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: info.outputPath('hours-design.png'),
    animations: 'disabled',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
