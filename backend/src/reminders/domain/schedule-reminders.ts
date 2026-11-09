export function reminderSchedule(
  startAt: Date,
  now: Date,
): { type: '24h' | '1h'; dueAt: Date }[] {
  return [
    { type: '24h' as const, hours: 24 },
    { type: '1h' as const, hours: 1 },
  ]
    .map((r) => ({
      type: r.type,
      dueAt: new Date(startAt.getTime() - r.hours * 3600000),
    }))
    .filter((r) => r.dueAt > now);
}
