# Phase 3: System & Database Architecture (`/replica-architect`) — Connected Workspace Platform

- **Reference Specs:** `/docs/replica-recon.md` & `/docs/prd.md`
- **Architecture Pattern:** Local-First Modular Monolith with Unified Page-Row Block Engine & Gamified Retention
- **Status:** Ready for `/replica-design`, `/replica-build`, `/replica-backend`, and `/replica-test`

---

## 1. Tech Stack Selection & Rationale

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Framework** | **Next.js 15 (App Router) + TypeScript** | Unified full-stack architecture supporting Server Components for fast SEO-friendly public pages (`/p/[slug]`) and low-latency API route handlers. |
| **Styling & UI** | **Tailwind CSS + Radix UI Primitives** | Zero-runtime CSS utility tokens for Light/Dark theming, accessible modals, popovers (`/` slash menu), and keyboard-navigable dropdowns. |
| **Local-First State** | **Zustand + Dexie.js (IndexedDB)** | Enables `<16ms` optimistic UI mutations, offline queuing, and instant client-side filtering/sorting on databases up to $5,000+$ rows. |
| **Drag & Drop** | **`@dnd-kit/core` + Fractional Indexing** | Accessible multi-container drag-and-drop (nested sidebar, block reordering, Kanban columns) with $O(1)$ database updates via lexicographical keys. |
| **Database & ORM** | **PostgreSQL 16 + Prisma ORM** | Combines strict relational multi-tenancy/RBAC with flexible `JSONB` columns for polymorphic block payloads and `GIN` indexes for full-text search. |
| **Real-Time Sync** | **Delta Sync Engine + Server-Sent Events (SSE)** | Monotonic revision cursors for conflict-resilient delta synchronization and live multiplayer cursor/comment updates. |
| **Auth & Billing** | **Auth.js (v5) + Stripe / Midtrans Webhooks** | Supports Google/GitHub OAuth, Magic Links, and idempotent webhook handlers for `FREE`, `PRO`, and `TEAM` tier gating. |

---

## 2. Core Architectural Mechanisms

### 2.1 Unified Page-Row Data Model
To eliminate duplicate permission logic and enable seamless linking across wikis and databases:
- Every document is a **`Page`** containing a tree of **`Block`** records.
- A database is simply a **`Page`** with `isDatabase = true`, owning a schema of **`DatabaseProperty`** definitions and **`DatabaseView`** configurations.
- Every row inside a database is also a **`Page`** (`parentPageId = databasePage.id`) that stores structured cell values in **`DatabaseRowProperty`** while retaining a full block-based document body when opened as a side-peek or full page.

### 2.2 Fractional Indexing for $O(1)$ Reordering
Instead of sequential integers (`1, 2, 3`) that force cascading row updates during drag-and-drop:
- Every `Block`, `Page`, `DatabaseProperty`, and `DatabaseView` stores a lexicographical `orderIndex` string (e.g., `"a0"`, `"a0V"`, `"a1"`).
- Moving an item between `"a0"` and `"a1"` computes the midpoint string `"a0V"` and updates **only that single row**.
- If midpoint string length exceeds 32 characters after heavy localized edits, a scoped background job normalizes sibling keys under that single parent.

### 2.3 Local-First Optimistic Delta Sync
1. **Write Path:** User edits a block $\rightarrow$ Zustand + Dexie (IndexedDB) updates immediately ($<16\text{ms}$) $\rightarrow$ Mutation (`idempotencyKey`, `entityType`, `entityId`, `patch`, `clientTimestamp`) is pushed to an IndexedDB `outbox` queue.
2. **Batch Flush:** A background sync worker batches queued mutations every $300\text{ms}$ (or immediately upon `window.online`) to `POST /api/sync/push`.
3. **Conflict Resolution:** Server applies field-level **Last-Write-Wins (LWW)** using monotonic server revision numbers (`serverRevision`), increments workspace revision, and broadcasts delta events via SSE (`GET /api/sync/stream`).

---

## 3. Complete PostgreSQL Database Schema (`prisma/schema.prisma`)

Save this schema directly to `prisma/schema.prisma` when scaffolding the backend:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearchPostgres"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==========================================
// 1. AUTHENTICATION & MULTI-TENANT WORKSPACE
// ==========================================

enum PlanTier {
  FREE
  PRO
  TEAM
}

enum WorkspaceRole {
  OWNER
  ADMIN
  MEMBER
  GUEST
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  name          String?
  avatarUrl     String?
  emailVerified DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts         Account[]
  sessions         Session[]
  memberships      WorkspaceMember[]
  createdPages     Page[]            @relation("PageCreator")
  comments         Comment[]
  builderProfile   BuilderProfile?
  xpLedger         XpLedger[]
  userBadges       UserBadge[]
}

model Account {
  id                String  @id @default(uuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(uuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Workspace {
  id                 String   @id @default(uuid())
  name               String
  slug               String   @unique
  icon               String?
  planTier           PlanTier @default(FREE)
  billingCustomerId  String?  @unique
  subscriptionStatus String?  @default("active")
  serverRevision     BigInt   @default(0)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  members  WorkspaceMember[]
  pages    Page[]
  xpEvents XpLedger[]
}

model WorkspaceMember {
  id          String        @id @default(uuid())
  workspaceId String
  userId      String
  role        WorkspaceRole @default(MEMBER)
  joinedAt    DateTime      @default(now())

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, userId])
  @@index([userId])
}

// ==========================================
// 2. PAGES & HIERARCHICAL BLOCK-TREE ENGINE
// ==========================================

enum BlockType {
  PARAGRAPH
  HEADING_1
  HEADING_2
  HEADING_3
  TODO
  BULLETED_LIST
  NUMBERED_LIST
  TOGGLE
  CALLOUT
  CODE
  QUOTE
  DIVIDER
  IMAGE
  COLUMN_LIST
  COLUMN
  CHILD_DATABASE
  CHART_BLOCK
  SYNCED_BLOCK
}

model Page {
  id                 String    @id @default(uuid())
  workspaceId        String
  parentPageId       String?
  createdById        String
  title              String    @default("Untitled")
  icon               String?
  coverUrl           String?
  orderIndex         String    @default("a0")
  isDatabase         Boolean   @default(false)
  isFavorite         Boolean   @default(false)
  isPrivate          Boolean   @default(false)
  isPublished        Boolean   @default(false)
  publicSlug         String?   @unique
  allowTemplateClone Boolean   @default(false)
  cloneCount         Int       @default(0)
  revision           BigInt    @default(1)
  deletedAt          DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  parentPage  Page?     @relation("PageHierarchy", fields: [parentPageId], references: [id], onDelete: SetNull)
  childPages  Page[]    @relation("PageHierarchy")
  createdBy   User      @relation("PageCreator", fields: [createdById], references: [id])

  blocks             Block[]
  databaseProperties DatabaseProperty[]    @relation("DatabaseSchema")
  databaseViews      DatabaseView[]        @relation("DatabaseViews")
  rowPropertyValues  DatabaseRowProperty[] @relation("RowValues")
  comments           Comment[]

  @@index([workspaceId, parentPageId, deletedAt])
  @@index([publicSlug])
}

model Block {
  id             String    @id @default(uuid())
  pageId         String
  parentBlockId  String?
  syncedSourceId String?
  type           BlockType @default(PARAGRAPH)
  content        Json      @default("{}") // Rich text spans, checked state, language, chart config
  orderIndex     String    @default("a0")
  revision       BigInt    @default(1)
  deletedAt      DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  page          Page      @relation(fields: [pageId], references: [id], onDelete: Cascade)
  parentBlock   Block?    @relation("BlockHierarchy", fields: [parentBlockId], references: [id], onDelete: Cascade)
  childBlocks   Block[]   @relation("BlockHierarchy")
  syncedSource  Block?    @relation("SyncedBlockRef", fields: [syncedSourceId], references: [id], onDelete: SetNull)
  syncedMirrors Block[]   @relation("SyncedBlockRef")
  comments      Comment[]

  @@index([pageId, parentBlockId, orderIndex])
  @@index([deletedAt])
}

// ==========================================
// 3. RELATIONAL DATABASE & MULTI-VIEW ENGINE
// ==========================================

enum PropertyType {
  TEXT
  NUMBER
  SELECT
  MULTI_SELECT
  STATUS
  DATE
  PERSON
  CHECKBOX
  URL
  RELATION
  ROLLUP
  FORMULA
}

enum ViewLayout {
  TABLE
  BOARD
  CALENDAR
  TIMELINE
  GALLERY
}

model DatabaseProperty {
  id             String       @id @default(uuid())
  databasePageId String
  name           String
  type           PropertyType @default(TEXT)
  config         Json         @default("{}") // Select options/colors, relation targetDatabaseId, formula expression
  orderIndex     String       @default("a0")
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  databasePage Page                  @relation("DatabaseSchema", fields: [databasePageId], references: [id], onDelete: Cascade)
  rowValues    DatabaseRowProperty[]
  groupedViews DatabaseView[]        @relation("ViewGroupBy")

  @@index([databasePageId, orderIndex])
}

model DatabaseRowProperty {
  id         String   @id @default(uuid())
  rowPageId  String
  propertyId String
  value      Json     // Polymorphic typed payload: string, number, string[], date range, etc.
  updatedAt  DateTime @updatedAt

  rowPage  Page             @relation("RowValues", fields: [rowPageId], references: [id], onDelete: Cascade)
  property DatabaseProperty @relation(fields: [propertyId], references: [id], onDelete: Cascade)

  @@unique([rowPageId, propertyId])
  @@index([propertyId])
}

model DatabaseView {
  id                String     @id @default(uuid())
  databasePageId    String
  name              String     @default("Default View")
  layout            ViewLayout @default(TABLE)
  filters           Json       @default("[]") // AST array of filter predicates
  sorts             Json       @default("[]") // Ordered array of { propertyId, direction }
  visibleProperties Json       @default("[]") // Ordered propertyIds
  groupByPropertyId String?
  orderIndex        String     @default("a0")
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt

  databasePage    Page              @relation("DatabaseViews", fields: [databasePageId], references: [id], onDelete: Cascade)
  groupByProperty DatabaseProperty? @relation("ViewGroupBy", fields: [groupByPropertyId], references: [id], onDelete: SetNull)

  @@index([databasePageId, orderIndex])
}

model Comment {
  id         String    @id @default(uuid())
  pageId     String
  blockId    String?
  authorId   String
  threadId   String
  content    String    @db.Text
  resolvedAt DateTime?
  createdAt  DateTime  @default(now())

  page   Page   @relation(fields: [pageId], references: [id], onDelete: Cascade)
  block  Block? @relation(fields: [blockId], references: [id], onDelete: Cascade)
  author User   @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([pageId, threadId])
}

// ==========================================
// 4. GAMIFICATION & RETENTION ENGINE (/replica-gamify)
// ==========================================

enum BuilderTier {
  APPRENTICE_SCRIBE  // Tier 1: 0 - 499 XP
  SYSTEMS_ARCHITECT  // Tier 2: 500 - 2,499 XP
  GRANDMASTER_WEAVER // Tier 3: 2,500+ XP
}

model BuilderProfile {
  id                  String      @id @default(uuid())
  userId              String      @unique
  totalXp             Int         @default(0)
  tier                BuilderTier @default(APPRENTICE_SCRIBE)
  karmaScore          Int         @default(0)
  currentStreak       Int         @default(0)
  longestStreak       Int         @default(0)
  freezeTokens        Int         @default(1)
  lastActiveDate      DateTime?
  gamificationEnabled Boolean     @default(true)
  updatedAt           DateTime    @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model XpLedger {
  id          String   @id @default(uuid())
  userId      String
  workspaceId String?
  actionType  String   // e.g., "COMPLETE_TODO", "CREATE_DATABASE", "PUBLISH_TEMPLATE", "TEMPLATE_CLONED"
  xpDelta     Int
  referenceId String?  // Idempotency key to prevent duplicate XP farming
  createdAt   DateTime @default(now())

  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace Workspace? @relation(fields: [workspaceId], references: [id], onDelete: SetNull)

  @@unique([userId, actionType, referenceId])
  @@index([userId, createdAt])
}

model AchievementBadge {
  id          String      @id @default(uuid())
  slug        String      @unique
  name        String
  description String
  icon        String
  requiredTier BuilderTier @default(APPRENTICE_SCRIBE)

  awardedTo UserBadge[]
}

model UserBadge {
  id        String   @id @default(uuid())
  userId    String
  badgeId   String
  awardedAt DateTime @default(now())

  user  User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  badge AchievementBadge @relation(fields: [badgeId], references: [id], onDelete: Cascade)

  @@unique([userId, badgeId])
}
