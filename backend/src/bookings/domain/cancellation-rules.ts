export function canMemberChangeSession(startAt: Date, now: Date): boolean {
  return startAt.getTime() - now.getTime() >= 24 * 60 * 60 * 1000;
}
