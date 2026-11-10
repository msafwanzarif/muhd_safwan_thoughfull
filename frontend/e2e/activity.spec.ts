import { test, expect } from '@playwright/test';
import type { Route } from '@playwright/test';

test.use({ timezoneId: 'Asia/Kuala_Lumpur' });

test('warns at 28 minutes, renews only on confirmation and signs out at 30', async ({
  page,
}) => {
  await page.clock.install();
  let signedIn = true;
  let polls = 0;
  let logouts = 0;
  await page.route('**/api/v1/users/me', (route) =>
    route.fulfill({
      status: signedIn ? 200 : 401,
      json: signedIn
        ? {
            id: 'm',
            name: 'Sam Example',
            role: 'member',
            timezone: 'UTC',
            title: null,
            bio: null,
            specialisations: [],
            languages: [],
          }
        : { code: 'UNAUTHENTICATED' },
    }),
  );
  await page.route('**/api/v1/sessions**', (route) =>
    route.fulfill({
      json: { items: [], total: 0, totalPages: 0, page: 1, pageSize: 12 },
    }),
  );
  await page.route('**/api/v1/notifications**', (route) => {
    polls++;
    return route.fulfill({
      json: route.request().url().includes('unread-count')
        ? { count: 0 }
        : { items: [], nextCursor: null },
    });
  });
  await page.route('**/api/v1/auth/logout', (route) => {
    signedIn = false;
    logouts++;
    return route.fulfill({ status: 204 });
  });
  await page.goto('/sessions');
  await expect(
    page.getByRole('heading', { name: 'My sessions' }),
  ).toBeVisible();
  await expect.poll(() => polls).toBe(2);
  await page.clock.fastForward(28 * 60000);
  await expect(
    page.getByRole('dialog', { name: 'Still there?' }),
  ).toBeVisible();
  expect(polls).toBe(2);
  await page.getByRole('button', { name: 'Stay signed in' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.clock.fastForward(30 * 60000);
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByText(
      'Signed out after 30 minutes without activity. Please log in again.',
    ),
  ).toBeVisible();
  expect(logouts).toBe(1);
});

test('keeps expired human activity expired across refresh even if the server still accepts the cookie', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'thoughtfull-last-activity',
      String(Date.now() - 31 * 60000),
    ),
  );
  let logouts = 0;
  await page.route('**/api/v1/users/me', (route) =>
    route.fulfill({
      json: {
        id: 'm',
        name: 'Sam Example',
        role: 'member',
        timezone: 'UTC',
        title: null,
        bio: null,
        specialisations: [],
        languages: [],
      },
    }),
  );
  await page.route('**/api/v1/auth/logout', (route) => {
    logouts++;
    return route.fulfill({ status: 204 });
  });
  await page.goto('/sessions');
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByText(
      'Signed out after 30 minutes without activity. Please log in again.',
    ),
  ).toBeVisible();
  expect(logouts).toBe(1);
  await expect(page.getByRole('heading', { name: 'My sessions' })).toHaveCount(
    0,
  );
});

test('dismisses the timezone notice and links to the correct settings page', async ({
  page,
}, info) => {
  const professional = info.project.name === 'mobile';
  await page.route('**/api/v1/users/me', (route) =>
    route.fulfill({
      json: {
        id: 'm',
        name: 'Alex Example',
        role: professional ? 'professional' : 'member',
        timezone: 'UTC',
        title: 'Counsellor',
        bio: 'Fictional.',
        specialisations: [],
        languages: [],
      },
    }),
  );
  await page.route('**/api/v1/working-hours', (route) =>
    route.fulfill({ json: { timezone: 'UTC', ranges: [] } }),
  );
  await page.route('**/api/v1/sessions**', (route) =>
    route.fulfill({
      json: { items: [], total: 0, totalPages: 0, page: 1, pageSize: 12 },
    }),
  );
  await page.route('**/api/v1/notifications**', (route) =>
    route.fulfill({
      json: route.request().url().includes('unread-count')
        ? { count: 0 }
        : { items: [], nextCursor: null },
    }),
  );
  const path = professional ? '/pro/profile' : '/sessions';
  await page.goto(path);
  await expect(
    page.getByText('Your browser is in a different time zone.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss time zone notice' }).click();
  await page.reload();
  await expect(
    page.getByText('Your browser is in a different time zone.'),
  ).toHaveCount(0);
  await page.evaluate(() =>
    localStorage.removeItem('thoughtfull-timezone-dismissed'),
  );
  await page.goto(path);
  await page
    .getByRole('link', {
      name: professional ? 'Review time zone and hours' : 'Review time zone',
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`${professional ? '/pro/hours' : '/account'}$`),
  );
});

test('recovers from a connection error and distinguishes a missing page', async ({
  page,
}) => {
  let fail = true;
  await page.route('**/api/v1/users/me', (route) =>
    route.fulfill({
      status: fail ? 503 : 200,
      json: fail
        ? { code: 'UNAVAILABLE', detail: 'Unavailable' }
        : {
            id: 'm',
            name: 'Sam Example',
            role: 'member',
            timezone: 'UTC',
            title: null,
            bio: null,
            specialisations: [],
            languages: [],
          },
    }),
  );
  await page.route('**/api/v1/sessions**', (route) =>
    route.fulfill({
      json: { items: [], total: 0, totalPages: 0, page: 1, pageSize: 12 },
    }),
  );
  await page.route('**/api/v1/notifications**', (route) =>
    route.fulfill({
      json: route.request().url().includes('unread-count')
        ? { count: 0 }
        : { items: [], nextCursor: null },
    }),
  );
  await page.goto('/sessions');
  await expect(
    page.getByRole('heading', { name: 'Unable to connect' }),
  ).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'My sessions' }),
  ).toBeVisible();
  await page.goto('/missing-page');
  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible();
});

test('shares human activity and idle logout across tabs', async ({
  page,
  context,
}) => {
  const start = new Date();
  await page.clock.install({ time: start });
  let signedIn = true;
  await context.route('**/api/v1/users/me', (route) =>
    route.fulfill({
      status: signedIn ? 200 : 401,
      json: signedIn
        ? {
            id: 'm',
            name: 'Sam Example',
            role: 'member',
            timezone: 'UTC',
            title: null,
            bio: null,
            specialisations: [],
            languages: [],
          }
        : { code: 'UNAUTHENTICATED' },
    }),
  );
  await context.route('**/api/v1/sessions**', (route) =>
    route.fulfill({
      json: { items: [], total: 0, totalPages: 0, page: 1, pageSize: 12 },
    }),
  );
  await context.route('**/api/v1/notifications**', (route) =>
    route.fulfill({
      json: route.request().url().includes('unread-count')
        ? { count: 0 }
        : { items: [], nextCursor: null },
    }),
  );
  await context.route('**/api/v1/auth/logout', (route) => {
    signedIn = false;
    return route.fulfill({ status: 204 });
  });
  await page.goto('/sessions');
  const other = await context.newPage();
  await other.goto('/sessions');
  // Pages in one browser context share the installed clock.
  await page.clock.fastForward(27 * 60000);
  await other.getByRole('heading', { name: 'My sessions' }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Number(localStorage.getItem('thoughtfull-last-activity')),
      ),
    )
    .toBeGreaterThan(start.getTime() + 26 * 60000);
  await page.clock.fastForward(2 * 60000);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/sessions$/);
  await page.clock.fastForward(30 * 60000);
  await expect(page).toHaveURL(/\/login$/);
  await expect(other).toHaveURL(/\/login$/);
});

test('clears private state on idle logout even when offline and ignores a late save', async ({
  page,
}) => {
  await page.clock.install();
  let pendingSave: Route | undefined;
  const account = {
    id: 'm',
    name: 'Sam Example',
    role: 'member',
    timezone: 'UTC',
    title: null,
    bio: null,
    specialisations: [],
    languages: [],
  };
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/v1/users/me', (route) => {
    if (route.request().method() === 'PATCH') {
      pendingSave = route;
      return;
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
  await page.route('**/api/v1/auth/logout', (route) => route.abort('failed'));
  await page.goto('/account');
  await page.getByLabel('Name', { exact: true }).fill('Saved Example');
  await page.getByRole('button', { name: 'Save account' }).click();
  await expect.poll(() => !!pendingSave).toBe(true);
  await page.clock.fastForward(30 * 60000);
  await expect(page).toHaveURL(/\/login$/);
  await pendingSave!.fulfill({ json: { ...account, name: 'Saved Example' } });
  await page.getByRole('link', { name: 'ThoughtFull home' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});
