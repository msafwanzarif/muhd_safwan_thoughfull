import { expect, test } from '@playwright/test';

test('preserves the original on a reschedule conflict, then reschedules and cancels', async ({
  page,
}) => {
  const professionalId = '00000000-0000-4000-8000-000000000001';
  const member = { id: 'm', name: 'Sam Example', timezone: 'UTC' };
  const professional = {
    id: professionalId,
    name: 'Alex Example',
    timezone: 'UTC',
  };
  const start = new Date(Date.now() + 72 * 3600000);
  start.setUTCHours(9, 0, 0, 0);
  let session = {
    id: '00000000-0000-4000-8000-000000000002',
    member,
    professional,
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + 3000000).toISOString(),
    createdAt: new Date().toISOString(),
    cancelledAt: null as string | null,
    cancelledBy: null as string | null,
    reason: null as string | null,
    status: 'active',
    rescheduledFromId: null,
    rescheduledToId: null,
  };
  const replacement = new Date(start.getTime() + 86400000);
  const slot = {
    startAt: replacement.toISOString(),
    endAt: new Date(replacement.getTime() + 3000000).toISOString(),
    available: true,
  };
  let conflict = true;
  const keys: string[] = [];
  const periods: (string | null)[] = [];
  await page.route('**/api/v1/users/me', (route) =>
    route.fulfill({
      json: {
        ...member,
        role: 'member',
        title: null,
        bio: null,
        specialisations: [],
        languages: [],
      },
    }),
  );
  await page.route(/\/api\/v1\/sessions(?:\?.*)?$/, (route) => {
    const params = new URL(route.request().url()).searchParams;
    periods.push(params.get('period'));
    const items =
      params.get('status') === 'active' && session.status !== 'active'
        ? []
        : [session];
    return route.fulfill({
      json: {
        items,
        page: 1,
        pageSize: 12,
        total: items.length,
        totalPages: items.length ? 1 : 0,
      },
    });
  });
  await page.route(`**/api/v1/professionals/${professionalId}/slots`, (route) =>
    route.fulfill({
      json: {
        slots: [slot],
        professionalId,
        professionalTimezone: 'UTC',
        memberTimezone: 'UTC',
      },
    }),
  );
  await page.route('**/reschedule', (route) => {
    keys.push(route.request().headers()['idempotency-key'] ?? '');
    if (conflict)
      return route.fulfill({
        status: 409,
        json: { code: 'SLOT_TAKEN', detail: 'Slot taken' },
      });
    session = { ...session, startAt: slot.startAt, endAt: slot.endAt };
    return route.fulfill({ json: { previousSessionId: session.id, session } });
  });
  await page.route('**/cancel', (route) => {
    session = {
      ...session,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledBy: member.id,
      reason: route.request().postDataJSON().reason,
    };
    return route.fulfill({ json: { ...session } });
  });
  await page.goto('/sessions');
  await page.getByRole('button', { name: 'Reschedule', exact: true }).click();
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
  await page.getByRole('button', { name: 'Review new time' }).click();
  await page.getByRole('button', { name: 'Confirm reschedule' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Someone else just booked' }),
  ).toContainText('Someone else just booked');
  expect(session.startAt).toBe(start.toISOString());
  conflict = false;
  await page
    .locator('[aria-label="Session times"]')
    .getByRole('button')
    .first()
    .click();
  await page.getByRole('button', { name: 'Review new time' }).click();
  await page.getByRole('button', { name: 'Confirm reschedule' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(keys[0]).toBe(keys[1]);
  expect(session.startAt).toBe(slot.startAt);
  await page
    .getByRole('button', { name: 'Cancel session', exact: true })
    .click();
  await page.getByLabel('Reason (optional)').fill('Plans changed');
  await page.getByRole('button', { name: 'Yes, cancel session' }).click();
  await expect(
    page.getByRole('heading', { name: 'No sessions to show' }),
  ).toBeVisible();
  await page.getByRole('switch', { name: 'Show cancelled' }).click();
  await expect(
    page.getByText('Cancellation reason: Plans changed'),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Past' }).click();
  await expect.poll(() => periods.at(-1)).toBe('past');
  await expect(page).toHaveURL(/tab=past/);
});
