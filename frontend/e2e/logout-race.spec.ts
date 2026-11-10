import { test, expect, type Route } from '@playwright/test';
test('keeps explicit logout on login when a background request returns 401', async ({
  page,
}, info) => {
  let held: Route | undefined;
  let signedIn = true;
  const expiryRedirects: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame() && frame.url().includes('/login?redirect='))
      expiryRedirects.push(frame.url());
  });
  await page.route('**/api/v1/users/me', (r) =>
    r.fulfill({
      status: signedIn ? 200 : 401,
      json: signedIn
        ? {
            id: 'p',
            name: 'Alex Example',
            role: 'professional',
            timezone: 'Asia/Kuala_Lumpur',
            title: 'Counsellor',
            bio: 'Profile',
            specialisations: [],
            languages: [],
          }
        : { code: 'UNAUTHENTICATED' },
    }),
  );
  await page.route(/\/api\/v1\/notifications(?:\?.*)?$/, (r) =>
    r.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.route('**/api/v1/notifications/unread-count', (r) => {
    held = r;
  });
  await page.route('**/api/v1/working-hours', (r) =>
    r.fulfill({ json: { timezone: 'Asia/Kuala_Lumpur', ranges: [] } }),
  );
  await page.route('**/api/v1/blocked-dates', (r) =>
    r.fulfill({ json: { timezone: 'Asia/Kuala_Lumpur', items: [] } }),
  );
  await page.route(/\/api\/v1\/sessions(?:\?.*)?$/, (r) =>
    r.fulfill({
      json: { items: [], page: 1, pageSize: 7, total: 0, totalPages: 0 },
    }),
  );
  await page.route('**/api/v1/auth/logout', async (r) => {
    signedIn = false;
    const response = page.waitForResponse(
      (res) =>
        res.url().includes('/notifications/unread-count') &&
        res.status() === 401,
    );
    await held!.fulfill({ status: 401, json: { code: 'UNAUTHENTICATED' } });
    await response;
    await r.fulfill({ status: 204 });
  });
  await page.goto('/pro/schedule');
  await expect.poll(() => !!held).toBe(true);
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Open sidebar' }).click();
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible();
  await expect(page.getByText('Your session has expired.')).toHaveCount(0);
  expect(expiryRedirects).toEqual([]);
});
