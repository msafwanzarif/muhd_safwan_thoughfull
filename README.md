# ThoughtFull Booking

Backend scaffold and database schema (build steps 1–2). Requires Node 26 and Docker Linux containers.

Run `npm install`, then `docker compose up --build`. API: http://localhost:3000/api/v1/health (liveness).

For local development copy `.env.example` to `.env`, run `docker compose up -d postgres redis`, then `npm run dev`.

`npm run build` compiles the API. `npm test` runs real PostgreSQL/Redis infrastructure tests using Testcontainers; Docker is required. Vitest projects support future unit and frontend tests.

Drizzle: `npm run db:generate`, `npm run db:migrate`. Run `npm run db:migrate` against your configured database before using database features. Business features follow in step 3 onward. Local credentials are development-only.

Formatting uses Prettier with an 80-column target, two-space indentation and consistent line endings. Run `npm run format` to format files. `npm run lint` checks both code rules and formatting; `npm run lint:fix` fixes both.

The schema includes users, professional profiles (with JSONB specialisations and languages), auth sessions, working hours, blocked dates, booking sessions, reminders, notifications and idempotency keys. PostgreSQL generates UUID v7 IDs. Drizzle updates `updated_at` on ORM updates; direct SQL updates must set it explicitly.

Migration `0001_exclusion_constraints.sql` installs `btree_gist` and prevents overlapping working hours and active bookings for either participant. Time ranges are half-open, allowing adjacent sessions. Keep this custom migration when generating future migrations; avoid schema push for provisioning these constraints.

Authentication (step 3): POST /api/v1/auth/sign-up, POST /api/v1/auth/login, POST /api/v1/auth/logout and GET /api/v1/auth/me. Sign-up requires name, email, password (15–128 characters), role and IANA timezone. Professionals also supply title, bio, specialisations and languages.

Browser login uses the configured frontend Origin and receives a Secure, HttpOnly, SameSite=Lax cookie; use HTTPS for browser access. Native clients omit Origin and receive an opaque token for the Bearer header. Cookie-authenticated writes require the configured Origin. Sessions expire after 30 minutes idle or seven days total; logout revokes immediately. Login is limited to five requests per minute per IP; sign-up to three. The in-memory limiter is suitable for a single API instance and needs shared storage before horizontal scaling.

Swagger UI: /api/docs. OpenAPI JSON: /api/openapi.json.

Sign-up requires an Idempotency-Key header (16–128 letters, digits, underscores or hyphens; use a random UUID). Retain the key when retrying the same request: successful responses replay for 24 hours; changed payloads return 422. Keys are global for unauthenticated sign-up and must be unpredictable. Requests with the same key serialize in PostgreSQL with a ten-second wait limit (409 on timeout). Account and retry record commit together. Password-containing request fingerprints use Argon2id; raw request bodies are never saved. Expired records are replaced when their key is reused. Validation failures and failed account creation are not cached. Rate limits also apply to retries.

After code changes, run `sh docker-update.sh` (Git Bash, WSL or a Unix shell). It rebuilds and starts containers, applies migrations, then follows API logs. Ctrl+C stops viewing logs while containers keep running. The script stops if rebuilding or migrations fail.

Set API_ORIGIN to the exact origin hosting Swagger (default http://localhost:3000). Swagger requests from that origin receive Bearer tokens on login. FRONTEND_ORIGIN continues to use cookies; cookie writes still require FRONTEND_ORIGIN. Browsers set Origin automatically; the Swagger header field cannot override it.
