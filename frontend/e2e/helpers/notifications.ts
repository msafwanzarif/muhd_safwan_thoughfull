import type { Page } from '@playwright/test';

export async function mockEmptyNotifications(page: Page): Promise<void> {
  await page.route('**/api/v1/notifications**', (route) =>
    route.fulfill({
      json: route.request().url().includes('unread-count')
        ? { count: 0 }
        : { items: [], nextCursor: null },
    }),
  );
}
