import { fileURLToPath } from 'node:url';
import { defineVitestProject } from '@nuxt/test-utils/config';
export default await defineVitestProject({
  test: {
    name: 'frontend',
    environment: 'nuxt',
    hookTimeout: 30000,
    include: ['app/**/*.spec.ts', 'test/**/*.nuxt.spec.ts'],
    environmentOptions: {
      nuxt: {
        rootDir: fileURLToPath(new URL('.', import.meta.url)),
        overrides: { ssr: true, experimental: { appManifest: false } },
      },
    },
  },
});
