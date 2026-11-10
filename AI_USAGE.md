# AI Usage

I used AI throughout this project: Claude for planning and design, and Codex for implementation, testing, and iteration. AI generated substantial code and documentation. My role was to choose the direction, review trade-offs, test the app, and request corrections. [DECISIONS.md](DECISIONS.md) records the resulting choices and limitations.

## Tools and what they did

| Tool                        | Used for                                                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Claude** (chat and voice) | Exploring decisions through questions, options, and trade-offs; prototyping screens in Figma/design canvas; outlining backend/frontend plans; drafting documentation.                                                                      |
| **Codex**                   | Implementing the agreed plans; database schemas and migrations; API/Swagger DTOs and generated frontend types; responsive UI; tests and debugging; dependency updates; Docker/migration setup; deployment configuration and documentation. |

The Claude examples below reflect my planning/design work. The Codex examples reflect implementation and review in this repository. Generated output was revised as requirements became clearer.

## Where I corrected, rejected or improved the AI's output

**1. Overnight working hours.** Early planning explored converting hours when a professional changed time zone, including splitting ranges across midnight. I later chose a simpler final rule: changing time zone requires a complete replacement week or explicit removal of availability. Ranges cannot cross midnight; existing bookings keep their UTC times. I also asked for separate hour/minute selects, exclusion of values that cross midnight, and explicit user correction of overlaps.

**2. A colour that wasn't there.** Claude initially included magenta in ThoughtFull's palette. I could not find it on the website and challenged it. It identified the colour as belonging to non-visible elements, and we removed it. For implementation, I supplied the SVG logo and specified `#00BFA2` in light mode, white in dark mode, and the final two “l” shapes as the favicon.

**3. My sessions tabs.** The initial design mixed Upcoming, Past, and Cancelled tabs. I separated time from status: Upcoming/Past tabs plus a “Show cancelled” switch. I then refined text sizes, unclipped labels, mobile active-tab highlighting, cancellation actor names, and links between original and replacement sessions.

**4. Fixes that weren't fixed.** I checked rendered screens instead of relying on completion messages. During design review, I caught collapsed fields, overlapping frames, and incorrect notification colours. During implementation, I supplied screenshots showing mobile control overlap, cramped empty states, shifting signup panels, and unread notifications that stayed light in dark mode. Codex revised the implementation and added targeted checks where appropriate.

**5. Picking the auth approach.** I initially favoured JWT access tokens with a refresh cookie. After questioning inconsistent explanations and reviewing revocation and complexity, I chose opaque server-side sessions: cookies for the browser and Bearer support for Swagger/non-cookie clients. This supports immediate revocation without a refresh-token flow; a native mobile client was not built.

**6. Backend structure and maintainability.** I requested one schema file per table, a separate `professional_profiles` table, JSON columns for specialisations/languages, controller-level API versions, response DTOs in Swagger, and readable formatting with spacing between methods and DTO fields. I asked for idempotent sign-up and separate commits for unrelated changes.

**7. Reproducing an intermittent failure.** A full browser run passed, but I later provided a mobile logout failure: a background 401 could redirect to `/login?redirect=...` during explicit logout. Codex added a logout guard and a regression test that forces the overlapping requests. A passing rerun alone had not established that the race was fixed.

**8. Reproducible setup.** I asked for frontend and migrations in Compose, separate Docker/local setup guides, and clear rebuild/reset instructions. Codex verified startup, migration reruns, frontend routes, and API health using an isolated database. Rebuilds preserve data; deleting volumes is an explicit fresh-start action.

## Validation and limits

- Automated checks include lint/formatting, TypeScript checks, backend/frontend builds, Vitest unit/integration tests, and Playwright desktop/mobile flows. Database tests use real PostgreSQL/Redis through Testcontainers.
- The latest complete test run before these documentation changes passed 52 unit/integration tests and 50 browser tests. These results describe that run, not a guarantee against intermittent or untested failures.
- I used the app and screenshots to review behaviour and presentation, then asked for specific changes. Automated checks complement that review; they do not establish production readiness, security certification, or healthcare compliance.
- Future features and production gaps are documented separately in `DECISIONS.md`; they are not presented as implemented work.
