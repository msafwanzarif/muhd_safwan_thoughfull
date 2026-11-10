export const ACTIVITY_KEY = 'thoughtfull-last-activity';

export const WARNING_AFTER = 28 * 60 * 1000;

export const LOGOUT_AFTER = 30 * 60 * 1000;

export function idleStage(
  lastActivity: number,
  now: number,
): 'active' | 'warning' | 'expired' {
  const elapsed = Math.max(0, now - lastActivity);
  return elapsed >= LOGOUT_AFTER
    ? 'expired'
    : elapsed >= WARNING_AFTER
      ? 'warning'
      : 'active';
}

export function readActivity(now = Date.now()): number | undefined {
  try {
    const value = Number(localStorage.getItem(ACTIVITY_KEY));
    return Number.isFinite(value) && value > 0 && value <= now + 60000
      ? Math.min(value, now)
      : undefined;
  } catch {
    return undefined;
  }
}

export function writeActivity(value: number): void {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(value));
  } catch {
    /* In-memory activity still works if storage is disabled. */
  }
}

export function broadcastLogout(reason: '' | 'idle' | 'expired' = ''): void {
  try {
    localStorage.setItem(
      'thoughtfull-logout',
      JSON.stringify({ id: crypto.randomUUID(), reason }),
    );
  } catch {
    /* A later API 401 still signs other tabs out. */
  }
}
