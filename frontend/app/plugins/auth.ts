import type { components } from '~/types/api';
import { roleHome, safeRedirect } from '~/utils/auth';
import {
  broadcastLogout,
  idleStage,
  readActivity,
  writeActivity,
} from '~/utils/activity';

export default defineNuxtPlugin({
  name: 'auth',
  dependsOn: ['api'],
  setup(nuxtApp) {
    const api = nuxtApp.$api;
    const user = useCurrentUser();
    const router = useRouter();
    const authEpoch = useState('auth-epoch', () => 0);
    const sessionNotice = useState<'' | 'idle' | 'expired'>(
      'session-notice',
      () => '',
    );
    let loaded = false;
    let pending: Promise<void> | undefined;
    let logoutPending: Promise<void> | undefined;

    async function load(force = false): Promise<void> {
      if (pending) return pending;
      if (loaded && !force) return;

      pending = (async () => {
        const requestEpoch = authEpoch.value;
        try {
          const account = await api('/api/v1/users/me', {
            method: 'get',
            redirectOnUnauthorized: false,
          });
          if (requestEpoch !== authEpoch.value) return;
          user.value = account;
          loaded = true;
          const lastActivity = import.meta.client ? readActivity() : undefined;
          if (lastActivity && idleStage(lastActivity, Date.now()) === 'expired')
            await logout({ force: true, idle: true, redirect: false });
        } catch (error) {
          if (requestEpoch !== authEpoch.value) return;
          if ((error as { status?: number }).status !== 401) throw error;
          const previouslyAuthenticated = !!user.value;
          user.value = null;
          loaded = true;
          if (previouslyAuthenticated) {
            authEpoch.value++;
            sessionNotice.value = 'expired';
            broadcastLogout('expired');
          }
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
      writeActivity(Date.now());
      authEpoch.value++;
      nuxtApp.$activity?.reset();
      sessionNotice.value = '';
      await load(true);
      if (!user.value)
        throw new Error(
          'Your session could not be saved. Please enable cookies and try again.',
        );
      await router.replace(safeRedirect(redirect) ?? roleHome(user.value.role));
    }

    function logout(
      options: { force?: boolean; idle?: boolean; redirect?: boolean } = {},
    ): Promise<void> {
      if (logoutPending) return logoutPending;
      logoutPending = (async () => {
        const revoke = api('/api/v1/auth/logout', {
          method: 'post',
          redirectOnUnauthorized: false,
          timeout: 5000,
        }).then(
          () => null,
          (cause: unknown) => cause,
        );
        const clear = () => {
          authEpoch.value++;
          user.value = null;
          loaded = true;
          sessionNotice.value = options.idle ? 'idle' : '';
          broadcastLogout(sessionNotice.value);
        };
        if (options.force) {
          clear();
          if (options.redirect !== false) await router.replace('/login');
        }
        const failure = await revoke;
        if (
          failure &&
          (failure as { status?: number }).status !== 401 &&
          !options.force
        )
          throw failure;
        if (!options.force) {
          clear();
          if (options.redirect !== false) await router.replace('/login');
        }
      })().finally(() => {
        logoutPending = undefined;
      });
      return logoutPending;
    }

    if (import.meta.client) {
      window.addEventListener('storage', (event) => {
        if (event.key !== 'thoughtfull-logout' || !event.newValue) return;
        authEpoch.value++;
        user.value = null;
        loaded = true;
        try {
          sessionNotice.value =
            JSON.parse(event.newValue).reason === 'idle' ? 'idle' : 'expired';
        } catch {
          sessionNotice.value = 'expired';
        }
        void router.replace('/login');
      });
    }

    return { provide: { auth: { load, login, logout } } };
  },
});
