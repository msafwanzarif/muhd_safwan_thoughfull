import {
  ACTIVITY_KEY,
  idleStage,
  LOGOUT_AFTER,
  readActivity,
  writeActivity,
} from '~/utils/activity';

export default defineNuxtPlugin({
  name: 'activity',
  dependsOn: ['auth'],
  setup() {
    const user = useCurrentUser();
    const auth = useAuth();
    const now = useNow({ interval: 1000 });
    const lastActive = ref(readActivity() ?? Date.now());
    const warning = computed(
      () =>
        !!user.value &&
        idleStage(lastActive.value, now.value.getTime()) === 'warning',
    );
    const remaining = computed(() =>
      Math.max(
        0,
        Math.ceil(
          (lastActive.value + LOGOUT_AFTER - now.value.getTime()) / 1000,
        ),
      ),
    );
    const pollPaused = computed(
      () => now.value.getTime() - lastActive.value >= 60000,
    );
    const input = useIdle(60000, {
      events: ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'],
      listenForVisibilityChange: false,
    });
    const focused = useWindowFocus();
    const visibility = useDocumentVisibility();
    let signingOut = false;

    function reset() {
      lastActive.value = Date.now();
      writeActivity(lastActive.value);
    }

    async function check() {
      lastActive.value = Math.max(lastActive.value, readActivity() ?? 0);
      if (
        !user.value ||
        signingOut ||
        idleStage(lastActive.value, Date.now()) !== 'expired'
      )
        return;
      signingOut = true;
      try {
        await auth.logout({ force: true, idle: true });
      } finally {
        signingOut = false;
      }
    }

    const record = useThrottleFn(
      () => {
        if (!user.value) return;
        lastActive.value = Math.max(lastActive.value, readActivity() ?? 0);
        const stage = idleStage(lastActive.value, Date.now());
        if (stage === 'expired') {
          void check();
          return;
        }
        if (stage === 'active') reset();
      },
      1000,
      true,
      false,
    );
    watch(input.lastActive, record);
    watch(now, check);
    watch([focused, visibility], () => {
      now.value = new Date();
      void check();
    });
    watch(
      () => user.value?.id,
      (id) => {
        if (!id) return;
        lastActive.value = readActivity() ?? Date.now();
        writeActivity(lastActive.value);
        void check();
      },
    );
    useEventListener(window, 'storage', (event) => {
      if (event.key !== ACTIVITY_KEY || !event.newValue) return;
      lastActive.value = Math.max(lastActive.value, readActivity() ?? 0);
      void check();
    });
    return {
      provide: {
        activity: { lastActive, warning, remaining, pollPaused, reset, check },
      },
    };
  },
});
