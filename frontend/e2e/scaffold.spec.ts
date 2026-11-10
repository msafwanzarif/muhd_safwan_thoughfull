import { test, expect } from '@playwright/test';
test('renders the branded shell without horizontal overflow', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/login');
  await expect(page.locator('html')).toHaveClass(/light/);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    'href',
    '/favicon.svg',
  );
  const favicon = await page.request.get('/favicon.svg');
  expect(favicon.ok()).toBe(true);
  expect(await favicon.text()).toContain('viewBox="126.4 -4.5 32 32"');
  const iconPage = await page.context().newPage();
  await iconPage.emulateMedia({ colorScheme: 'light' });
  await iconPage.goto('/favicon.svg');
  await expect(iconPage.locator('svg path')).toHaveCSS(
    'fill',
    'rgb(0, 191, 162)',
  );
  await iconPage.emulateMedia({ colorScheme: 'dark' });
  await expect(iconPage.locator('svg path')).toHaveCSS(
    'fill',
    'rgb(255, 255, 255)',
  );
  await iconPage.close();
  await expect(
    page.getByRole('heading', {
      name: 'Someone to talk to, when you need it.',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Switch to dark mode' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath('shell.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();

  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(
    page
      .getByRole('link', { name: 'ThoughtFull home' })
      .locator('svg path')
      .first(),
  ).toHaveCSS('fill', 'rgb(255, 255, 255)');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath('shell-dark.png'),
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveClass(/light/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/light/);
});

test('keeps the signup hero at viewport height when professional fields expand', async ({
  page,
}, info) => {
  await page.goto('/signup');
  const hero = page.locator('aside');
  const before = await hero.boundingBox();
  await page.getByRole('button', { name: 'Professional', exact: true }).click();
  await expect(
    page.getByLabel('Professional title', { exact: true }),
  ).toBeVisible();
  const after = await hero.boundingBox();
  expect(after!.height).toBe(before!.height);
  if (info.project.name === 'desktop') {
    expect(after!.height).toBe(page.viewportSize()!.height);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    expect((await hero.boundingBox())!.y).toBe(0);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
