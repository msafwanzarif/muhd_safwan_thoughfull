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

Working hours and slots (step 4):

- Professionals use GET and PUT /api/v1/working-hours. PUT replaces the whole week with a ranges array: weekday (Sunday = 0), startMinute (minutes after local midnight, in steps of 15), and lengthHours (positive whole hours). Empty ranges clears availability. Overlaps and midnight-crossing ranges are rejected. Existing future bookings outside the new hours are retained and listed in warnings.
- Members use GET /api/v1/professionals/:professionalId/slots. Responses include UTC start/end strings and both timezones. Slots run for 50 minutes with 10 minutes between professional sessions. Booked professional slots are omitted; overlaps with the current member's sessions are returned as unavailable with MEMBER_OVERLAP. No other member's identity is returned.
- Minimum notice is two hours, inclusive. The calendar window includes today through today + 28 days in the member's timezone; a session must finish before the next local midnight. Blocked professional-local dates are excluded. Nonexistent daylight-saving start times are skipped; repeated times use the earlier occurrence. Slots are generated on request.

Timezone changes and blocked-date editing endpoints are available (step 10).

Booking creation (step 5): POST /api/v1/sessions with professionalId and startAt (ISO UTC ending in Z), plus Idempotency-Key. Only members can book; their identity is read from the session. The API regenerates slots in the booking transaction and returns 409 SLOT_TAKEN for unavailable slots. PostgreSQL exclusion constraints remain the final safeguard against professional or member overlaps.

Booking keys are scoped per member for 24 hours. Identical retries replay the original status/body; different payloads return 422. A committed in-progress claim coordinates retries without holding a lock while polling (100 ms, up to 10 seconds). Claims abandoned for 30 seconds can be recovered. The booking and completed response commit atomically; deterministic client errors are cached too.

My sessions (step 6): GET /api/v1/sessions supports page (default 1), pageSize (default 20, maximum 100), and optional status (active, cancelled or rescheduled). Sessions are restricted to the authenticated member or professional and ordered by start time then ID. Responses include items, page, pageSize, total and totalPages. GET /api/v1/sessions/:id is restricted to participants; unrelated and nonexistent IDs return the same 404. Participant names and timezones are included; emails and password hashes are excluded. Client-supplied identity filters are rejected.

Cancellation and rescheduling (step 7): POST /api/v1/sessions/:id/cancel accepts an optional reason. Members need at least 24 hours remaining (exactly 24 hours is allowed); professionals may cancel their sessions at any time. POST /api/v1/sessions/:id/reschedule accepts a UTC startAt and is member-only, for the same professional. The original must be at least 24 hours away; the new slot may be sooner if it meets the two-hour notice rule. Both require Idempotency-Key and return 200.

Cancellation retains history and frees the slot. Rescheduling marks the original rescheduled and links a new active booking in one transaction; failures preserve the original. Pending reminders are cancelled and the other participant receives a stored notification. Reminder queue scheduling and delivery are handled by the reminder worker.

Reminders and notifications (step 8): bookings create future 24-hour and 1-hour reminders for both participants in the booking transaction. BullMQ delayed jobs use the reminder ID as job ID. Startup and a 15-second reconciliation loop restore pending jobs after Redis loss and retry synchronization failures. Cancel/reschedule removes queued jobs after commit; the worker always checks database status before delivery.

Notification creation and marking a reminder sent commit together under row locks, so duplicate jobs do not duplicate notifications. Overdue reminders are delivered if the session has not started; otherwise they are skipped.

Notification endpoints: GET /api/v1/notifications (limit and cursor), GET /api/v1/notifications/unread-count, PATCH /api/v1/notifications/:id/read. Only the authenticated recipient can list or change notifications. Repeated mark-read calls retain the first timestamp. Clients poll and format structured UTC data in their own timezone. Swagger includes all request/response DTOs.

Professional directory (step 9): GET /api/v1/professionals accepts page, pageSize, name (case-insensitive literal substring), specialisation, language and date (YYYY-MM-DD in the member's timezone). Members only. Responses include public profile details and hasWorkingHours; professionals without working hours remain visible without a date filter. Emails and account secrets are excluded.

Date filtering uses SQL to narrow profile matches and relevant professional-local weekdays, then batch-loads hours, active sessions and blocked dates. It generates slots for the shortlist and paginates matching professionals in memory. This is suitable for the demo; large directories should move date availability filtering/pagination into a dedicated indexed availability model. Invalid calendar dates return 400; dates outside the booking window return an empty page.

Extras (step 10): professionals can GET/PUT /api/v1/blocked-dates and DELETE /api/v1/blocked-dates/:id. Blocking a local date keeps existing sessions and returns them as warnings. PATCH /api/v1/users/me/timezone changes the authenticated account timezone; professionals must supply their complete replacement ranges in the new timezone (an empty array clears availability). Members omit ranges. UTC booking times and blocked calendar dates do not move.

Working ranges use whole-hour lengths, quarter-hour starts, and must finish by midnight. Timezone changes do not convert or split ranges.

After migrations, run npm run build and then npm run db:seed locally. In Docker, run docker compose exec api npm run db:seed; the image already contains compiled seed files, so seeding does not rebuild them. This creates fictional professionals aina@example.test (Kuala Lumpur), ravi@example.test (Kolkata), taylor@example.test (New York), and members sam@example.test and jordan@example.test. Demo password: ThoughtFull-demo-2026! The roster includes 15 professionals across 14 timezones. New professional schedules use 3–6 working days, varied quarter-hour starts, different session windows, optional split days and breaks, including weekends. Profiles also vary in title, specialisations and languages. Schedules are deterministic per email; existing accounts retain their current hours. Rerunning the seed leaves existing accounts and hours unchanged.

Frontend contract alignment: GET/PATCH /api/v1/users/me provides the editable account/profile independently of the minimal auth identity. GET /api/v1/professionals/:id supports direct profile links. Sessions support period=upcoming|past, statuses=active,cancelled,rescheduled, and inclusive from/exclusive to start-time bounds before pagination; upcoming includes sessions still in progress. Responses include creation/cancellation metadata and reschedule links. PUT /api/v1/blocked-dates/bulk atomically saves up to 90 unique date objects with post-save warnings. PATCH /api/v1/notifications/read-all returns the number updated. New notifications include participant display names and cancellation reasons where applicable. Idempotency waits expose REQUEST_IN_PROGRESS.

Frontend scaffold: Nuxt 4 SPA with Nuxt UI 4 and VueUse in frontend/. Run npm run dev:web for http://localhost:3001, npm run build:web for the static frontend/.output/public build, and npm run typecheck:web for Vue/TypeScript checks. Nginx serving and the feature screens follow in later frontend steps.

Run npm run gen:api after backend contract changes. It compiles the backend, exports its Swagger contract without starting the database or queue worker, then regenerates frontend/app/types/api.d.ts. Keep the generated types checked in. NUXT_PUBLIC_API_BASE is the browser-visible API base URL and is set at build time for static hosting.

The root npm test runs backend and Nuxt frontend projects. npm run lint includes both projects and formatting. Browser checks use npm run test:browser (install Chromium with npx playwright install chromium first, or set PLAYWRIGHT_CHANNEL=chrome for installed Chrome). Run npm run test:all for both suites. Docker must be running: browser authentication tests create an isolated PostgreSQL container and API on port 3012, and build/serve the SPA on port 3011. These checks leave the development API and frontend untouched. Cookie login, member/professional sign-up, role guards, session restoration/expiry, idempotent retries and logout across tabs are covered; booking/reschedule coverage follows with those screens.

Frontend references are in the sibling muhd_safwan_thoughtfull_reference/Frontend Plan folder. Sign-up will redirect to login; the browser uses cookies and never stores session tokens.

Authentication screens are at /login and /signup. Successful sign-up redirects to login with a confirmation; it does not start a session. Professional sign-up includes title, bio, specialisations and languages. The searchable city/timezone picker defaults to the browser timezone. Login fetches the account through GET /users/me, then redirects members to /professionals and professionals to /pro/schedule (the schedule is currently a landing placeholder). Refresh restores the cookie session. Guests are redirected to login with a safe internal return path, and each role is redirected away from the other role's pages. Both layouts include the account menu, logout and the saved light/dark icon toggle. Keep FRONTEND_ORIGIN=http://localhost:3001 and NUXT_PUBLIC_API_BASE=http://localhost:3000/api/v1 for local development; use localhost consistently in the browser so the API can set its same-site cookie. Browser-managed Origin and HttpOnly cookies require no manual headers or tokens.

Professional directory: /professionals provides a responsive card grid, debounced name search, specialisation, language and free-date filters, and 12 results per page. Filters use URL parameters name, spec, lang, date and page; changing filters resets pagination, while refresh and browser history preserve the selection. On mobile, extra filters open in a keyboard-accessible side panel. Free dates use the member's saved timezone and the API's booking window (today through 28 days ahead). Cards derive city from professional timezone and show No availability only when working hours are absent. Configured hours do not guarantee a free slot. Cards open /professionals/:id for profile details; calendar and booking are the next frontend step. Loading, empty, out-of-range-page and retry states are included. Browser coverage checks real API name search/profile navigation plus filter mapping, pagination, URL history, mobile focus and request recovery.

Security checks: npm run audit:security fails on high or critical npm advisories. Security overrides keep modern glob/minimatch and esbuild dependencies on patched versions; verify lint, builds, schema generation and tests when changing them. Remaining low-severity findings originate from deepmerge in the Nuxt build-tool chain. Browser tests serve the built SPA on an isolated localhost port (3011), leaving the development server on 3001 untouched.

Frontend step 4: professional profiles include a Monday-first booking calendar (two months on desktop, one on mobile), free-day markers, saved-timezone slot times and contained unavailable-time explanations. Confirmation distinguishes normal bookings, the under-24-hour lock and slot conflicts. Booking retries reuse an idempotency key; only REQUEST_IN_PROGRESS is retried automatically once. For controlled-response browser tests without Docker, set PLAYWRIGHT_SKIP_API=1 and select the relevant test file (for example booking); full browser/integration checks still require Docker.

Frontend step 5: /sessions has URL-backed upcoming/past tabs, cancelled/rescheduled history, pagination, participant-only detail links, and saved-timezone session cards. Members can cancel or reschedule only at least 24 hours ahead; the server remains authoritative. Cancellation and rescheduling use idempotency keys. The reschedule panel preserves the original until confirmation succeeds and refreshes availability after conflicts. Controlled-response browser checks cover conflict preservation, retry, cancellation and history filtering; database-backed smoke checks remain available when Docker runs.

Frontend step 6: member and professional notification pages share the bell's unread state and one 30-second poller. Polling pauses while hidden or after a minute without input and refreshes on focus/activity. Desktop has a latest-three popover; mobile opens the full list. Cursor pagination, mark-one/all read, participant names/reasons and session detail links are implemented. No notification content is stored in browser storage; shared state resets when identity changes.

Frontend step 7: professionals have upcoming/past day-grouped lists, cancelled history, and a desktop-only week view with working-hour shading and a live now line. Week requests use timezone-aware Monday boundaries and load every result page. Repeated DST clock times use separate lanes. Professionals can cancel at any time; session details retain participant-only API access. Mobile keeps the list view.
