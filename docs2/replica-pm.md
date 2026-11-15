# Phase 2: Product Requirements Document (`/replica-pm`) — Connected Workspace Platform

- **Reference Recon:** `/docs/replica-recon.md`
- **Target Architecture:** Modular, Local-First Block & Relational Workspace with Gamified Retention
- **Document Version:** 1.0 (MVP + Core Growth Loop)
- **Next Phase:** `/replica-architect` & `/replica-design`

---

## 1. Product Overview & Success Metrics

### 1.1 Product Vision
Build a high-speed, local-first **All-in-One Connected Workspace** that unifies block-based rich documents, multi-view relational databases, real-time team collaboration, and behavioral gamification into a single modular web application.

### 1.2 Target Personas (Summary from Recon)
- **Persona A — Agile Product & Engineering Teams (B2B):** Require a unified wiki, PRD repository, and sprint tracker with granular permissions.
- **Persona B — Solo Creators, Freelancers & Students (B2C):** Need a fast "Second Brain" for notes, client tracking, and shareable/monetizable templates.
- **Persona C — Operations & Knowledge Managers (Enterprise):** Need structured SOPs, cross-database rollups, and native KPI visualizations without spreadsheet exports.

### 1.3 North Star & Key Metrics (KPIs)
- **Activation Rate:** $\ge 65\%$ of new users create or customize at least 3 blocks or 1 database view within 10 minutes of signup.
- **Local-First Responsiveness:** $< 16\text{ms}$ perceived UI latency for typing, slash commands, and view switching on datasets up to $5,000$ rows.
- **D7 / D30 Retention:** Boosted by $\ge 25\%$ via daily/weekly workspace streaks and 3-tier builder class progression.
- **Template Virality ($K$-factor):** $\ge 1.2$ organic signups generated per published public template.

---

## 2. Primary User Journeys

### Journey 1: Frictionless Onboarding & Smart Workflow Preset Injection
1. User lands on the authentication screen and signs in via OAuth (Google/GitHub) or Magic Link.
2. User completes a 2-step intent selector: **Workspace Type** (`Personal`, `Team`, `School`) and **Primary Goal** (`Docs & Wiki`, `Project Tracking`, `Client CRM`, `Habit & Study OS`).
3. System provisions a workspace pre-populated with a **Smart Workflow Preset** (linked databases, sample views, and an interactive Getting Started checklist) and awards the user's first `+50 XP`.

### Journey 2: Keyboard-First Block Composition
1. User opens a page or clicks `+ New Page` in the nested sidebar.
2. User sets a page emoji/icon, cover banner, and H1 title.
3. User types `/` anywhere in the document body to open a fuzzy-searchable command menu (`Text`, `Heading 1-3`, `To-Do`, `Bulleted List`, `Numbered List`, `Toggle`, `Callout`, `Code Block`, `Quote`, `Divider`, `Image`, `Inline Database`, `Chart Block`).
4. User reorders blocks vertically or snaps blocks side-by-side into multi-column layouts using drag handles.

### Journey 3: Relational Database & Multi-View Switching
1. User creates an inline or full-page database and defines custom typed properties (`Title`, `Status`, `Select`, `Multi-Select`, `Date`, `Person`, `Number`, `Checkbox`, `URL`, `Formula`, `Relation`, `Rollup`).
2. User toggles between **Table**, **Kanban Board**, **Calendar**, **Timeline**, and **Gallery** tabs on the same database header.
3. User applies view-specific filters (e.g., `Status IS NOT Done AND Assignee CONTAINS Me`), sorts, and groupings without altering the underlying records.

### Journey 4: Collaboration, Public Publishing & Subscription Checkout
1. Workspace Admin invites team members via email with role assignments (`Owner`, `Admin`, `Editor`, `Commenter`, `Viewer`).
2. Collaborators highlight text to post threaded inline comments and `@mention` teammates or pages.
3. User clicks **Share $\rightarrow$ Publish to Web**, toggles **"Allow Duplicate as Template"**, and shares the public URL.
4. When a workspace hits Free Tier limits (e.g., $>1,000$ blocks in a team workspace, $>5\text{MB}$ file uploads, or $>30$-day version history), user upgrades via Stripe/Midtrans checkout to **Pro** or **Team** plans.

---

## 3. Functional Requirements & User Stories

### Module 1: Authentication, Workspaces & Granular RBAC
- **US-1.1 (Multi-Workspace Account):** *As a user, I want to belong to multiple workspaces (e.g., Personal and Company) under a single login so I can separate personal notes from team projects.*
  - **Acceptance Criteria:**
    - Workspace switcher in top-left sidebar switches active context in $<200\text{ms}$.
    - Database queries strictly enforce `workspace_id` tenant isolation.
- **US-1.2 (Role-Based Access Control):** *As a Workspace Admin, I want to assign granular permissions at both workspace and individual page levels so sensitive documents remain private.*
  - **Acceptance Criteria:**
    - Roles supported: `OWNER`, `ADMIN`, `MEMBER` (Edit), `GUEST` (Comment/View).
    - Private pages remain invisible in sidebar and search results for unauthorized members unless explicitly shared.

### Module 2: Hierarchical Page Tree & Block-Based Rich Editor
- **US-2.1 (Infinite Nested Page Sidebar):** *As a user, I want to nest pages infinitely inside parent pages and pin Favorites so I can organize complex knowledge hierarchies.*
  - **Acceptance Criteria:**
    - Sidebar supports lazy-loaded tree expansion, drag-and-drop reparenting, Favorites section, and a 30-day Trash bin with 1-click restore.
- **US-2.2 (Block-Tree & Fractional Indexing):** *As a user, I want every content element to behave as an independent, reorderable block so I can restructure documents effortlessly.*
  - **Acceptance Criteria:**
    - Each block stores `id`, `page_id`, `parent_block_id`, `type`, `content` (JSON), and lexicographical `order_index` (fractional indexing).
    - Reordering a block updates only that single block's `order_index` without re-indexing sibling blocks.
- **US-2.3 (Slash Commands & Markdown Shortcuts):** *As a writer, I want to format blocks using `/` commands or Markdown prefixes (`#`, `-`, `[]`, `>`, ```` ``` ````) without touching my mouse.*
  - **Acceptance Criteria:**
    - Typing `/` opens the command popover within $50\text{ms}$ with arrow-key navigation and `Enter` selection.
    - Pressing `Backspace` on an empty formatted block reverts it to a standard paragraph block.
- **US-2.4 (Synced Blocks):** *As an Ops Manager, I want to embed a synced block across multiple pages so editing it in one place updates all instances automatically.*
  - **Acceptance Criteria:**
    - Edits to a `SYNCED_BLOCK` propagate to all referencing pages in real time.

### Module 3: Multi-View Relational Database Engine
- **US-3.1 (Dynamic Property Schema):** *As a user, I want to add, rename, reorder, and change column types on any database dynamically.*
  - **Acceptance Criteria:**
    - Supports `TEXT`, `NUMBER`, `SELECT`, `MULTI_SELECT`, `STATUS`, `DATE`, `PERSON`, `CHECKBOX`, `URL`, `RELATION`, `ROLLUP`, and `FORMULA`.
    - Deleting a property prompts confirmation and removes associated cell values cleanly.
- **US-3.2 (Multi-View Persistence):** *As a Project Manager, I want to view the same task database as a Kanban Board grouped by Status and a Calendar grouped by Due Date.*
  - **Acceptance Criteria:**
    - Supports 5 core layouts: `TABLE`, `BOARD` (Kanban), `CALENDAR`, `TIMELINE`, and `GALLERY`.
    - Dragging a Kanban card across columns automatically updates its underlying `STATUS` or `SELECT` property value.
- **US-3.3 (Native Chart & KPI Block):** *As an Analyst, I want to embed a live Bar, Line, or Donut chart block linked to a workspace database so I can visualize metrics without exporting CSVs.*
  - **Acceptance Criteria:**
    - Chart block aggregates database properties (`COUNT`, `SUM`, `AVG`) and updates reactively when rows change.

### Module 4: Local-First Sync & Instant Global Search
- **US-4.1 (Local-First Optimistic UI):** *As a user, I want typing, block reordering, and view filtering to work instantaneously even on slow or offline connections.*
  - **Acceptance Criteria:**
    - Mutations apply immediately to local client cache (IndexedDB / state store) in $<16\text{ms}$ and queue background delta sync to PostgreSQL.
    - Visual sync status indicator displays `Saved`, `Syncing...`, or `Offline (Changes queued)`.
- **US-4.2 (Quick Search Modal):** *As a user, I want to press `Cmd/Ctrl + K` from anywhere to search page titles, block contents, and database rows instantly.*
  - **Acceptance Criteria:**
    - Search modal returns ranked results with highlighted snippets and breadcrumb paths within $150\text{ms}$.

### Module 5: Public Publishing, Template Duplication & Monetization
- **US-5.1 (One-Click Web Publish & Template Cloning):** *As a Creator, I want to publish a page to a public URL and allow visitors to duplicate the entire page/database tree into their own workspace.*
  - **Acceptance Criteria:**
    - Public routes (`/p/[slug]`) render read-only SEO-friendly pages without requiring authentication.
    - Clicking **Duplicate Template** performs a deep recursive clone (remapping all `page_id`, `block_id`, and `database_id` UUIDs) into the authenticated user's selected workspace.
- **US-5.2 (Subscription Tier Gating & Checkout):** *As a Workspace Owner, I want to upgrade from Free to Pro or Team plans to unlock unlimited team blocks, larger file uploads, and full version history.*
  - **Acceptance Criteria:**
    - **Free Tier:** Unlimited personal pages/blocks, up to 1,000 shared team blocks, 5MB max file upload, 7-day version history.
    - **Pro Tier ($10/mo):** Unlimited blocks, unlimited file uploads, 30-day version history, custom domains, Chart blocks.
    - **Team Tier ($18/user/mo):** Collaborative teamspaces, granular RBAC, 90-day version history, priority sync.
    - Webhook integration updates `Workspace.planTier` immediately upon successful payment confirmation.

### Module 6: Gamified Workspace Retention (`/replica-gamify`)
- **US-6.1 (3-Tier Builder Class Evolution):** *As a user, I want my workspace activity to level up my Builder profile so organizing knowledge feels rewarding.*
  - **Acceptance Criteria:**
    - Users earn XP for completing tasks (`+10 XP`), creating structured databases (`+25 XP`), and publishing templates (`+100 XP`).
    - **3 Evolution Tiers:**
      1. **Tier 1 — Apprentice Scribe (0–499 XP):** Unlocks starter icon packs.
      2. **Tier 2 — Systems Architect (500–2,499 XP):** Unlocks custom accent themes and Smart Workflow Presets.
      3. **Tier 3 — Grandmaster Weaver (2,500+ XP):** Unlocks verified Creator badge on public templates and advanced KPI chart widgets.
- **US-6.2 (Daily/Weekly Productivity Streaks & Quests):** *As a user, I want a subtle, non-intrusive streak counter and weekly builder quests to maintain consistent workspace habits.*
  - **Acceptance Criteria:**
    - Tracks consecutive active days with a 1-day "Streak Freeze" buffer per week to prevent churn from missed weekends.
    - Can be toggled off in User Preferences for distraction-free minimalist mode.
- **US-6.3 (Template Creator Karma Score):** *As a Template Creator, I want to earn Karma points whenever other users duplicate or upvote my public templates.*
  - **Acceptance Criteria:**
    - Displays total duplications and Karma score on the creator's public profile header.

---

## 4. Feature Prioritization (MoSCoW Matrix)

| Priority | Category | Feature Scope |
| :--- | :--- | :--- |
| **Must-Have (MVP)** | Core Editor | Block-tree data model, fractional indexing, `/` slash commands, Markdown shortcuts, nested sidebar tree. |
| **Must-Have (MVP)** | Database | Dynamic typed properties, Table View, Kanban Board View, Calendar View, per-view filters & sorts. |
| **Must-Have (MVP)** | Collaboration | Auth (OAuth/Email), multi-workspace RBAC, inline comments, `Cmd/Ctrl + K` search. |
| **Must-Have (MVP)** | Performance | Local-first optimistic client cache with background API delta sync. |
| **Should-Have (V1.1)** | Growth & Gamify | Public web publishing, 1-click recursive template duplication, 3-tier Builder XP & streak engine. |
| **Should-Have (V1.1)** | Monetization | Plan tier enforcement (`FREE`, `PRO`, `TEAM`) and payment webhook integration. |
| **Could-Have (V2)** | Advanced Views | Timeline (Gantt) View, Gallery View, Synced Blocks, Native KPI Chart Block, Formulas & Rollups. |
| **Won't-Have (Out of Scope)** | Enterprise Extras | Native offline desktop Electron wrapper, custom SAML SSO, third-party plugin marketplace API. |

---

## 5. Non-Functional Requirements (NFRs)

1. **Performance & Latency:**
   - First Contentful Paint (FCP) $< 1.2\text{s}$ on 4G connections.
   - Local block edit and slash-menu rendering $< 16\text{ms}$ ($60\text{fps}$).
   - Database view queries paginated or virtualized for smooth scrolling with $5,000+$ rows.
2. **Data Integrity & Reliability:**
   - All block mutations must be idempotent using client-generated UUIDv7/UUIDv4 identifiers so retried offline sync packets never create duplicate blocks.
   - Soft-delete (`deleted_at` timestamp) required on `Page`, `Block`, and `Database` entities to support Trash recovery.
3. **Security & Multi-Tenancy:**
   - Strict server-side authorization middleware verifying `userId` membership and `role` on every API route and WebSocket/sync channel.
   - Sanitize all HTML/Markdown/URL inputs to prevent XSS in published public pages (`/p/[slug]`).
4. **Accessibility & UX:**
   - Full keyboard navigability across sidebar tree, slash menu, and table cells (`Tab`, `Arrow` keys, `Escape`, `Enter`).
   - High-contrast Light and Dark mode themes adhering to WCAG AA standards.

---

## 6. Edge Cases & Error Handling

| Scenario | Expected System Behavior |
| :--- | :--- |
| **Fractional Index Precision Limit** | If repeated drag-and-drop operations between two adjacent blocks exhaust string midpoint precision, trigger a scoped background normalization pass on sibling blocks of that parent only. |
| **Offline Edit Conflict (2 Users)** | Apply field-level Last-Write-Wins (LWW) using monotonic server timestamps for block properties, while preserving both users' inline comments without overwriting. |
| **Circular Page or Relation Nesting** | Validate parent-child ancestry before reparenting a page or linking a `Relation` property to prevent infinite recursion loops during sidebar rendering or template cloning. |
| **Template Cloning with Broken Relations** | When deep-cloning a template containing a `Relation` to an external database outside the template tree, convert that property gracefully to a `TEXT` placeholder rather than failing the clone transaction. |
| **Subscription Downgrade Over Limit** | If a `PRO` workspace downgrades to `FREE` while exceeding the 1,000-block team limit, switch existing blocks to **read-only mode** (preventing data loss) and prompt upgrade or archiving. |
| **Unauthorized Access to Published Child Page** | Publishing a parent page does **not** automatically expose private sub-pages unless "Include sub-pages" is explicitly enabled by the page owner. |
