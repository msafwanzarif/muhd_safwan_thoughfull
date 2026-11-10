import { onBeforeRouteLeave } from 'vue-router';

export function useUnsavedChanges(dirty: Ref<boolean> | ComputedRef<boolean>) {
  const user = useCurrentUser();
  onBeforeRouteLeave(
    () =>
      !dirty.value ||
      !user.value ||
      window.confirm('Discard your unsaved changes?'),
  );
  useEventListener(window, 'beforeunload', (event) => {
    if (dirty.value && user.value) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}
