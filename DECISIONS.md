# Decisions

This file records the implemented backend and frontend decisions, their trade-offs, assumptions, known limitations, and production follow-up. Setup and commands are in [README.md](README.md).

**Stack at a glance:** Node.js 26 · NestJS · Drizzle ORM · PostgreSQL 18 · Redis + BullMQ · Nuxt 4 / Vue / Nuxt UI · Vitest + Testcontainers · Playwright · Docker Compose.

---

## Key decisions

### 1. Preventing double-booking: Postgres exclusion constraints

**Decision.** Store UTC start/end timestamps and apply half-open `tstzrange` GiST exclusion constraints to active sessions for both professional and member. A member cannot overlap bookings with different professionals. Cancelled/rescheduled sessions release their time; conflicts return `409 SLOT_TAKEN`.

**Why.** The database protects every write path, including concurrent booking and rescheduling. The server also regenerates slots before inserting to enforce availability, notice, and booking-window rules.

**Trade-off.** PostgreSQL-specific constraints require custom SQL migrations. Keep these migrations; do not replace them with schema push. Application-only checks would leave a race between checking and inserting.

**Tests.** Concurrent identical bookings and member overlap across professionals use real PostgreSQL.

### 2. Reminders delivered exactly once: reminders table + BullMQ

**Decision.** PostgreSQL owns reminder state; BullMQ schedules jobs using reminder IDs. Create 24-hour and 1-hour reminders for both participants only when those reminder times are still ahead. Notification insertion and marking a reminder sent happen in one transaction.

**Why.** Jobs may run more than once; the database prevents duplicate in-app delivery. Reconciliation runs at startup and every 15 seconds to recover queue drift. Late reminders are delivered only before the session starts; otherwise they are skipped. Cancellation/rescheduling invalidates old reminders.

**Trade-off.** Redis is extra infrastructure. The worker runs inside the API process; a separate worker is a future scaling option. Exactly-once applies to persisted in-app notifications, not hypothetical email/SMS delivery.

**Tests.** Reminder scheduling boundaries, retries, cancellation, rescheduling, and recovery.

### 3. Time zones and daylight saving

**Decision.** Store booking instants in UTC and return ISO 8601 strings. Users choose validated IANA zones; clients display sessions in the viewer's saved zone. Working hours use the professional's local weekday, start minute, and whole-hour length.

- Starts use 15-minute increments; ranges must finish by midnight, with no midnight splitting.
- A professional changing time zone must supply the complete replacement week or explicitly clear availability. Hours are not converted automatically.
- Existing bookings retain their UTC instants; blocked dates retain their local calendar dates. Changes report affected bookings rather than cancelling them.
- Skip nonexistent DST wall times; choose the earlier occurrence of repeated times. A session must still fit within its local working range.

**Why.** Explicit replacement avoids offset conversion surprises and cross-midnight/Sunday wrapping. Fractional-offset zones remain supported.

**Tests.** Fractional offsets, DST gaps/repeats, replacement validation, and preservation of existing bookings.

### 4. Slot layout: hourly, 50 minutes plus a 10-minute break, generated on demand

**Decision.** Generate slots hourly from each range's start, such as 09:30, 10:30, and 11:30. Each session lasts 50 minutes; multiple ranges allow lunch breaks. Slots are computed from hours, blocked dates, and active bookings rather than stored.

Slots fill each range end to end on a fixed, non-overlapping grid, including the 10-minute breaks. Booking a middle slot removes that slot without shifting its neighbours. Allowing overlapping start options could let one middle booking block several alternatives and reduce the total sessions bookable in the range.

- Window: now through the end of day 28 in the member's zone.
- Minimum booking notice: two hours.
- The member's own conflicting bookings make slots unavailable without revealing another person's booking details.

**Why.** On-demand generation avoids stale slot records after availability changes. Starts are aligned to the range, not necessarily to the clock hour.

**Trade-off.** Date-filtered professional search requires availability generation and some in-memory pagination. A searchable availability index is the scaling path.

### 5. Authentication: opaque session tokens

**Decision.** Store only token hashes. Browser login uses an `HttpOnly`, `Secure`, `SameSite=Lax` cookie; Swagger/non-cookie clients can use the same opaque token as Bearer authentication. Browser JavaScript does not store the token.

- Server expiry: 30 minutes of request inactivity, with a seven-day hard limit; logout revokes the session.
- Browser human-activity tracking warns at 28 minutes and signs out at 30. Background polling does not count as human activity. Activity/logout are shared across tabs.
- An auth epoch rejects replies belonging to an ended session. Explicit logout suppresses competing 401 expiry redirects.
- Passwords use Argon2id. Cookie writes require the configured origin; credentialed CORS uses the configured frontend origin.

**Why.** Opaque sessions support immediate revocation without JWT refresh-token machinery. Human-idle tracking prevents background requests from keeping an unattended browser signed in indefinitely.

**Trade-off.** Authentication needs an indexed database lookup. A separate native mobile client is not implemented. Local browser cookie behavior is tested on localhost; deployment needs HTTPS and correct origins.

### 6. Cancel and reschedule

**Decision.** Members can cancel/reschedule with at least 24 hours remaining, including exactly 24 hours. Professionals can cancel their sessions at any time. A new rescheduled slot still needs two hours' booking notice.

Rescheduling stays with the same professional. One transaction marks the original rescheduled and creates its replacement; a failure preserves the original. Sessions retain cancellation actor/time/reason and links between original and replacement bookings.

**Presentation.** Active sessions stay prominent. History uses muted/dashed rows and crossed-out times. Member cancellation labels use the actor's name; professional schedule labels use “Cancelled by you”, “Cancelled by {member name}”, and “Rescheduled by {member name}”. Links open original/replacement details. Professionals see separate active, moved, and cancelled day counts.

**Tests.** Exact 24-hour boundary, access control, conflict rollback, idempotent retries, and desktop/mobile history states.

### 7. Idempotent booking, reschedule, cancel, and sign-up

**Decision.** Require a random `Idempotency-Key` of 16–128 permitted characters. Retain results for 24 hours; a changed payload with the same key returns `422`.

- Booking/change keys are scoped per user. Claim rows, transactional ownership locks, stored responses, bounded waiting, and stale-claim recovery prevent duplicate side effects. Deterministic client errors can also be replayed.
- Sign-up uses a separate global key hash, a transaction advisory lock, and an Argon2 request fingerprint because the payload includes a password. Account/profile creation and the replay record commit together.
- Clients retain keys for uncertain retries. Choosing a different action/payload requires a new key. Sign-up succeeds by sending the user to login, not by creating a browser session.

**Why.** A timeout must not create duplicate accounts/bookings or leave the client unsure whether an action succeeded.

**Tests.** Replay, changed payloads, concurrent requests, scope, atomicity, and browser retries.

---

## Other decisions

### Stack and setup

- NestJS provides feature modules, validation, guards, and Swagger. Drizzle keeps queries close to SQL with typed schemas; custom migrations handle PostgreSQL-specific constraints.
- PostgreSQL 18 supplies native UUID v7 IDs. Redis/BullMQ handles reminder scheduling.
- Plain npm workspaces: `backend/` and `frontend/`. Generate frontend API types from OpenAPI instead of sharing backend classes.
- Compose runs frontend, API, PostgreSQL, Redis, and a one-shot migration service. Database/cache health checks precede startup; successful migrations gate API startup.
- The frontend uses a multi-stage Docker build and a non-root static Node server with deep-link fallback. The browser API URL is configured at build time.
- Docker rebuilds preserve named volumes. A fresh start explicitly removes volumes; seeding is optional and separate from migrations.
- Local development runs watched API/frontend servers with either Compose infrastructure or locally installed PostgreSQL/Redis.

### Users and sign-up

- One member/professional role and one unique, lowercased email per account; no admin role.
- Shared identity stays in `users`; professional title, bio, specialisations, and languages stay in `professional_profiles`.
- Specialisations/languages are JSONB arrays validated against fixed codes. Separate lookup/join tables are unnecessary at this scope.
- Lists cover anxiety, depression, stress/burnout, relationships, grief, career coaching; English, Malay, Mandarin, Tamil, Cantonese, and Indonesian.
- No member age or health-history fields are collected. Professional “Based in” follows the saved zone's city; it is not a separate address field.
- Seed 15 fictional professionals with varied profiles, zones, workdays, quarter-hour starts, split ranges, and breaks. Deterministic seeding preserves existing accounts/hours.

### Availability

- Saving hours replaces the complete week atomically. Same-day overlap constraints remain authoritative.
- Start hour and minute have separate selects. Durations use `1h`, `2h`, etc. on mobile and full labels on desktop.
- Selects exclude values that would cross midnight; ending exactly at midnight is valid. Overlaps remain selectable and require explicit user correction.
- Blocked dates are whole professional-local days with optional private reasons. Bulk selection excludes already-blocked days and safely supports an empty selection.
- Calendar months sit side by side when space permits, otherwise stack; mobile shows one month. Selecting either month preserves the displayed month pair.
- Week view shades blocked days while keeping existing bookings visible. Availability changes refresh related schedule caches.

### Privacy and listing

- Booking views expose participant names and necessary scheduling details, not participant emails. Member calendars do not reveal who occupies unavailable slots.
- Professionals without working hours remain listed with “No availability”.
- Directory filters: name, specialisation, language, and free date in the member's zone; filters/page state persist in the URL.

### Data model

| Table                     | Holds                                                                    |
| ------------------------- | ------------------------------------------------------------------------ |
| `users`                   | Identity, email, password hash, role, zone                               |
| `professional_profiles`   | Professional title, bio, JSONB specialisations/languages                 |
| `user_sessions`           | Token hash, user, activity and expiry                                    |
| `working_hours`           | Professional, weekday, start minute, whole-hour length                   |
| `blocked_dates`           | Professional, local date, private reason                                 |
| `booking_sessions`        | Participants, UTC start/end, status, cancellation audit, reschedule link |
| `reminders`               | Session, recipient, due time, type and delivery status                   |
| `notifications`           | Recipient, type, session/data, read time                                 |
| `idempotency_keys`        | User-scoped request claim/fingerprint and stored response                |
| `signup_idempotency_keys` | Global key hash, password-safe request fingerprint, response, expiry     |

UUID v7 IDs are time-ordered identifiers, not secrets or access controls. Tables have created/updated timestamps; bookings, hours, and blocked dates also record actors. Drizzle updates `updated_at` on ORM writes; direct SQL must maintain it. Booking history uses statuses rather than deleting sessions.

### API conventions

- REST, plural/kebab-case paths, camelCase JSON, controller-level versions under `/api/v1`.
- Request and response DTOs; explicit controller return types; Swagger references response classes, including problem-detail errors. A 204 has no body.
- RFC 9457-style errors include a machine-readable code. Reject unknown request fields.
- Page-based professionals/sessions; cursor-based notifications. UTC ISO timestamps; local clock fields for working hours.
- Notifications store data for client-side formatting. Booking creates one professional notification in the booking transaction; retries do not duplicate it. Changes and reminders also create in-app notifications.

### Code structure and operations

- One schema file per table and one module per feature. Pure scheduling rules are separated for testing.
- Drizzle's snake_case mapping converts camelCase field names to database identifiers; it does not change API JSON.
- Readable formatting: 80-column target, blank lines between methods/DTO fields, Prettier and ESLint. Keep unrelated changes in separate Conventional Commits.
- Vitest runs backend/frontend tests; Testcontainers supplies real PostgreSQL/Redis. Playwright covers desktop/mobile flows with an isolated API/database.
- Nuxt unit tests disable the build manifest they do not need. SVG tests assert accessible labeling instead of old text-logo content.
- Test fixtures mock background requests explicitly. A forced background-401 test protects explicit logout from redirect races.
- Environment examples and README document Docker/local setup, rebuilds, migrations, seeding, reset, and tests. The API health endpoint is liveness only; Compose separately checks PostgreSQL/Redis.

### Frontend and visual design

- Nuxt SPA with Nuxt UI; role-specific layouts and route guards. Follow supplied desktop/mobile screens while retaining real API state and error handling.
- Default to light mode, ignore system preference, and save the user's choice. Icon toggle sits beside the professional logo on desktop and beside the bell on mobile.
- SVG wordmark: `#00BFA2` in light mode, white in dark mode. The final two “l” shapes form the favicon; its color follows browser light/dark mode.
- Green participant avatars. Profile preview shows bio above specialisations and updates live; its size was reduced slightly after review.
- Notifications use grouped clickable rows, a pointer cursor, distinct icons, unread dots/backgrounds, mark-all-read, and load-more. Theme variables keep unread rows dark in dark mode.
- Poll notifications every 30 seconds only while appropriate for visibility/focus/activity; pause after one minute of human inactivity. No WebSocket/SSE dependency.
- Booking/reschedule confirmations explain notice and cancellation rules. Conflicts preserve the original booking and offer refreshed choices.
- My sessions uses readable compact cards, upcoming/past tabs, optional history, deadline warnings, actor labels, replacement links, and mobile pagination.
- Professional sign-up fields must not stretch the left hero. Desktop hero stays viewport-height; reserved scrollbar space prevents horizontal shifts.

### Security defaults

- Argon2id passwords, 15–128 characters, no composition rules; no breached-password lookup yet.
- Login limit: five requests/minute per IP; sign-up: three/minute per IP. Current rate-limit storage is in memory.
- Cookie/origin controls, token hashing, ownership/role guards, strict DTO validation, and database constraints provide layered protection.
- Dependency work prioritises eliminating high/critical findings; audit again as dependencies change. Node 26 is used locally and in Docker.
- Structured request/audit logging and comprehensive log redaction are production follow-up, not claims about the current implementation.

---

## Assumptions

- Four weeks includes the end of day 28 in the member's zone; exactly 24 hours is eligible for member changes.
- Reschedules retain the professional and may move inside 24 hours if two-hour booking notice is met.
- Weekly hours recur until replaced. Exceptions remove whole days; one-off extra hours are not supported.
- Hours/time-zone/blocked-date edits do not silently cancel bookings.
- Late reminders are useful only before a session starts.
- Both roles can self-register; this exercise does not verify professional credentials.

## Known limitations

- Availability date filtering generates slots and pages a shortlist in memory; it is not a large-scale search index.
- In-app polling only: no push, email, SMS, video sessions, or native mobile app.
- Server request-idle expiry and browser human-idle tracking are separate; a different API client does not inherit browser idle behavior.
- Rate limits are per-process; reminder processing shares the API process. Background work needs independent capacity at larger scale.
- Fixed taxonomy lists; no credential verification, admin tools, breached-password check, or full audit/retention system.
- Liveness does not prove database/Redis readiness. Compose credentials/settings target local development; no deployed demo is documented.
- Favicon theme follows browser preference, independently of the saved in-app theme. Static frontend API configuration requires rebuilding.

## Next with more time

- Let professionals view a member's full session history, with explicit consent and access rules for sessions involving other professionals.
- Add post-session feedback, issue reporting, and ratings, with moderation and privacy controls.
- Provide a guided flow to switch professionals while preserving booking history and explaining cancellation rules.
- Add push notifications alongside the existing in-app notifications.
- Availability search index/cache while retaining database overlap protection.
- Separate workers, shared rate-limit storage, dependency monitoring, structured/redacted logs, and readiness checks.
- Credential verification, breached-password checks, and stronger administrative/account-recovery flows.

## Production for a healthcare product

Before using real personal data: review applicable privacy obligations and professional onboarding; add TLS across services, managed secrets, encrypted storage/backups, restore drills, access/audit logging, retention/deletion policies, monitoring, incident response, and stronger authentication/account recovery. Review data access and notification content for the intended deployment. These are follow-up requirements, not implemented compliance guarantees.
