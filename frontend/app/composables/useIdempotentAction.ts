import { IdempotencyIntent } from '~/utils/idempotency';

export function useIdempotentAction<T>() {
  const intent = new IdempotencyIntent();
  const busy = ref(false);
  let pending: Promise<T> | undefined;

  function run(
    payload: unknown,
    send: (key: string) => Promise<T>,
  ): Promise<T> {
    if (pending) return pending;
    const key = intent.keyFor(payload);
    busy.value = true;
    pending = (async () => {
      try {
        let result: T;
        try {
          result = await send(key);
        } catch (error) {
          if ((error as { code?: string }).code !== 'REQUEST_IN_PROGRESS')
            throw error;
          await new Promise((resolve) => setTimeout(resolve, 1000));
          result = await send(key);
        }
        intent.reset();
        return result;
      } finally {
        busy.value = false;
        pending = undefined;
      }
    })();
    return pending;
  }

  return { busy, run };
}
