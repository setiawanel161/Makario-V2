# Implementation Status & Cross-PR Engineering Memory (`Makario-V2`)

> **Mandatory Protocol for Jules (Autonomous Agent):**
> 1. **Pre-Flight:** Read this entire file before generating a plan or writing code to understand what is already built and avoid duplicating or overwriting completed modules.
> 2. **Post-Flight:** Before opening a Pull Request, update the checkboxes, Schema/API registry status, and append a new entry to the **Pull Request Execution Log** at the bottom of this file.

---

## 1. Current Status & Active Target

- **Current Phase:** Pre-Code Foundation (All Phase 1–4 Specifications Finalized)
- **Active Target:** **PR #1 — Project Scaffold, Design Tokens, Prisma Schema & Seed**
- **Tech Stack:** Next.js 15 (App Router), TypeScript (Strict), Tailwind CSS, PostgreSQL 16, Prisma ORM, Zustand + Dexie.js (IndexedDB), Auth.js v5, Vitest

---

## 2. Completed Specifications & Repository Setup

- [x] `AGENTS.md` — 12-skill Replica Framework rules, architectural guardrails, and VM verification gate
- [x] `.env.example` — Environment variable placeholders (`DATABASE_URL`, `AUTH_SECRET`, OAuth, Stripe/Midtrans)
- [x] `docs/replica-recon.md` — Phase 1 product reconnaissance, personas, user journeys, and local-first competitive edge
- [x] `docs/replica-pm.md` — Phase 2 PRD, user stories (`US-1.1` to `US-6.3`), MoSCoW prioritization, NFRs, and edge cases
- [x] `docs/replica-architect.md` — Phase 3 system architecture, Unified Page-Row model, Fractional Indexing, Delta Sync, and complete Prisma schema
- [x] `docs/replica-design.md` — Phase 4 Light/Dark semantic CSS variables, typography scale, 8px spatial grid, and component specifications

---

## 3. Multi-PR Implementation Roadmap

### PR #1: Foundation & Database Scaffolding (`NEXT`)
- [ ] Initialize Next.js 15 App Router project with TypeScript (`strict: true`) and Tailwind CSS in repository root
- [ ] Configure `src/app/globals.css` with all Light/Dark semantic CSS tokens from `docs/replica-design.md`
- [ ] Create `prisma/schema.prisma` matching the exact schema in `docs/replica-architect.md`
- [ ] Create `prisma/seed.ts` with Smart Workflow Presets (`Personal`, `Team`, `School`) and initial `AchievementBadge` records
- [ ] Configure Vitest (`vitest.config.ts`) and verify `npx prisma generate`, `npx tsc --noEmit`, `npm test`, and `npm run build`

### PR #2: Core Engines (Fractional Indexing, Local-First Sync & Gamification)
- [ ] Implement `src/lib/fractional-index.ts` (lexicographical midpoint key generator + sibling normalizer when key length > 32)
- [ ] Implement `src/lib/sync/` (Dexie IndexedDB schema, optimistic mutation outbox queue, field-level LWW reconciler)
- [ ] Implement `src/server/services/gamify-engine.ts` (idempotent XP awards via `XpLedger`, 3-tier `BuilderTier` evolution, daily streak + weekly freeze token logic)
- [ ] Write and pass comprehensive unit tests in `tests/` for fractional indexing, sync queue, and gamification rules

### PR #3: Authentication, Workspace RBAC & Recursive Page Sidebar
- [ ] Configure Auth.js v5 (`src/server/auth/`) with Google/GitHub OAuth and session callbacks
- [ ] Implement tenant isolation & RBAC permission guards (`OWNER`, `ADMIN`, `MEMBER`, `GUEST`)
- [ ] Implement `GET /api/workspaces`, `POST /api/workspaces` (with Smart Workflow Preset injection), and `GET /api/workspaces/[id]/pages/tree`
- [ ] Build Workspace Shell (`src/app/(workspace)/[slug]/`), Recursive Page Tree Sidebar (`Favorites`, `Private`, `Shared`, `Trash`), and `BuilderStatusWidget`

### PR #4: Block-Based Rich Editor & Real-Time Delta Sync
- [ ] Implement `GET /api/pages/[pageId]`, `POST /api/sync/push`, `GET /api/sync/pull`, and `GET /api/sync/stream` (SSE)
- [ ] Build `BlockRenderer` with `44px` hover gutter (`+` and `⋮⋮`), multi-block selection, and `@dnd-kit` fractional reordering
- [ ] Build `SlashCommandMenu` (`/`) and Markdown prefix shortcuts (`#`, `-`, `[]`, `>`, ```` ``` ````)
- [ ] Implement `Cmd/Ctrl + K` Quick Search modal (`GET /api/workspaces/[id]/search`) and `XpToastNotification`

### PR #5: Multi-View Relational Database, Template Cloner & Fidelity Audit
- [ ] Implement dynamic `DatabaseProperty` schema editor (`TEXT`, `NUMBER`, `SELECT`, `MULTI_SELECT`, `STATUS`, `DATE`, `PERSON`, `CHECKBOX`, `URL`, `RELATION`, `ROLLUP`, `FORMULA`)
- [ ] Build Multi-View Database layouts (`TableView`, `KanbanBoardView`, `CalendarView`) with per-view filters, sorts, and grouping
- [ ] Implement 1-Click Recursive Template Cloner (`POST /api/pages/[pageId]/duplicate`) with UUID remapping, graceful broken-relation fallback, and Creator Karma increment
- [ ] Build public web renderer (`src/app/p/[publicSlug]/`) and execute `/replica-diff` to generate `docs/audit-diff.md`

---

## 4. Database Schema & API Contract Registry

### Prisma Models (`prisma/schema.prisma`)
| Model Group | Models | Status |
| :--- | :--- | :--- |
| **Auth & Multi-Tenancy** | `User`, `Account`, `Session`, `Workspace`, `WorkspaceMember` | `Pending (PR #1)` |
| **Pages & Block-Tree** | `Page`, `Block`, `Comment` | `Pending (PR #1)` |
| **Relational Database** | `DatabaseProperty`, `DatabaseRowProperty`, `DatabaseView` | `Pending (PR #1)` |
| **Gamification Engine** | `BuilderProfile`, `XpLedger`, `AchievementBadge`, `UserBadge` | `Pending (PR #1)` |

### API Route Handlers (`src/app/api/`)
| Endpoint | Purpose | Status |
| :--- | :--- | :--- |
| `GET/POST /api/workspaces` | List & provision workspaces with Smart Workflow Presets | `Pending (PR #3)` |
| `GET /api/workspaces/[id]/pages/tree` | Lightweight recursive sidebar tree | `Pending (PR #3)` |
| `GET /api/pages/[pageId]` | Full page blocks + database schema/views/rows | `Pending (PR #4)` |
| `POST /api/sync/push` & `GET /api/sync/pull` | Batched optimistic delta sync & LWW reconciliation | `Pending (PR #4)` |
| `GET /api/sync/stream` | Server-Sent Events (SSE) live workspace updates | `Pending (PR #4)` |
| `GET /api/workspaces/[id]/search` | Full-text search for `Cmd/Ctrl + K` modal | `Pending (PR #4)` |
| `POST /api/pages/[pageId]/duplicate` | 1-Click recursive template cloner + Karma award | `Pending (PR #5)` |
| `GET /api/public/[slug]` | Unauthenticated read-only published web page | `Pending (PR #5)` |
| `GET/PATCH /api/gamification/profile` | Builder XP, tier, streak & minimalist mode toggle | `Pending (PR #3)` |
| `POST /api/webhooks/billing` | Stripe/Midtrans subscription tier synchronization | `Pending (PR #5)` |

---

## 5. Critical Invariants & Technical Notes

1. **Directory Case Sensitivity:** Always reference `docs/` in lowercase (never `Docs/`) so Linux VM scripts resolve paths reliably.
2. **Unified Page-Row Model:** A database is a `Page` with `isDatabase = true`; each database row is also a `Page` (`parentPageId = databasePage.id`) with typed values in `DatabaseRowProperty`.
3. **Styling Rule:** Never hardcode hex color codes in components; always consume semantic CSS variables (`--bg-canvas`, `--bg-sidebar`, `--ink-primary`, `--accent-primary`, etc.) from `src/app/globals.css`.
4. **Idempotency:** Both `/api/sync/push` mutations and `XpLedger` entries require unique idempotency keys to prevent duplicate records on offline retry.

---

## 6. Pull Request Execution Log

| PR # | Date | Branch / Scope | Key Files Created or Modified | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| `PR #0` | `2026-11-15` | `main` (Specs & Rules) | `AGENTS.md`, `.env.example`, `docs/replica-*.md`, `docs/IMPLEMENTATION_STATUS.md` | `Docs Verified` |
