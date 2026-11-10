import { expect, test } from '@playwright/test';

test('filters and paginates with URL history, and recovers from empty and failed results', async ({
  page,
}, info) => {
  const mobile = info.project.name === 'mobile';
  const requests: URLSearchParams[] = [];
  let failNext = false;
  await page.route('**/api/v1/users/me', (route) =>
    route.fulfill({
      json: {
        id: 'member-id',
        name: 'Sam Example',
        role: 'member',
        timezone: 'America/Los_Angeles',
        title: null,
        bio: null,
        specialisations: [],
        languages: [],
      },
    }),
  );
  await page.route(/\/api\/v1\/professionals(?:\?.*)?$/, async (route) => {
    const params = new URL(route.request().url()).searchParams;
    requests.push(params);
    if (failNext) {
      failNext = false;
      return route.fulfill({
        status: 503,
        json: { code: 'UNAVAILABLE', detail: 'Unavailable' },
      });
    }
    const currentPage = Number(params.get('page') || 1);
    const total = params.get('name') === 'Empty' ? 0 : 14;
    const start = (currentPage - 1) * 12;
    const items = Array.from(
      { length: Math.min(12, Math.max(total - start, 0)) },
      (_, offset) => {
        const index = start + offset + 1;
        return {
          id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
          name: `Alex Example ${String(index).padStart(2, '0')}`,
          title: 'Counsellor',
          timezone: 'Asia/Kuala_Lumpur',
          bio: 'Fictional counsellor.',
          specialisations: ['anxiety', 'relationships'],
          languages: ['en', 'ms'],
          hasWorkingHours: index !== 2,
        };
      },
    );
    return route.fulfill({
      json: {
        items,
        page: currentPage,
        pageSize: 12,
        total,
        totalPages: Math.ceil(total / 12),
      },
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/professionals');
  await expect(
    page.getByRole('link', { name: 'Alex Example 01', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('No availability', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Kuala Lumpur', { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/Times shown in your time zone, Los Angeles/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath('directory.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.screenshot({
    path: info.outputPath('directory-dark.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(
    page.getByRole('link', { name: 'Alex Example 13', exact: true }),
  ).toBeVisible();
  if (mobile) await page.getByRole('button', { name: /^Filters/ }).click();
  await page
    .getByRole('combobox', { name: 'Specialisation', exact: true })
    .click();
  await page.getByRole('option', { name: 'Anxiety', exact: true }).click();
  await expect(page).toHaveURL(/spec=anxiety/);
  expect(new URL(page.url()).searchParams.has('page')).toBe(false);
  await page.getByRole('combobox', { name: 'Language', exact: true }).click();
  await page.getByRole('option', { name: 'Malay', exact: true }).click();
  await expect(page).toHaveURL(/lang=ms/);
  const dateInput = page
    .getByLabel('Free on', { exact: true })
    .filter({ visible: true });
  const date = await dateInput.getAttribute('min');
  await dateInput.fill(date!);
  await expect(page).toHaveURL(new RegExp(`date=${date}`));
  if (mobile) {
    await page.screenshot({
      path: info.outputPath('mobile-filters.png'),
      fullPage: false,
    });
    await page.getByRole('button', { name: 'Show results' }).click();
    await expect(
      page.getByRole('button', { name: 'Filters (3)' }),
    ).toBeFocused();
  }
  await expect
    .poll(() => ({
      specialisation: requests.at(-1)?.get('specialisation'),
      language: requests.at(-1)?.get('language'),
      date: requests.at(-1)?.get('date'),
    }))
    .toEqual({ specialisation: 'anxiety', language: 'ms', date });
  await page.reload();
  await expect(page).toHaveURL(/spec=anxiety/);
  await expect(
    page.getByRole('status').filter({ hasText: '14 professionals' }),
  ).toContainText('Anxiety · Malay');

  await page.goBack();
  await expect(page).not.toHaveURL(/date=/);
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`date=${date}`));
  await page
    .getByRole('button', { name: 'Clear filters', exact: true })
    .click();
  await expect(page).toHaveURL(/\/professionals$/);
  await page.getByLabel('Name', { exact: true }).fill('Empty');
  await expect(
    page.getByRole('heading', { name: 'No professionals found' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Clear filters', exact: true })
    .last()
    .click();
  await expect(
    page.getByRole('link', { name: 'Alex Example 01', exact: true }),
  ).toBeVisible();

  failNext = true;
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    "We couldn't load professionals",
  );
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(
    page.getByRole('link', { name: 'Alex Example 13', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
