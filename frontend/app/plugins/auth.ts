import type { components } from '~/types/api';
import { roleHome, safeRedirect } from '~/utils/auth';

export default defineNuxtPlugin({
  name: 'auth',
  dependsOn: ['api'],
  setup(nuxtApp) {
    const api = nuxtApp.$api;
    const user = useCurrentUser();
    const router = useRouter();
    let loaded = false;
    let pending: Promise<void> | undefined;

    async function load(force = false): Promise<void> {
      if (pending) return pending;
      if (loaded && !force) return;

      pending = (async () => {
        try {
          user.value = await api('/api/v1/users/me', {
            method: 'get',
            redirectOnUnauthorized: false,
          });
          loaded = true;
        } catch (error) {
          if ((error as { status?: number }).status !== 401) throw error;
          user.value = null;
          loaded = true;
        }
      })();

      try {
        await pending;
      } finally {
        pending = undefined;
      }
    }

    async function login(
      body: components['schemas']['LoginDto'],
      redirect?: unknown,
    ): Promise<void> {
      await api('/api/v1/auth/login', {
        method: 'post',
        body,
        redirectOnUnauthorized: false,
      });
      await load(true);
      if (!user.value)
        throw new Error(
          'Your session could not be saved. Please enable cookies and try again.',
        );
      await router.replace(safeRedirect(redirect) ?? roleHome(user.value.role));
    }

    async function logout(): Promise<void> {
      try {
        await api('/api/v1/auth/logout', {
          method: 'post',
          redirectOnUnauthorized: false,
        });
      } catch (error) {
        if ((error as { status?: number }).status !== 401) throw error;
      }
      user.value = null;
      loaded = true;
      localStorage.setItem('thoughtfull-logout', crypto.randomUUID());
      await router.replace('/login');
    }

    if (import.meta.client) {
      window.addEventListener('storage', (event) => {
        if (event.key !== 'thoughtfull-logout' || !event.newValue) return;
        user.value = null;
        loaded = true;
        void router.replace('/login');
      });
    }

    return { provide: { auth: { load, login, logout } } };
  },
});
