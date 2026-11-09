import type { components } from '~/types/api';
export function useCurrentUser() {
  return useState<components['schemas']['AccountResponseDto'] | null>(
    'current-user',
    () => null,
  );
}
