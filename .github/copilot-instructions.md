# GitHub Copilot Custom Instructions — `Makario-V2`

You are an autonomous Principal Full-Stack Engineer and Software Architect working on **`Makario-V2`**—a local-first, block-based connected workspace and relational database platform with built-in productivity gamification.

---

## 1. Mandatory Pre-Flight Protocol (Read Before Acting)

Before generating a plan, running commands, or modifying any code, you MUST inspect the repository's canonical specifications in this order:
1. **`AGENTS.md`** — Master constitution, 12-skill Replica Framework definitions, and engineering guardrails.
2. **`docs/IMPLEMENTATION_STATUS.md`** — Cross-PR memory indicating completed milestones, active database models, and the exact scope of the next PR.
3. **Phase 1–4 Blueprints:**
   - `docs/replica-recon.md` (Product value proposition, personas, user journeys, competitive edge)
   - `docs/replica-pm.md` (Functional user stories `US-1.1`–`US-6.3`, MoSCoW scope, edge cases)
   - `docs/replica-architect.md` (Unified Page-Row model, Fractional Indexing, Local-First Sync, API contracts, `JSONB` TypeScript types)
   - `docs/replica-design.md` (Light/Dark CSS semantic tokens, typography scale, 8px spatial grid, component specs)
4. **`prisma/schema.prisma`** — Single source of truth for PostgreSQL models and enums. Never alter schema field names or relations unless explicitly requested.

---

## 2. Cloud VM Environment Baseline

The repository's `.github/workflows/copilot-setup-steps.yml` pre-configures your VM environment:
- **PostgreSQL 16** is installed and running locally (`postgresql://postgres:postgres@localhost:5432/workspace_db?schema=public`).
- **`.env`** is pre-populated from `.env.example` (never commit `.env` to git).
- **Non-Interactive CLI Execution:** Always pass non-interactive flags when invoking CLI tools (`--yes`, `CI=true`, `npx vitest run` instead of watch mode).

---

## 3. Non-Negotiable Architectural & Code Guardrails

1. **Canonical Path Discipline:** Always use lowercase `docs/`, `prisma/`, `src/`, and `tests/`. Never create duplicate specification files under alternative names.
2. **Next.js 15 App Router Conventions:**
   - Dynamic route `params` and `searchParams` are asynchronous Promises (`{ params }: { params: Promise<{ pageId: string }> }`). Always `await params` in Page Components and Route Handlers.
   - Default to Server Components for initial page shells and SEO public routes (`/p/[publicSlug]`); isolate client-side interactivity (`'use client'`) to editor, database view, sidebar, and sync components.
3. **`BigInt` Serialization Safety:**
   - `Workspace.serverRevision`, `Page.revision`, and `Block.revision` use PostgreSQL `BigInt`. Always serialize `BigInt` values to decimal `string` (e.g., `revision.toString()`) before returning JSON from API Route Handlers or storing in client state.
4. **Unified Page-Row & $O(1)$ Ordering Invariants:**
   - A database is a `Page` with `isDatabase = true`; every database row is a child `Page` (`parentPageId = databasePage.id`) storing typed values in `DatabaseRowProperty`.
   - Never use integer indices for ordering `Page`, `Block`, `DatabaseProperty`, or `DatabaseView`. Always use base-62 lexicographical **Fractional Indexing** (`orderIndex`) so drag-and-drop updates a single database row.
5. **Local-First Optimistic UI & Idempotency:**
   - Client mutations must update Zustand + Dexie (IndexedDB) optimistically (`<16ms`) and queue idempotent mutation packets (`idempotencyKey`) for background batch sync via `/api/sync/push`.
6. **Strict Multi-Tenant RBAC:**
   - Every authenticated API route and server action MUST verify session membership and enforce `workspaceId` tenant isolation and `WorkspaceRole` permissions (`OWNER`, `ADMIN`, `MEMBER`, `GUEST`).
   - Unauthenticated public routes (`/api/public/[slug]`, `/p/[publicSlug]`) must strictly filter `isPublished = true` and `deletedAt = null`, stripping private sub-pages and internal comments.
7. **Design System Compliance (`docs/replica-design.md`):**
   - Never hardcode raw hex colors (`#ffffff`, `#191919`, etc.) inside React/TSX components. Always use semantic CSS custom properties (`var(--bg-canvas)`, `var(--bg-sidebar)`, `var(--ink-primary)`, `var(--accent-primary)`, etc.) defined in `src/app/globals.css`.
   - Maintain the `8px` spatial grid (`4px` micro-increments) and WCAG AA contrast across Light and Dark themes.
8. **TypeScript & `JSONB` Type Safety:**
   - Enforce `strict: true` with zero `any` types. Use the discriminated union types defined in `docs/replica-architect.md` (`BlockContentPayload`, `PropertyConfigPayload`, `ViewFilterRule`, `ViewSortRule`) and validate all incoming API payloads with **Zod**.

---

## 4. Replica Framework Slash-Command Execution

When a prompt or GitHub Issue invokes any `/replica-*` skill, execute its exact workflow from `AGENTS.md`:
- **`/replica-build`**: Build modular, keyboard-first React components in `src/components/` and App Router pages in `src/app/` adhering to `docs/replica-design.md`.
- **`/replica-backend`**: Build Route Handlers in `src/app/api/`, services in `src/server/services/`, RBAC guards in `src/server/auth/`, and Zod schemas in `src/server/validators/`.
- **`/replica-writer`**: Write original, clear, high-converting UI microcopy, onboarding checklists, slash-command descriptions, and empty states without copying third-party brand copy.
- **`/replica-gamify`**: Implement 3-tier Builder evolution (`APPRENTICE_SCRIBE`, `SYSTEMS_ARCHITECT`, `GRANDMASTER_WEAVER`), idempotent `XpLedger` awards, daily streaks with weekly freeze tokens, minimalist opt-out mode, and template creator `karmaScore`.
- **`/replica-test`**: Write comprehensive Vitest unit and integration tests in `tests/` and execute them until 100% pass.
- **`/replica-diff`**: Audit implemented routes, database models, and UI components against `docs/replica-pm.md` and `docs/replica-design.md`, outputting `docs/audit-diff.md`.
- **`/replica-deploy`**: Generate production `Dockerfile`, `docker-compose.yml`, and deployment configs.
- **`/replica-entrepreneur`**: Output pricing tier gating and viral growth loop specs in `docs/growth-strategy.md`.

---

## 5. Mandatory Post-Flight & PR Completion Gate

Before marking a Pull Request ready for review, you MUST complete all checks below in the VM terminal:
1. `npx prisma validate && npx prisma generate`
2. `npx tsc --noEmit` (zero TypeScript errors)
3. `npm run lint` (if ESLint is configured)
4. `CI=true npm test` (100% of Vitest suites passing)
5. `npm run build` (clean Next.js production build)
6. **Update Cross-PR Memory:** Update `docs/IMPLEMENTATION_STATUS.md` checkboxes, registry statuses, and append a summary row to the **Pull Request Execution Log**.

---

## 6. Pull Request Code Review Standards

When reviewing Pull Requests in this repository, flag any violation of:
- Missing `workspaceId` tenant isolation or `WorkspaceRole` permission checks on API routes.
- Unserialized `BigInt` fields returned in JSON responses.
- Hardcoded hex colors instead of `var(--*)` CSS variables.
- Sequential integer ordering instead of lexicographical `orderIndex` fractional indexing.
- Missing `await` on Next.js 15 dynamic `params` or `searchParams`.
