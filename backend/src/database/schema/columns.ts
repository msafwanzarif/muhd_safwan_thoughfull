import { sql } from 'drizzle-orm';
import { uuid, timestamp } from 'drizzle-orm/pg-core';
export const id = () =>
  uuid()
    .primaryKey()
    .default(sql`uuidv7()`);
export const time = () => timestamp({ withTimezone: true });
export const audit = () => ({
  createdAt: time().notNull().defaultNow(),
  updatedAt: time()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
