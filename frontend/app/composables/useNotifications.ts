import { createSharedComposable } from '@vueuse/core';
import type { components } from '~/types/api';
import { problemMessage } from '~/utils/problem';

type Notification = components['schemas']['NotificationResponseDto'];

export const useNotifications = createSharedComposable(() => {
  const api = useApi();
  const user = useCurrentUser();
  const visibility = useDocumentVisibility();
  const focused = useWindowFocus();
  const { idle } = useIdle(60000);
  const items = ref<Notification[]>([]);
  const unread = ref(0);
  const cursor = ref<string | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref('');
  let pending: Promise<void> | undefined;

  function reset() {
    items.value = [];
    unread.value = 0;
    cursor.value = null;
    error.value = '';
  }

  function refresh(): Promise<void> {
    if (pending) return pending;
    const identity = user.value?.id;
    if (!identity || loading.value) return Promise.resolve();
    pending = (async () => {
      loading.value = true;
      try {
        const [page, count] = await Promise.all([
          api('/api/v1/notifications', { method: 'get', query: { limit: 20 } }),
          api('/api/v1/notifications/unread-count', { method: 'get' }),
        ]);
        if (user.value?.id !== identity) return;
        const overlaps = page.items.some((item) =>
          items.value.some((existing) => existing.id === item.id),
        );
        if (overlaps) {
          const merged = new Map(items.value.map((item) => [item.id, item]));
          for (const item of page.items) merged.set(item.id, item);
          items.value = [...merged.values()].sort((a, b) =>
            b.id.localeCompare(a.id),
          );
        } else {
          items.value = page.items;
          cursor.value = page.nextCursor;
        }
        unread.value = count.count;
        error.value = '';
      } catch (cause) {
        if (user.value?.id === identity) error.value = problemMessage(cause);
      } finally {
        loading.value = false;
        pending = undefined;
      }
    })();
    return pending;
  }

  async function more() {
    if (!cursor.value || loading.value) return;
    const identity = user.value?.id;
    loading.value = true;
    try {
      const page = await api('/api/v1/notifications', {
        method: 'get',
        query: { cursor: cursor.value, limit: 20 },
      });
      if (identity !== user.value?.id) return;
      const existing = new Set(items.value.map((item) => item.id));
      items.value.push(...page.items.filter((item) => !existing.has(item.id)));
      cursor.value = page.nextCursor;
      error.value = '';
    } catch (cause) {
      error.value = problemMessage(cause);
    } finally {
      loading.value = false;
    }
  }

  async function markRead(item: Notification) {
    if (item.readAt || saving.value) return;
    saving.value = true;
    try {
      const updated = await api('/api/v1/notifications/{id}/read', {
        method: 'patch',
        params: { id: item.id },
      });
      items.value = items.value.map((current) =>
        current.id === updated.id ? updated : current,
      );
      unread.value = Math.max(0, unread.value - 1);
      error.value = '';
    } catch (cause) {
      error.value = problemMessage(cause);
      throw cause;
    } finally {
      saving.value = false;
    }
  }

  async function markAll() {
    if (saving.value) return;
    saving.value = true;
    try {
      await api('/api/v1/notifications/read-all', { method: 'patch' });
      items.value = items.value.map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
      }));
      unread.value = 0;
      error.value = '';
    } catch (cause) {
      error.value = problemMessage(cause);
    } finally {
      saving.value = false;
    }
  }

  function poll() {
    if (
      user.value &&
      visibility.value === 'visible' &&
      !idle.value &&
      !saving.value
    )
      void refresh();
  }
  useIntervalFn(poll, 30000);
  watch([focused, visibility, idle], poll);
  watch(
    () => user.value?.id,
    () => {
      reset();
      poll();
    },
    { immediate: true },
  );

  return {
    items,
    unread,
    cursor,
    loading,
    saving,
    error,
    refresh,
    more,
    markRead,
    markAll,
  };
});
