# ThoughtFull Booking

Backend scaffold and database schema (build steps 1–2). Requires Node 26 and Docker Linux containers.

Run `npm install`, then `docker compose up --build`. API: http://localhost:3000/api/v1/health (liveness).

For local development copy `.env.example` to `.env`, run `docker compose up -d postgres redis`, then `npm run dev`.

`npm run build` compiles the API. `npm test` runs real PostgreSQL/Redis infrastructure tests using Testcontainers; Docker is required. Vitest projects support future unit and frontend tests.

Drizzle: `npm run db:generate`, `npm run db:migrate`. Run `npm run db:migrate` against your configured database before using database features. Business features follow in step 3 onward. Local credentials are development-only.

Formatting uses Prettier with an 80-column target, two-space indentation and consistent line endings. Run `npm run format` to format files. `npm run lint` checks both code rules and formatting; `npm run lint:fix` fixes both.

The schema includes users, professional profiles (with JSONB specialisations and languages), auth sessions, working hours, blocked dates, booking sessions, reminders, notifications and idempotency keys. PostgreSQL generates UUID v7 IDs. Drizzle updates `updated_at` on ORM updates; direct SQL updates must set it explicitly.

Migration `0001_exclusion_constraints.sql` installs `btree_gist` and prevents overlapping working hours and active bookings for either participant. Time ranges are half-open, allowing adjacent sessions. Keep this custom migration when generating future migrations; avoid schema push for provisioning these constraints.
