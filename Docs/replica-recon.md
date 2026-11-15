# Phase 1: Recon & Analysis (`/replica-recon`) — Connected Workspace Platform

- **Reference Target:** Notion (`notion.so`)
- **Methodology:** Clean-Room Reverse Engineering (Extract workflows, data models, and UX patterns without copying proprietary code or assets)
- **Status:** Completed — Ready for `/replica-pm`, `/replica-architect`, `/replica-design`, and `/replica-gamify`

---

## 1. Core Value Proposition
An **All-in-One Connected Workspace** engineered around **Block-Based Modularity**. 
The platform consolidates four traditionally fragmented productivity tools into a single, infinitely nestable canvas:
1. **Collaborative Docs & Knowledge Wiki** (replacing static document editors and internal wikis)
2. **Project & Sprint Management** (replacing standalone Kanban boards and task trackers)
3. **No-Code Relational Databases** (replacing basic spreadsheets and lightweight database tools)
4. **Embedded AI Workspace Assistant** (context-aware drafting, summarization, Q&A, and property autofill)

Instead of enforcing rigid, single-purpose workflows, the system provides atomic building blocks that users compose into custom personal or team operating systems.

---

## 2. Core User Personas

### Persona A: Product, Engineering & Startup Teams (B2B SaaS)
- **Profile:** Product Managers, Software Engineers, and Designers working in agile teams.
- **Goals:** Maintain a single source of truth for PRDs, technical architecture docs, sprint backlogs, and bug trackers without switching across 4–5 separate apps.
- **Frustrations:** Tool sprawl, fragmented permissions, and disconnected documentation that quickly becomes outdated.

### Persona B: Solo Creators, Students & Freelancers (B2C)
- **Profile:** Knowledge workers, university students, and independent consultants.
- **Goals:** Build a personal "Second Brain" for notes, habit tracking, client CRM, and portfolio pages—or design and monetize custom workspace templates.
- **Frustrations:** Overly complex enterprise tools or rigid note-taking apps that lack structured database views.

### Persona C: Operations & Knowledge Managers (Enterprise)
- **Profile:** Ops Leads and HR/People teams scaling company processes.
- **Goals:** Centralize SOPs, employee onboarding checklists, and cross-departmental KPIs with granular role-based access control.
- **Frustrations:** Slow search across scattered folders and inability to visualize structured operational data natively.

---

## 3. Primary User Journeys

### Journey 1: Frictionless Onboarding & Template Injection
1. User signs up via OAuth (Google/GitHub) or email magic link.
2. User selects workspace intent (`Personal`, `Team`, or `School`) and primary use case.
3. System provisions a default workspace pre-populated with interactive starter pages and role-specific templates to eliminate blank-page paralysis.

### Journey 2: Keyboard-First Block Composition (`/` Slash Commands)
1. User creates a new page (or nested sub-page) with custom icon, cover banner, and title.
2. User types `/` anywhere on the canvas to trigger an instant, filterable command palette (`Heading 1–3`, `To-Do`, `Bulleted/Numbered List`, `Toggle`, `Callout`, `Code Block`, `Divider`, `Image`, `Embed`, `Inline Database`).
3. User converts Markdown shortcuts (`# `, `- `, `[] `, `> `) on the fly and rearranges blocks or creates multi-column layouts via drag-and-drop handles.

### Journey 3: Relational Database & Multi-View Switching
1. User initializes a structured database with typed schema properties (`Title`, `Status`, `Select`, `Multi-Select`, `Date`, `Person`, `Number`, `Checkbox`, `URL`, `Formula`, `Relation`, `Rollup`).
2. User creates multiple saved views over the **exact same underlying dataset**:
   - **Table View:** Spreadsheet-like grid with resizable columns and inline cell editing.
   - **Kanban Board View:** Cards grouped dynamically by `Status` or `Select` properties with drag-and-drop state transitions.
   - **Calendar View:** Items plotted by `Date` property across monthly/weekly grids.
   - **Timeline (Gantt) View:** Horizontal duration bars for project scheduling.
   - **Gallery View:** Visual card grid displaying page cover images or file previews.
3. Each view maintains independent filter rules (`AND`/`OR`), multi-level sorting, and property visibility toggles.

### Journey 4: Multiplayer Collaboration & Public Web Publishing
1. Workspace owner invites members or external guests with granular permissions (`Full access`, `Can edit`, `Can comment`, `Can view`).
2. Collaborators highlight text to leave threaded inline comments, resolve discussions, and mention users (`@user`) or linked pages (`@page`).
3. User toggles "Publish to Web" to generate a clean public URL, with an optional "Allow duplicate as template" button for viral distribution.

---

## 4. Feature Breakdown

### Must-Have Features (Core MVP)
- **Hierarchical Block-Tree Engine:** Every content element is stored as an independent `Block` node (`id`, `page_id`, `parent_block_id`, `type`, `content` JSONB, and `order_index` using **fractional indexing** so drag-and-drop reordering updates only a single row).
- **Recursive Page Sidebar Tree:** Infinite nested page navigation with drag-and-drop reparenting, Favorites pinning, Private pages, Shared teamspaces, and Trash/Soft-delete recovery.
- **Multi-View Database Engine:** Dynamic property schema builder (`DatabaseProperty`), row records (`Page` items), and view state persistence (`DatabaseView`).
- **Slash Command & Markdown Parser:** Low-latency keyboard-driven rich-text editor supporting block transformations (e.g., turning a paragraph into a toggle or callout).
- **Quick Search (`Cmd/Ctrl + K`):** Instant modal search across page titles, block text, and database items.
- **Granular RBAC & Authentication:** Workspace-level and page-level permission inheritance.

### Nice-to-Have & Differentiation Features (V2 / Growth)
- **1-Click Template Deep-Cloning:** Recursively duplicates a public page, its child pages, database schemas, and sample rows into a new user's workspace.
- **Synced Blocks:** Global block references that mirror live edits across multiple pages simultaneously.
- **Native Chart & KPI Block:** Built-in bar, line, and donut charts bound directly to internal relational databases.
- **Gamified Productivity Loop (`/replica-gamify`):** Builder XP, 3-tier workspace mastery evolution, daily/weekly streaks, and template creator karma scores.

---

## 5. Technical & Data Model Observations (For `/replica-architect`)
- **Unified Page-Row Model:** In a block-based system, a database row is structurally a `Page` that possesses structured `PropertyValues` in addition to child `Blocks` inside its body. Designing `Page` and `DatabaseRow` cleanly around this pattern simplifies linking and permissions.
- **Fractional Indexing:** Avoid integer `position` columns (`1, 2, 3`) for blocks, as moving a block requires rewriting all subsequent rows. Use lexicographical fractional strings (e.g., `"a0"`, `"a0V"`, `"a1"`) for $O(1)$ reordering.
- **JSONB Flexibility + Relational Integrity:** Store block-specific formatting/payloads in PostgreSQL `JSONB` columns while keeping workspace membership, page hierarchy, and access control strictly relational.

---

## 6. Competitor Pain Points & Our Competitive Edge
1. **Large Database Lag & Offline Friction:** Traditional cloud-only workspaces become sluggish when databases exceed 2,000+ rows or when network latency spikes.
   - *Our Edge:* Implement a **local-first client cache** (IndexedDB / optimistic state mutations) with background delta sync so typing, filtering, and view switching execute in `<16ms`.
2. **Over-Customization Paralysis:** New users often abandon blank workspaces after spending hours configuring complex layouts instead of getting work done.
   - *Our Edge:* Ship **Smart Workflow Presets** (e.g., *Agile Sprint Hub*, *Content Pipeline*, *Personal CRM*) that auto-generate linked databases, pre-built views, and status automations in one click.
3. **Lack of Built-In Data Visualization & Retention Loops:** Users export tables to external tools for basic charts and lack motivation to maintain long-term workspace hygiene.
   - *Our Edge:* Combine native **Live Chart Blocks** with **Gamified Builder Progression** (streaks, quests, and template karma) to drive daily active retention.

---

## 7. Next Steps for Jules
- Run `/replica-pm` to generate `/docs/prd.md` with user stories and acceptance criteria.
- Run `/replica-architect` and `/replica-gamify` to design `/docs/architecture.md` and `prisma/schema.prisma`.
- Run `/replica-design` to establish `/docs/design-system.md` (Light/Dark tokens, typography, 8px spacing grid).
