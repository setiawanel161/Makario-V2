# PR #6 Production Hardening & Fidelity Audit

## Scope and result

This audit records PR #6 production hardening and closes the remaining database
layout and large-table rendering gaps identified by the PR #5 audit. It compares
the delivered work with the database, publishing, template, billing, and
visual-system requirements in
[`replica-pm.md`](./replica-pm.md) and [`replica-design.md`](./replica-design.md).
The requested PR #6 scope is implemented and verified. Broader product
specification work remains intentionally outside this PR, as listed under Open
gaps.

## Requirements checked

| Area | Implemented behavior | Result |
| :--- | :--- | :--- |
| Typed database schema | Zod-validated create/update/delete endpoints cover all Prisma `PropertyType` values, including relation, rollup, and formula configuration. Property and view changes advance workspace revisions; serialized revisions are decimal strings. | Pass |
| Saved views | Table, Board, and Calendar views persist layouts, filters, sorts, visible properties, and optional grouping. Filter/sort evaluation is deterministic and typed; formulas use a bounded arithmetic parser and rollups calculate supported aggregations client-side. | Pass |
| Unified page-row model | New rows are child `Page` records created optimistically through the idempotent sync outbox; row property updates use `UPSERT_ROW_PROP`. | Pass |
| Kanban and calendar | Kanban groups by Select/Status, and moving a card updates its property value and fractional `orderIndex`. Calendar maps rows to a selected Date property in a monthly grid. | Pass |
| Template duplication | The cloner runs transactionally in four passes (pages, database schema/views, blocks, row values), remaps page/property/block IDs, degrades external relations to Text, advances workspace revision, increments the source clone counter, and awards creator karma for a published clonable template. | Pass |
| Public access | API and SEO page require published, non-private, non-deleted pages. Shared child pages and database rows are restricted to the same workspace and exclude private/deleted records. Comments are never queried or serialized. | Pass |
| Billing | Stripe timestamped HMAC-SHA256 signatures and Midtrans SHA-512 signatures are verified before plan-tier synchronization. Invalid or missing signatures are rejected. | Pass |
| Design system | New React components use semantic light/dark CSS tokens and the existing typography scale. No raw hex color literals were introduced in database/public components. | Pass |
| Deployment | Multi-stage Next.js standalone image and Compose Postgres 16 service include database health checks and migration deployment on app startup. Compose configuration validates. | Pass |
| Timeline and Gallery | Database layout switcher exposes all five layouts. Timeline visualizes rows against a configured Date property; Gallery renders responsive cards with cover/icon and compact properties, using semantic theme tokens. | Pass |
| Large table rendering | Table rows virtualize automatically above 100 rows with overscan; focused tests cover threshold behavior and 5,000 rows. The database query remains bounded at 5,000 rows. | Pass |
| Production hardening | Next.js sends frame, MIME-sniffing, referrer, and permissions security headers. `npm audit fix` retains Next.js 15 and Prisma 6 compatibility; the final dependency audit reports no vulnerabilities. | Pass |
| Browser verification | Playwright Chromium exercises health/security headers, demo sign-in and workspace provisioning, page/block creation, slash-command TODO and XP, reload persistence, all five layouts, publishing, and template cloning. | Pass |

## Open gaps outside the requested PR #6 scope

- Formula support is intentionally limited to arithmetic expressions and
  property references; it is not a general-purpose formula language.
- The database UI does not yet expose inline row comments, chart widgets,
  assignee avatars, or due-date badges described in broader product/design
  requirements.
- The design document labels the property palette as ten colors but lists nine;
  implementation follows the nine named semantic pill token pairs that are
  actually specified.

## Verification

- `npx prisma validate` and `npx prisma generate` — passed
- `npx tsc --noEmit`
- `npm run lint` — passed
- `CI=true npm test` — 46 tests passed across 14 suites
- `npm run build` — passed
- `npm run test:e2e` — Chromium suite passed
- `npm audit` — 0 vulnerabilities
- `docker compose config --quiet`
- `docker compose build app migrate`
