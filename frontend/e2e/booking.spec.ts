import { expect, test } from '@playwright/test';

test('confirms a booking, retains its key on retry and handles slot conflicts', async ({
  page,
}, info) => {
  const id = '00000000-0000-4000-8000-000000000001';
  const start = new Date(Date.now() + 48 * 60 * 60 * 1000);
  start.setUTCHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 50 * 60 * 1000);
  const slot = {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    available: true,
  };
  const keys: string[] = [];
  let conflict = false;
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
  await page.route(`**/api/v1/professionals/${id}`, (route) =>
    route.fulfill({
      json: {
        id,
        name: 'Alex Example',
        timezone: 'UTC',
        title: 'Counsellor',
        bio: 'Fictional counsellor.',
        specialisations: ['anxiety'],
        languages: ['en'],
        hasWorkingHours: true,
      },
    }),
  );
  await page.route(`**/api/v1/professionals/${id}/slots`, (route) =>
    route.fulfill({
      json: {
        professionalId: id,
        professionalTimezone: 'UTC',
        memberTimezone: 'UTC',
        slots: [slot],
      },
    }),
  );
  await page.route('**/api/v1/sessions', (route) => {
    keys.push(route.request().headers()['idempotency-key'] ?? '');
    if (conflict)
      return route.fulfill({
        status: 409,
        json: { code: 'SLOT_TAKEN', detail: 'Slot taken' },
      });
    if (keys.length === 1) return route.abort('failed');
    return route.fulfill({
      status: 201,
      json: {
        id: 'booked',
        professionalId: id,
        memberId: 'm',
        ...slot,
        status: 'active',
      },
    });
  });
  await page.goto(`/professionals/${id}`);
  await page
    .getByRole('button')
    .filter({ has: page.locator('[aria-label="Free times"]') })
    .first()
    .click();
  await page.getByRole('button', { name: '09:00', exact: true }).click();
  await page.screenshot({
    path: info.outputPath('booking.png'),
    animations: 'disabled',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'You can cancel or reschedule until',
  );
  await page
    .getByRole('button', { name: 'Confirm booking', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('Please try again');
  await page
    .getByRole('button', { name: 'Confirm booking', exact: true })
    .click();
  await expect(page.getByText('Your session is booked.')).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);

  conflict = true;
  await page.getByRole('button', { name: '09:00', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirm booking', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'That time is no longer free',
  );
  await page.getByRole('button', { name: 'Choose another time' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(keys[2]).not.toBe(keys[1]);
  conflict = false;
  const near = new Date(Date.now() + 4 * 3600000);
  near.setUTCSeconds(0, 0);
  slot.startAt = near.toISOString();
  slot.endAt = new Date(near.getTime() + 3000000).toISOString();
  await page.reload();
  await page
    .getByRole('button')
    .filter({ has: page.locator('[aria-label="Free times"]') })
    .first()
    .click();
  await page
    .locator('[aria-label="Session times"]')
    .getByRole('button')
    .first()
    .click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'This session starts in less than 24 hours.',
  );
  await page.screenshot({
    path: info.outputPath('booking-under-24-hours.png'),
    animations: 'disabled',
    fullPage: false,
  });
  await page.getByRole('button', { name: 'Book anyway', exact: true }).click();
  await expect(page.getByText('Your session is booked.')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
