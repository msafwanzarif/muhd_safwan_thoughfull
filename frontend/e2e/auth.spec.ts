import { test, expect } from '@playwright/test';

test('signs up, logs in with a cookie, restores the session and logs out', async ({
  page,
  context,
}, info) => {
  const professional = info.project.name === 'mobile';
  const home = professional ? '/pro/schedule' : '/professionals';
  const email = `auth-${crypto.randomUUID()}@example.test`;
  const password = 'Fictional-auth-demo-2026!';

  await page.goto('/professionals');
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await page.getByRole('link', { name: 'Create an account' }).click();
  if (professional)
    await page
      .getByRole('button', { name: 'Professional', exact: true })
      .click();
  await page.getByLabel('Full name', { exact: true }).fill('Alex Example');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  if (professional) {
    await page.getByLabel('Professional title').fill('Counsellor');
    await page
      .getByLabel('About you')
      .fill('Fictional professional for browser testing.');
    await page.getByRole('button', { name: 'Anxiety', exact: true }).click();
    await page.getByRole('button', { name: 'English', exact: true }).click();
  }
  await page.screenshot({
    path: info.outputPath('signup.png'),
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page).toHaveURL(/\/login\?registered=1$/);
  await expect(
    page.getByText('Your account is ready. Please log in.'),
  ).toBeVisible();
  expect(
    (await context.cookies()).some((cookie) => cookie.name === 'session'),
  ).toBe(false);

  await page.getByLabel('Email', { exact: true }).fill(email);
  await page
    .getByLabel('Password', { exact: true })
    .fill('incorrect-password-for-test');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'email or password is incorrect',
  );
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${home}$`));
  if (!professional) {
    await expect(
      page.getByRole('link', { name: 'Directory Example 01', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('No availability', { exact: true }).first(),
    ).toBeVisible();
    await page.getByLabel('Name', { exact: true }).fill('Directory Example 13');
    await expect(page).toHaveURL(/name=Directory\+Example\+13/);
    await expect(
      page.getByRole('link', { name: 'Directory Example 13', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Directory Example 01', exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole('link', { name: 'Directory Example 13', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Directory Example 13', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button')
      .filter({ has: page.locator('[aria-label="Free times"]') })
      .nth(2)
      .click();
    await page
      .locator('[aria-label="Session times"]')
      .getByRole('button')
      .first()
      .click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page
      .getByRole('button', { name: /^(Confirm booking|Book anyway)$/ })
      .click();
    await expect(page.getByText('Your session is booked.')).toBeVisible();
    await page.goto(home);
  }
  const cookie = (await context.cookies()).find(
    (value) => value.name === 'session',
  );
  expect(cookie).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/api',
  });
  expect(await page.evaluate(() => document.cookie)).not.toContain('session=');
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    password,
  );
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`${home}$`));
  await page.goto(professional ? '/professionals' : '/pro/schedule');
  await expect(page).toHaveURL(new RegExp(`${home}$`));
  await page.goto('/login');
  await expect(page).toHaveURL(new RegExp(`${home}$`));
  const otherTab = await context.newPage();
  await otherTab.goto(home);
  await expect(otherTab).toHaveURL(new RegExp(`${home}$`));

  if (professional) {
    await page.getByRole('button', { name: 'Open sidebar' }).click();
  }
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(otherTab).toHaveURL(/\/login$/);
  await page.goto(home);
  await expect(page).toHaveURL(/\/login\?redirect=/);
  expect(
    (await context.cookies()).some((value) => value.name === 'session'),
  ).toBe(false);
});

test('retries an uncertain signup with the same key and handles an expired session', async ({
  page,
}) => {
  let signedIn = false;
  const keys: string[] = [];
  await page.route('**/api/v1/users/me', (route) =>
    route.fulfill({
      status: signedIn ? 200 : 401,
      json: signedIn
        ? {
            id: 'example-id',
            name: 'Alex Example',
            role: 'member',
            timezone: 'UTC',
            title: null,
            bio: null,
            specialisations: [],
            languages: [],
          }
        : { code: 'UNAUTHENTICATED', detail: 'Unauthorized' },
    }),
  );
  await page.route('**/api/v1/auth/sign-up', async (route) => {
    keys.push(route.request().headers()['idempotency-key'] ?? '');
    if (keys.length === 1) return route.abort('failed');
    if (keys.length === 2)
      return route.fulfill({
        status: 409,
        json: { code: 'REQUEST_IN_PROGRESS', detail: 'Processing' },
      });
    return route.fulfill({
      status: 201,
      json: { id: 'example-id', role: 'member', timezone: 'UTC' },
    });
  });
  await page.goto('/signup');
  await page.getByLabel('Full name', { exact: true }).fill('Alex Example');
  await page.getByLabel('Email', { exact: true }).fill('retry@example.test');
  await page
    .getByLabel('Password', { exact: true })
    .fill('Fictional-auth-demo-2026!');
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('Please try again');
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page).toHaveURL(/\/login\?registered=1$/);
  expect(keys).toHaveLength(3);
  expect(new Set(keys).size).toBe(1);
  expect(keys[0]).toMatch(/^[\da-f-]{36}$/);

  signedIn = true;
  await page.route(/\/api\/v1\/professionals(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: { items: [], page: 1, pageSize: 12, total: 0, totalPages: 0 },
    }),
  );
  await page.goto('/professionals');
  await expect(
    page.getByRole('heading', { name: 'Find a professional' }),
  ).toBeVisible();
  signedIn = false;
  await page.reload();
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible();
});
