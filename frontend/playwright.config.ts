import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://127.0.0.1:3011',
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      command:
        'npm run build -w backend && node backend/scripts/serve-auth-test-api.cjs',
      cwd: '..',
      url: 'http://127.0.0.1:3012/api/v1/auth/me',
      timeout: 120000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run preview:test',
      env: { NUXT_PUBLIC_API_BASE: 'http://127.0.0.1:3012/api/v1' },
      url: 'http://127.0.0.1:3011',
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
