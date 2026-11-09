# ThoughtFull Booking

Step 1 scaffold. Requires Node 26 and Docker Linux containers.

Run `npm install`, then `docker compose up --build`. API: http://localhost:3000/api/v1/health (liveness).

For local development copy `.env.example` to `.env`, run `docker compose up -d postgres redis`, then `npm run dev`.

`npm run build` compiles the API. `npm test` runs real PostgreSQL/Redis infrastructure tests using Testcontainers; Docker is required. Vitest projects support future unit and frontend tests.

Drizzle: `npm run db:generate`, `npm run db:migrate`. Schema and business features follow in step 2 onward. Local credentials are development-only.

Formatting uses Prettier with an 80-column target, two-space indentation and consistent line endings. Run `npm run format` to format files. `npm run lint` checks both code rules and formatting; `npm run lint:fix` fixes both.
