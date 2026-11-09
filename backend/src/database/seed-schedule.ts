import { createHash } from 'node:crypto';
import { WorkingRange } from '../availability/domain/working-hours';

// Stable per email: varied demo hours without reshuffling on every seed run.
export function seedRandom(identity: string): () => number {
  let state = createHash('sha256').update(identity).digest().readUInt32LE(0);

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;

    return state / 4294967296;
  };
}

export function seedSchedule(identity: string): WorkingRange[] {
  const random = seedRandom(identity);
  const integer = (min: number, max: number) =>
    min + Math.floor(random() * (max - min + 1));
  const days = [0, 1, 2, 3, 4, 5, 6];
  for (let i = days.length - 1; i > 0; i--) {
    const j = integer(0, i);
    [days[i], days[j]] = [days[j], days[i]];
  }
  const ranges: WorkingRange[] = [];
  for (const weekday of days.slice(0, integer(3, 6))) {
    const startMinute = integer(28, 44) * 15;
    const lengthHours = integer(2, 4);
    ranges.push({ weekday, startMinute, lengthHours });
    if (random() < 0.8) {
      ranges.push({
        weekday,
        startMinute: startMinute + lengthHours * 60 + integer(2, 6) * 15,
        lengthHours: integer(1, 4),
      });
    }
  }

  return ranges.sort(
    (a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute,
  );
}
