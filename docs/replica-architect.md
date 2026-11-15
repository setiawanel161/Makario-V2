# Phase 3: System & Database Architecture (`docs/replica-architect.md`) — Makario-V2

- **Reference Specs:** `docs/replica-recon.md`, `docs/replica-pm.md`, `docs/replica-design.md`
- **Execution Rules:** `AGENTS.md` & `docs/IMPLEMENTATION_STATUS.md`
- **Architecture Pattern:** Local-First Modular Monolith with Unified Page-Row Block Engine, Optimistic Delta Sync & Gamified Retention
- **Target Runtime:** Next.js 15 (App Router), TypeScript 5 (`strict: true`), PostgreSQL 16 + Prisma ORM

---

## 1. Tech Stack & Dependency Specification

| Layer | Technology / Package | Architectural Role & Rationale |
| :--- | :--- | :--- |
| **Core Framework** | `next` (v15+, App Router), `react` (v19), `typescript` (`strict: true`) | Server Components for SEO-friendly public pages (`/p/[publicSlug]`) and Route Handlers (`src/app/api/**`) for REST/SSE endpoints. |
| **Styling & Primitives** | `tailwindcss`, `@radix-ui/react-popover`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `lucide-react` | Consumes semantic CSS variables from `docs/replica-design.md` with accessible keyboard navigation for `/` slash menus and `Cmd+K` modals. |
| **Local-First State** | `zustand`, `dexie`, `dexie-react-hooks` | IndexedDB persistence + in-memory reactive store enabling `<16ms` optimistic mutations, offline outbox queuing, and instant filtering up to $5,000+$ rows. |
| **Drag & Drop** | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | Accessible nested tree reparenting, vertical/column block reordering, and Kanban card transitions backed by $O(1)$ Fractional Indexing. |
| **Database & ORM** | PostgreSQL 16, `prisma`, `@prisma/client` | Relational multi-tenancy/RBAC paired with typed `JSONB` payloads for polymorphic blocks, database properties, and view AST filters. |
| **Auth & Validation** | `next-auth` (Auth.js v5), `@auth/prisma-adapter`, `zod` | OAuth (Google/GitHub) + Magic Link authentication and strict runtime payload validation across all API boundaries. |
| **Testing & QA** | `vitest`, `@testing-library/react`, `jsdom` | Fast unit and integration test suite executed in CI and Jules VM before every Pull Request. |

> **Next.js 15 App Router Guardrail:** In Next.js 15, dynamic route `params` and `searchParams` are asynchronous Promises (`{ params }: { params: Promise<{ pageId: string }> }`). Always `await params` in Page Components and Route Handlers.

---

## 2. Core Architectural Engines & Algorithms

### 2.1 Unified Page-Row Data Model
To eliminate duplicate RBAC logic and allow any database record to act as a rich document:
1. Every document is a **`Page`** owning a hierarchical tree of **`Block`** nodes (`parentBlockId` supports nested toggles, callouts, and multi-column containers).
2. A relational database is a **`Page`** with `isDatabase = true`, owning **`DatabaseProperty`** schema columns and **`DatabaseView`** layout configurations.
3. Every row inside a database is also a **`Page`** (`parentPageId = databasePage.id`, `isDatabase = false`) storing typed cell values in **`DatabaseRowProperty`** while supporting full block content inside its body.

### 2.2 Lexicographical Fractional Indexing (`src/lib/fractional-index.ts`)
Sequential integer ordering (`1, 2, 3`) causes $O(N)$ row rewrites on every drag-and-drop. All orderable entities (`Page`, `Block`, `DatabaseProperty`, `DatabaseView`) use base-62 lexicographical strings (`0-9A-Za-z`):
- **Default Initial Key:** `"a0"`
- **Append After (`prevKey`, `null`):** Increments trailing base-62 character (e.g., `"a0"` $\rightarrow$ `"a1"`).
- **Prepend Before (`null`, `nextKey`):** Decrements leading/trailing character (e.g., `"a0"` $\rightarrow$ `"Zz"`).
- **Insert Between (`prevKey`, `nextKey`):** Computes lexicographical midpoint string (e.g., between `"a0"` and `"a1"` $\rightarrow$ `"a0V"`), updating **only 1 database row** ($O(1)$).
- **Sibling Normalization Guard:** If generated midpoint string length exceeds `32` characters due to repeated localized insertions, trigger a scoped transaction re-indexing only direct siblings under that single parent (`parentBlockId` or `parentPageId`).

### 2.3 Local-First Optimistic Delta Sync (`src/lib/sync/`)
1. **IndexedDB Schema (Dexie):**
   - `pages`: `&id, workspaceId, parentPageId, isDatabase, updatedAt`
   - `blocks`: `&id, pageId, parentBlockId, orderIndex`
   - `properties`: `&id, databasePageId, orderIndex`
   - `rowProperties`: `&id, rowPageId, propertyId, [rowPageId+propertyId]`
   - `views`: `&id, databasePageId, orderIndex`
   - `outbox`: `++seq, &idempotencyKey, workspaceId, entityType, entityId, createdAt`
2. **Optimistic Write Path (`<16ms`):**
   - UI action generates a deterministic UUIDv4 (`entityId`) and unique `idempotencyKey`.
   - Zustand store and Dexie tables update synchronously; mutation packet is appended to `outbox`.
3. **Background Batch Flush (`300ms` debounce):**
   - Sync worker drains up to `50` queued mutations per batch to `POST /api/sync/push`.
   - On network offline (`navigator.onLine === false`), mutations remain safely in `outbox` and flush automatically upon `window.addEventListener('online')`.
4. **Conflict Resolution & `BigInt` Serialization:**
   - Server increments `Workspace.serverRevision` (`BigInt`) and entity `revision` (`BigInt`) on every accepted mutation using field-level **Last-Write-Wins (LWW)**.
   - **Critical Serialization Rule:** Convert all `BigInt` revision fields to decimal `string` (e.g., `revision.toString()`) in JSON API responses and client stores to prevent `JSON.stringify` `TypeError`.

### 2.4 Recursive Template Deep-Cloner (`src/server/services/template-cloner.ts`)
When an authenticated user triggers `POST /api/pages/[pageId]/duplicate` on a public template (`isPublished = true && allowTemplateClone = true`) or internal page:
1. **Traversal:** Recursively collect the root `Page`, all non-deleted descendant `Page`s (up to max depth `10`), their `Block` trees, `DatabaseProperty` schemas, `DatabaseView` configs, and `DatabaseRowProperty` values.
2. **4-Pass Deterministic UUID Remapping (inside `prisma.$transaction`):**
   - **Pass 1 (Pages):** Generate `pageIdMap: Map<oldId, newId>` and insert cloned `Page` records with `isPublished = false`, `publicSlug = null`, `cloneCount = 0`.
   - **Pass 2 (Database Schemas & Views):** Generate `propertyIdMap: Map<oldId, newId>`. For `RELATION` properties, if `targetDatabaseId` exists in `pageIdMap`, remap to the cloned database ID; if it points outside the cloned tree, **gracefully degrade** the property type to `TEXT` so the transaction never fails. Remap `groupByPropertyId`, `filters`, `sorts`, and `visibleProperties` in `DatabaseView`.
   - **Pass 3 (Blocks & Synced Mirrors):** Generate `blockIdMap: Map<oldId, newId>`, remapping `pageId`, `parentBlockId`, and internal `syncedSourceId` pointers.
   - **Pass 4 (Row Cell Values):** Clone `DatabaseRowProperty` entries using `pageIdMap` and `propertyIdMap`.
3. **Creator Karma Reward:** Atomically increment `Page.cloneCount` on the source template and award `+25` `karmaScore` to the original `createdById` via `gamify-engine.ts`.

### 2.5 Gamification & Behavioral Retention Engine (`src/server/services/gamify-engine.ts`)
- **Idempotent XP Awards:** Every reward calls `awardXp({ userId, workspaceId, actionType, referenceId, xpDelta })` wrapped in a `try/catch` over `XpLedger`'s `@@unique([userId, actionType, referenceId])` constraint so offline sync retries never grant duplicate XP:
  - `COMPLETE_TODO`: `+10 XP` (`referenceId = block.id`)
  - `CREATE_PAGE`: `+15 XP` (`referenceId = page.id`)
  - `CREATE_DATABASE`: `+25 XP` (`referenceId = page.id`)
  - `PUBLISH_TEMPLATE`: `+100 XP` (`referenceId = page.id`)
- **3-Tier Evolution Thresholds:**
  - `0 – 499 XP` $\rightarrow$ `APPRENTICE_SCRIBE`
  - `500 – 2,499 XP` $\rightarrow$ `SYSTEMS_ARCHITECT`
  - `2,500+ XP` $\rightarrow$ `GRANDMASTER_WEAVER`
- **Streak & Weekly Freeze Token:** Compare `lastActiveDate` against current UTC calendar day (`YYYY-MM-DD`). Same day = no-op; `diff === 1 day` = `currentStreak + 1`; `diff === 2 days && freezeTokens > 0` = consume `1` freeze token and preserve streak; `diff > 2 days` = reset `currentStreak = 1`.

---

## 3. Strictly Typed `JSONB` Domain Contracts (`src/types/workspace.ts`)

Use these exact TypeScript discriminated unions so `Block.content`, `DatabaseProperty.config`, and `DatabaseView` payloads remain 100% type-safe without `any`:

```typescript
export interface RichTextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  color?: string;
  href?: string;
  mentionPageId?: string;
  mentionUserId?: string;
}

export type BlockContentPayload =
  | { kind: 'text'; spans: RichTextSpan[] } // PARAGRAPH, HEADING_1..3, BULLETED_LIST, NUMBERED_LIST, QUOTE
  | { kind: 'todo'; spans: RichTextSpan[]; checked: boolean } // TODO
  | { kind: 'toggle'; spans: RichTextSpan[]; isOpen: boolean } // TOGGLE
  | { kind: 'callout'; spans: RichTextSpan[]; icon: string; bgColor?: string } // CALLOUT
  | { kind: 'code'; code: string; language: string } // CODE
  | { kind: 'divider' } // DIVIDER
  | { kind: 'image'; url: string; caption?: string; widthPercent?: number } // IMAGE
  | { kind: 'layout' } // COLUMN_LIST, COLUMN
  | { kind: 'child_database'; databasePageId: string } // CHILD_DATABASE
  | {
      kind: 'chart';
      databasePageId: string;
      chartType: 'BAR' | 'LINE' | 'DONUT';
      groupByPropertyId: string;
      metric: 'COUNT' | 'SUM' | 'AVG';
      metricPropertyId?: string;
    } // CHART_BLOCK
  | { kind: 'synced'; originalBlockId: string }; // SYNCED_BLOCK

export interface SelectOption {
  id: string;
  label: string;
  color: 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red';
}

export type PropertyConfigPayload =
  | { kind: 'none' }
  | { kind: 'number'; format: 'number' | 'currency_usd' | 'currency_idr' | 'percent' }
  | { kind: 'select'; options: SelectOption[] }
  | { kind: 'status'; options: SelectOption[]; groups: { todo: string[]; inProgress: string[]; done: string[] } }
  | { kind: 'relation'; targetDatabaseId: string; syncedPropertyId?: string }
  | { kind: 'rollup'; relationPropertyId: string; targetPropertyId: string; aggregation: 'COUNT' | 'SUM' | 'AVG' | 'PERCENT_CHECKED' }
  | { kind: 'formula'; expression: string };

export interface ViewFilterRule {
  id: string;
  propertyId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty' | 'gt' | 'lt';
  value?: string | number | boolean | string[];
}

export interface ViewSortRule {
  propertyId: string;
  direction: 'asc' | 'desc';
}
