import type { paths } from '~/types/api';
import { toApiError } from '~/utils/api-error';
type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
type Json<T> = T extends { content: { 'application/json': infer Body } }
  ? Body
  : never;
type Operation<P extends keyof paths, M extends keyof paths[P]> = NonNullable<
  paths[P][M]
>;
type Body<T> = T extends { requestBody: infer B } ? Json<B> : never;
type Query<T> = T extends { parameters: { query?: infer Q } } ? Q : never;
type Params<T> = T extends { parameters: { path: infer Q } } ? Q : never;
type Result<T> = T extends { responses: infer R }
  ? 200 extends keyof R
    ? Json<R[200]>
    : 201 extends keyof R
      ? Json<R[201]>
      : undefined
  : undefined;
export default defineNuxtPlugin({
  name: 'api',
  setup() {
    const config = useRuntimeConfig();
    const currentUser = useCurrentUser();
    const router = useRouter();
    async function api<
      P extends keyof paths,
      M extends Extract<keyof paths[P], Method>,
    >(
      path: P,
      options: {
        method: M;
        body?: Body<Operation<P, M>>;
        query?: Query<Operation<P, M>>;
        params?: Params<Operation<P, M>>;
        idempotencyKey?: string;
        redirectOnUnauthorized?: boolean;
      },
    ): Promise<Result<Operation<P, M>>> {
      let route = String(path).slice('/api/v1'.length);
      for (const [key, value] of Object.entries(options.params ?? {}))
        route = route.replace(
          '{' + key + '}',
          encodeURIComponent(String(value)),
        );
      try {
        return await $fetch<Result<Operation<P, M>>>(route, {
          baseURL: config.public.apiBase,
          method: options.method,
          credentials: 'include',
          body: options.body as Record<string, unknown> | undefined,
          query: options.query as Record<string, unknown> | undefined,
          headers: options.idempotencyKey
            ? { 'Idempotency-Key': options.idempotencyKey }
            : undefined,
          retry: 0,
        });
      } catch (cause) {
        const error = toApiError(cause);
        if (error.status === 401 && options.redirectOnUnauthorized !== false) {
          currentUser.value = null;
          const current = router.currentRoute.value.fullPath;
          if (router.currentRoute.value.path !== '/login')
            await router.push({ path: '/login', query: { redirect: current } });
        }
        throw error;
      }
    }
    return { provide: { api } };
  },
});
