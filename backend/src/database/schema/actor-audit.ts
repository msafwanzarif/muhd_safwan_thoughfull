import { uuid } from 'drizzle-orm/pg-core';
import { users } from './users';
import { audit } from './columns';
export const actorAudit = () => ({
  createdBy: uuid()
    .notNull()
    .references(() => users.id),
  updatedBy: uuid()
    .notNull()
    .references(() => users.id),
  ...audit(),
});
