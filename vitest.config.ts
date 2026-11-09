import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['backend/src/**/*.spec.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['backend/test/**/*.spec.ts'],
          testTimeout: 120000,
          hookTimeout: 120000,
        },
      },
    ],
  },
});
