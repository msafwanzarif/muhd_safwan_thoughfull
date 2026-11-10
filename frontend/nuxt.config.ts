export default defineNuxtConfig({
  compatibilityDate: '2026-11-10',
  ssr: false,
  devtools: { enabled: false },
  colorMode: {
    preference: 'light',
    fallback: 'light',
    storage: 'localStorage',
    storageKey: 'thoughtfull-theme',
  },
  modules: ['@nuxt/ui', '@vueuse/nuxt', '@nuxt/eslint'],
  icon: {
    provider: 'none',
    clientBundle: { scan: true },
  },
  css: ['~/assets/css/main.css'],
  runtimeConfig: { public: { apiBase: 'http://localhost:3000/api/v1' } },
  app: {
    head: {
      title: 'ThoughtFull Booking',
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
      meta: [
        {
          name: 'description',
          content:
            'Connect with counsellors and coaches who listen, wherever you are.',
        },
      ],
    },
  },
  fonts: {
    families: [
      { name: 'Plus Jakarta Sans', provider: 'google' },
      { name: 'Open Sans', provider: 'google' },
    ],
  },
});
