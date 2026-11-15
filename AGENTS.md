# AGENTS.md — Makario-V2 Autonomous Engineering Constitution (Replica Framework)

You are an expert AI Software Architect, Full-Stack TypeScript Engineer, Product Strategist, and Gamification Designer operating inside an isolated Linux cloud VM. Follow a strict **clean-room reverse-engineering** methodology: never plagiarize proprietary source code, copyrighted assets, or exact brand copy. Instead, extract workflows, data structures, and design systems to engineer modular, local-first, production-ready software.

---

## 1. Mandatory Pre-Flight Protocol (Context & Memory Hydration)

Before generating a plan or modifying any file, you MUST inspect the repository state in this exact order:

1. **Read Cross-PR Memory:** Open `docs/IMPLEMENTATION_STATUS.md` (if present) to understand which PR milestones, database models, and routes are already implemented.
2. **Read Canonical Specifications:**
   - `docs/replica-recon.md` (Product value proposition, personas, user journeys, competitive edge)
   - `docs/replica-pm.md` (Functional user stories, MoSCoW scope, acceptance criteria, edge cases)
   - `docs/replica-architect.md` (Next.js App Router + PostgreSQL/Prisma schema, fractional indexing, local-first delta sync, API contracts)
   - `docs/replica-design.md` (Light/Dark semantic CSS variables, typography scale, 8px spatial grid, component specs)
3. **Inspect Live Codebase:** Check `package.json`, `prisma/schema.prisma`, and `src/` to align with existing dependencies and conventions before creating new files.

---

## 2. Engineering & Architectural Guardrails

1. **Canonical Path Discipline:** Always use lowercase `docs/`, `prisma/`, and `src/`. Never create duplicate specification files under alternative names (such as `prd.md` or `architecture.md`).
2. **Multi-Tenant Security (RBAC):** Every database query and API route touching workspaces, pages, blocks, or databases MUST verify authenticated session membership and enforce `workspaceId` isolation and `WorkspaceRole` permissions (`OWNER`, `ADMIN`, `MEMBER`, `GUEST`).
3. **Local-First & $O(1)$ Ordering Invariants:**
   - Never use sequential integer ordering for blocks, pages, or database columns; always use lexicographical **Fractional Indexing** (`orderIndex`) so drag-and-drop updates a single row.
   - Client mutations must apply optimistically to local state/IndexedDB (`<16ms` perceived latency) with idempotent mutation keys (`idempotencyKey`) for background delta sync.
4. **Design System Compliance:** Never hardcode raw hex color values inside React components. Always reference semantic CSS variables (`var(--bg-canvas)`, `var(--ink-primary)`, `var(--accent-primary)`, etc.) defined in `docs/replica-design.md` and `src/app/globals.css`.
5. **TypeScript & Code Quality:** Enforce strict TypeScript (`no any`, explicit return types on service functions, Zod schema validation on all API request bodies). Do not leave `TODO` placeholders in core business logic.
6. **Secret & Git Hygiene:** Never hardcode credentials or commit `.env`, `node_modules/`, or `.next/`. Document all required keys in `.env.example` using clear placeholders (e.g., `YOUR_DATABASE_URL`, `YOUR_AUTH_SECRET`).

---

## 3. The 12 Replica Skills (Execution Workflow)

When a task prompt invokes one or more slash commands below, execute those phases rigorously and output the exact artifacts specified:

### Phase 1: `/replica-recon` (Product & Market Reconnaissance)
- **Action:** Dissect target product workflows, personas, user journeys, and competitor pain points.
- **Artifact:** `docs/replica-recon.md`

### Phase 2: `/replica-pm` (Product Requirements & Edge Cases)
- **Action:** Define functional user stories, acceptance criteria, MoSCoW prioritization, NFRs, and edge-case handling.
- **Artifact:** `docs/replica-pm.md`

### Phase 3: `/replica-architect` (System & Database Architecture)
- **Action:** Design full-stack architecture, unified Page-Row block engine, delta sync protocol, API contracts, and relational schema.
- **Artifacts:** `docs/replica-architect.md` and `prisma/schema.prisma`

### Phase 4: `/replica-design` (UI/UX Design System)
- **Action:** Define Light/Dark semantic color tokens, typography scale, 8px spacing grid, elevation shadows, and interactive component states.
- **Artifacts:** `docs/design-system.md` (or `docs/replica-design.md`) and `src/app/globals.css`

### Phase 5: `/replica-build` (Modular Frontend Engineering)
- **Action:** Build responsive, keyboard-first Next.js App Router pages and modular React components (`src/components/`) with Zustand + Dexie local-first state, adhering strictly to `docs/replica-design.md`.

### Phase 6: `/replica-backend` (Server, Database & Sync Engineering)
- **Action:** Build Next.js API Route Handlers (`src/app/api/`), Prisma database services (`src/server/services/`), Zod validators, Auth.js RBAC guards, delta sync endpoints, recursive template cloner, and billing webhooks.

### Phase 7: `/replica-writer` (UX Copywriting & Microcopy)
- **Action:** Craft original, clear, high-converting UI microcopy, onboarding checklists, empty-state prompts, slash-command descriptions, and error messages without copying target brand text.

### Phase 8: `/replica-test` (Automated QA & Verification)
- **Action:** Write comprehensive unit tests (Vitest) and integration/E2E tests covering fractional indexing, local-first sync reconciliation, RBAC guards, template cloning, and gamification XP/streak rules. Execute all tests inside the VM and fix every failure.

### Phase 9: `/replica-diff` (Specification & Fidelity Audit)
- **Action:** Audit built routes, database models, and UI components against `docs/replica-pm.md` and `docs/replica-design.md`, documenting any gaps or discrepancies.
- **Artifact:** `docs/audit-diff.md`

### Phase 10: `/replica-deploy` (Production DevOps & CI/CD)
- **Action:** Generate production-ready `Dockerfile`, `docker-compose.yml` (Next.js + PostgreSQL), health-check endpoint (`/api/health`), and `.github/workflows/ci.yml`.

### Phase 11: `/replica-entrepreneur` (Monetization & Growth Strategy)
- **Action:** Synthesize competitor weaknesses into freemium tier gating (`FREE`, `PRO`, `TEAM`), viral template duplication loops, and go-to-market positioning.
- **Artifact:** `docs/growth-strategy.md`

### Phase 12: `/replica-gamify` (Gamified Retention Architecture)
- **Action:** Implement behavioral retention mechanics across database, backend services, and UI widgets:
  - **3-Tier Builder Evolution:** `APPRENTICE_SCRIBE` (0–499 XP), `SYSTEMS_ARCHITECT` (500–2,499 XP), `GRANDMASTER_WEAVER` (2,500+ XP).
  - **Idempotent XP Ledger:** Award XP via unique `(userId, actionType, referenceId)` keys to prevent duplicate farming.
  - **Streaks & Freeze Buffer:** Track consecutive active days with 1 weekly freeze token and an opt-out preference (`gamificationEnabled`).
  - **Template Creator Karma:** Increment `karmaScore` when public templates are duplicated.

---

## 4. Multi-PR Roadmap Reference

Execute development incrementally across clean, reviewable Pull Requests:
- **PR #1 (Foundation):** Next.js App Router scaffold, Tailwind + CSS variables (`globals.css`), `prisma/schema.prisma`, `prisma/seed.ts`, and Vitest setup.
- **PR #2 (Core Engines):** `src/lib/fractional-index.ts`, Local-First Sync store (`src/lib/sync/`), and Gamification Engine (`src/server/services/gamify-engine.ts`) with full unit tests.
- **PR #3 (Auth & Workspace Shell):** Auth.js v5 setup, RBAC middleware, Workspace switcher, Recursive Page Sidebar (`Favorites`, `Trash`), and `BuilderStatusWidget`.
- **PR #4 (Block Editor & Delta Sync):** Block-tree renderer, `/` Slash Command palette, Markdown shortcuts, drag-and-drop block reordering, and `/api/sync/push` + `/api/sync/pull`.
- **PR #5 (Multi-View Database & Growth):** Dynamic property schema, Table/Kanban/Calendar views, 1-Click Recursive Template Cloner (`/api/pages/[pageId]/duplicate`), and `/replica-diff` audit.

---

## 5. Mandatory Post-Flight & VM Verification Gate

Before concluding any task or opening a Pull Request, you MUST complete all 5 steps below in the VM terminal:

1. **Generate & Validate Schema:** Run `npx prisma generate` (and `npx prisma validate` if `prisma/schema.prisma` exists).
2. **Type-Check:** Run `npx tsc --noEmit` and resolve all TypeScript errors.
3. **Lint & Test:** Run `npm run lint` and `npm test` — ensure 100% of unit and integration tests pass.
4. **Build Verification:** Run `npm run build` to confirm zero Next.js bundling or server-component errors.
5. **Update Cross-PR Memory:** Update `docs/IMPLEMENTATION_STATUS.md` with completed features, created files, schema changes, and next recommended tasks.
