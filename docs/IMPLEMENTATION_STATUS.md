# Makario-V2 Foundation & Cross-PR Engineering Memory

> **Mandatory Protocol for autonomous agents:** Read this file before implementation. After each PR, update completed work, schema/API registry status, and the execution log.

---

## 1. Current Status & Active Target

- **Current Phase:** PR #4 Block-Based Rich Editor & Real-Time Delta Sync implemented and verified.
- **Active Target:** **PR #5 — Multi-View Relational Database, Template Cloner & Fidelity Audit**
- **Tech Stack:** Next.js 15 (App Router), TypeScript (Strict), Tailwind CSS, PostgreSQL 16, Prisma ORM, Auth.js v5, Zustand + Dexie.js (IndexedDB), Vitest.

---

## 2. Completed Specifications & Repository Setup

- [x] `AGENTS.md` — 12-skill Replica Framework rules, architectural guardrails, and VM verification gate
- [x] `.env.example` — Environment variable placeholders (`DATABASE_URL`, `AUTH_SECRET`, OAuth, Stripe/Midtrans)
- [x] `docs/replica-recon.md` — Phase 1 product reconnaissance, personas, user journeys, and local-first competitive edge
- [x] `docs/replica-pm.md` — Phase 2 PRD, user stories (`US-1.1` to `US-6.3`), MoSCoW prioritization, NFRs, and edge cases
- [x] `docs/replica-architect.md` — Phase 3 architecture and complete Prisma schema
- [x] `docs/replica-design.md` — Phase 4 semantic colors, typography, spacing, and component specifications

---

## 3. Multi-PR Implementation Roadmap

### PR #1: Foundation & Database Scaffolding (implemented and verified)
- [x] Next.js 15 App Router scaffold with TypeScript strict mode, Tailwind, ESLint, `src/`, and `@/*` alias
- [x] `src/app/globals.css` includes light/dark semantic, property-pill, tier, typography, spacing, and elevation tokens
- [x] Existing `prisma/schema.prisma` preserved without schema changes
- [x] `prisma/seed.ts` includes Personal, Team, and School workflow preset definitions and idempotent initial achievement badges
- [x] Vitest setup and sanity test
- [x] Prisma validation/generation, TypeScript, tests, lint, and production build passed in the VM

### PR #2: Core Engines (implemented and verified)
- [x] Add strict workspace payload and DTO contracts with decimal-string revision serialization
- [x] Implement base-62 fractional indexing and sibling normalization when generated keys exceed 32 characters
- [x] Implement Dexie IndexedDB stores, idempotent outbox, 300ms batched sync, online retry, and field-level LWW
- [x] Implement synchronous optimistic Zustand updates and Prisma-backed idempotent XP, tier, streak/freeze, and creator-karma services
- [x] Add Vitest suites for fractional indexing, local-first sync, and gamification (20 tests passing)
- [x] Run Prisma validation/generation, TypeScript, ESLint, Vitest, and production build

### PR #3: Authentication, Workspace RBAC & Recursive Page Sidebar
- [x] Configure Auth.js v5 with conditional Google/GitHub OAuth, guarded demo credentials, session callbacks, and tenant-isolation permission guards
- [x] Implement health, workspace provisioning, page creation/tree, and gamification profile API routes
- [x] Provision Personal/Team/School starter pages and databases with owner membership and idempotent +50 XP
- [x] Build login/onboarding, authenticated workspace shell, recursive page sidebar, trash popover, and `BuilderStatusWidget`
- [x] Add RBAC and workspace provisioning tests; Prisma, TypeScript, ESLint, all 25 Vitest tests, and production build passed

### PR #4: Block-Based Rich Editor & Real-Time Delta Sync
- [x] Add revision metadata and idempotent mutation receipts; implement page, push/pull, SSE, search, and publication routes with tenant/private-page filters and BigInt string serialization
- [x] Implement serializable LWW batch sync, FREE block quota, idempotent TODO XP, and Dexie pull reconciliation
- [x] Build the block editor for every `BlockType`, keyboard/Markdown/slash commands, fractional-key drag reorder, page controls, and web publishing
- [x] Add workspace quick search, SSE delta client, and opt-out-aware XP toast
- [x] Add sync/API, optimistic store, delta reconciliation, and editor-ordering tests
- [x] Pass Prisma validation/generation, strict TypeScript, ESLint, all 36 Vitest tests, and production build

### PR #5: Multi-View Relational Database, Template Cloner & Fidelity Audit
- [x] Implement property/view CRUD for all property types; connect editable Table, Kanban, and Calendar views to optimistic page/row-property sync
- [x] Implement four-pass transactional template cloning with UUID remapping, external relation degradation, clone count, and creator karma
- [x] Add public page API/view, SEO page, template duplication CTA, and signature-verified Stripe/Midtrans billing webhook
- [x] Add multi-stage Docker image and Postgres 16 Compose deployment with health check and migration deployment
- [x] Add database-view, template-cloner, public-isolation, and billing webhook tests; execute the PM/design fidelity audit in `docs/audit-diff.md`
- [x] Pass Prisma validation/generation, strict TypeScript, ESLint, all 44 Vitest tests, production build, Docker Compose validation, and app/migration image builds

---

## 4. Database Schema & API Contract Registry

### Prisma Models (`prisma/schema.prisma`)
| Model Group | Models | Status |
| :--- | :--- | :--- |
| **Auth & Multi-Tenancy** | `User`, `Account`, `Session`, `Workspace`, `WorkspaceMember` | `Defined (PR #1)` |
| **Pages & Block-Tree** | `Page`, `Block`, `Comment` | `Defined (PR #1)` |
| **Relational Database** | `DatabaseProperty`, `DatabaseRowProperty`, `DatabaseView` | `Defined (PR #1)` |
| **Gamification Engine** | `BuilderProfile`, `XpLedger`, `AchievementBadge`, `UserBadge` | `Defined (PR #1)` |
| **Sync Infrastructure** | `SyncMutationReceipt` and per-entity revisions/field clocks | `Implemented (PR #4; full initial baseline migration)` |

### API Route Handlers (`src/app/api/`)
| Endpoint | Purpose | Status |
| :--- | :--- | :--- |
| `GET/POST /api/workspaces` | List & provision workspaces with Smart Workflow Presets | `Implemented (PR #3)` |
| `GET /api/workspaces/[id]/pages/tree` | Lightweight recursive sidebar tree | `Implemented (PR #3)` |
| `POST /api/workspaces/[id]/pages` | Create a root or child page in the active workspace | `Implemented (PR #3)` |
| `GET /api/health` | Check application handler and PostgreSQL connectivity | `Implemented (PR #3)` |
| `GET /api/pages/[pageId]` | Full page blocks + database schema/views/rows | `Implemented (PR #4)` |
| `POST/PATCH/DELETE /api/pages/[pageId]/properties` | Manage typed database properties and their configuration | `Implemented (PR #5)` |
| `POST/PATCH/DELETE /api/pages/[pageId]/views` | Manage persisted database layouts, filters, sorts, and grouping | `Implemented (PR #5)` |
| `POST /api/pages/[pageId]/duplicate` | Recursive template cloner + Karma award | `Implemented (PR #5)` |
| `GET /api/public/[slug]` | Unauthenticated published read-only page | `Implemented (PR #5)` |
| `POST /api/webhooks/billing` | Signature-verified Stripe/Midtrans plan synchronization | `Implemented (PR #5)` |
| `POST /api/sync/push` & `GET /api/sync/pull` | Batched optimistic delta sync & LWW reconciliation | `Implemented (PR #4)` |
| `GET /api/sync/stream` | Server-Sent Events live workspace updates | `Implemented (PR #4; one-second revision poll)` |
| `GET /api/workspaces/[id]/search` | Full-text search for quick search modal | `Implemented (PR #4)` |
| `POST /api/pages/[pageId]/publish` | Owner/creator-gated public page publishing | `Implemented (PR #4)` |
| `/p/[publicSlug]` | Published, read-only page view with private/deleted content excluded | `Implemented (PR #4)` |
| `GET/PATCH /api/gamification/profile` | Builder XP, tier, streak, and preference API | `Implemented (PR #3)` |

---

## 5. Critical Invariants & Technical Notes

1. **Directory Case Sensitivity:** Always use lowercase `docs/`, `prisma/`, and `src/`.
2. **Unified Page-Row Model:** A database is a `Page` with `isDatabase = true`; each row is also a `Page` with typed values in `DatabaseRowProperty`.
3. **Styling Rule:** Components must consume semantic CSS variables from `src/app/globals.css`, not hardcoded color values.
4. **Idempotency:** Sync mutations and `XpLedger` entries require unique idempotency keys to prevent duplicate records on offline retry.
5. **Preset storage:** The schema has no `WorkspacePreset` model. Presets remain a typed catalog and are injected into newly provisioned workspaces; no preset rows are persisted.
6. **Verification:** PR #1 gates passed on 2026-11-15. The VM had no `.env`, so Prisma validation and generation used the documented local PostgreSQL URL as a command-scoped `DATABASE_URL`; no environment file was created.
7. **Weekly streak freeze:** Freeze usage is recorded as a zero-XP `XpLedger` entry keyed by user and UTC week, providing one use per week without changing the existing Prisma schema.
8. **PR #4 database rollout:** `prisma/migrations/20261115191059_init_full_schema` creates the complete schema from an empty PostgreSQL database, including sync revisions, field clocks, and mutation receipts. `migrate reset --force`, `migrate deploy`, validation, and generation passed against a fresh local `workspace_db`.

---

## 6. Pull Request Execution Log

| PR # | Date | Branch / Scope | Key Files Created or Modified | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| `PR #0` | `2026-11-15` | `main` (Specs & Rules) | `AGENTS.md`, `.env.example`, `docs/replica-*.md`, `docs/IMPLEMENTATION_STATUS.md` | `Docs Verified` |
| `PR #1` | `2026-11-15` | `copilot/pr-1-foundation` (Foundation Scaffold) | Next.js/Tailwind/ESLint/Vitest scaffold, `package.json`/`package-lock.json`, `src/app/`, `src/server/db/prisma.ts`, `prisma/seed.ts`, `tests/sanity.test.ts`, this status file | `Passed: Prisma validate/generate, TypeScript, Vitest, ESLint, production build` |
| `PR #2` | `2026-11-15` | `copilot/pr-2-core-engines` (Core Engines) | `src/types/workspace.ts`, `src/lib/fractional-index.ts`, `src/lib/sync/`, `src/server/services/gamify-engine.ts`, three engine test suites, dependency lockfiles, this status file | `Passed: Prisma validate/generate, TypeScript, 20 Vitest tests, ESLint, production build` |
| `PR #3` | `2026-11-15` | `copilot/pr-3-auth-workspace-shell` (Auth, RBAC & Workspace Shell; based on PR #2) | `src/server/auth/`, workspace provisioning service and preset catalog, health/workspace/page/gamification APIs, login/onboarding/workspace UI, RBAC and provisioning tests, this status file | `Passed: Prisma validate/generate, TypeScript, 25 Vitest tests, ESLint, production build` |
| `PR #4` | `2026-11-15` | `copilot/pr-4-editor-sync` (Block Editor & Delta Sync; based on PR #3, targets main) | Full initial schema baseline migration; page/push/pull/SSE/search/publish routes; block editor, slash menu, search modal, XP toast, delta client; sync and editor tests; this status file | `Passed: Prisma reset/deploy/validate/generate, TypeScript, 36 Vitest tests, ESLint, production build` |
| `PR #5` | `2026-11-15` | `copilot/pr-5-database-template` (Database Views, Template Cloner, Public Web & Deployment; targets main) | Typed property/view APIs and client; database Table/Board/Calendar; transactional template cloner; public API/page and duplicate CTA; Stripe/Midtrans webhook; Docker/Compose; fidelity audit and tests | `Passed: Prisma validate/generate, TypeScript, 44 Vitest tests, ESLint, production build, Docker Compose config and images` |
