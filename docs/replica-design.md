# Phase 4: UI/UX Design System (`/replica-design`) — Connected Workspace Platform

- **Reference Specs:** `/docs/replica-recon.md`, `/docs/prd.md`, `/docs/architecture.md`
- **Aesthetic Direction:** Calm Editorial Canvas ("Paper & Ink") + Tactile Block Affordances + Subtle Gamified Craft
- **Grid & Scaling:** Strict 8px Spatial Grid (`4px` micro-increments) with Fluid Light/Dark Semantic Tokens
- **Status:** Ready for `/replica-build` and `/replica-writer`

---

## 1. Design Philosophy & Visual Principles

1. **Content-First Editorial Calm:** The interface recedes behind the user's ideas. Borders are hairline (`1px`), shadows are whisper-soft, and pure `#000000` or `#FFFFFF` extremes are softened to reduce eye fatigue during long writing sessions.
2. **Progressive Disclosure:** Controls like block drag handles (`⋮⋮`), quick-add buttons (`+`), and database view filters appear on hover or keyboard focus (`/`, `Cmd+K`), keeping the resting canvas completely uncluttered.
3. **Tactile Spatial Hierarchy:** Surface elevation is communicated primarily through subtle tonal shifts (`bg-sidebar` vs. `bg-canvas` vs. `bg-elevated`) rather than heavy drop shadows.
4. **Opt-In Gamified Delight:** XP progress bars, daily streaks, and Builder Tier badges use refined metallic/jewel accents tucked cleanly into the sidebar footer and toast notifications—never interrupting typing flow.

---

## 2. Color System & Semantic Tokens

### 2.1 Core Surface, Ink & Border Tokens

| Semantic Token | Light Mode Hex | Dark Mode Hex | Usage |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#FFFFFF` | `#191919` | Primary document editor & database canvas |
| `--bg-sidebar` | `#F7F7F5` | `#202020` | Left navigation drawer & secondary panels |
| `--bg-elevated` | `#FFFFFF` | `#252525` | Popovers, `/` slash menu, modals, Kanban cards |
| `--bg-hover` | `#EFEFED` | `#2C2C2C` | Sidebar item hover, block action button hover |
| `--bg-selected` | `#E8F1FC` | `#1E324A` | Multi-block selection highlight & active tab |
| `--ink-primary` | `#37352F` | `#EBEBEB` | Primary body copy, headings, active controls |
| `--ink-secondary` | `#6B6A65` | `#9B9B9B` | Sidebar labels, table headers, timestamps |
| `--ink-muted` | `#9B9A97` | `#666666` | Placeholders (`Type '/' for commands...`), empty states |
| `--border-hairline` | `#E9E9E7` | `#2F2F2F` | Table gridlines, sidebar dividers, card outlines |
| `--border-focus` | `#2383E2` | `#4799EB` | Keyboard focus rings & active cell outlines |

### 2.2 Brand, Status & Local-First Sync Tokens

| Semantic Token | Light Mode Hex | Dark Mode Hex | Usage |
| :--- | :--- | :--- | :--- |
| `--accent-primary` | `#2383E2` | `#4799EB` | Primary CTA buttons, active links, checkboxes |
| `--accent-primary-hover` | `#1B6EC2` | `#5CA8F5` | Primary button hover state |
| `--status-saved` | `#0F7B6C` | `#4DAB9A` | Local-first sync indicator: `Saved` |
| `--status-syncing` | `#D9730D` | `#FFA344` | Sync indicator: `Syncing...` / queued delta |
| `--status-offline` | `#6B6A65` | `#9B9B9B` | Sync indicator: `Offline (Changes queued)` |
| `--status-danger` | `#E03E3E` | `#FF7369` | Delete actions, error toasts, downgrade warnings |

### 2.3 Relational Database Property Pill Palette (10 Colors)
Used for `SELECT`, `MULTI_SELECT`, and `STATUS` badges across Table, Kanban, and Calendar views:

| Color Name | Light Bg / Text | Dark Bg / Text |
| :--- | :--- | :--- |
| **Default Gray** | `#F1F1EF` / `#37352F` | `#373737` / `#EBEBEB` |
| **Brown** | `#F4EEEE` / `#64473A` | `#43322A` / `#D4B8AB` |
| **Orange** | `#FBECDD` / `#D9730D` | `#4A3420` / `#FFA344` |
| **Yellow** | `#FBF3DB` / `#DFAB01` | `#473D1E` / `#FFDC49` |
| **Green** | `#EDF3EC` / `#0F7B6C` | `#243D30` / `#4DAB9A` |
| **Blue** | `#E7F3F8` / `#0B6E99` | `#1F3947` / `#529CCA` |
| **Purple** | `#F6F3F9` / `#6940A5` | `#392B4A` / `#9A6DD7` |
| **Pink** | `#FAF1F5` / `#AD1A72` | `#4A2538` / `#E255A1` |
| **Red** | `#FDEBEC` / `#E03E3E` | `#4C2626` / `#FF7369` |

### 2.4 Gamification Tier Accents (`/replica-gamify`)

| Builder Tier | XP Range | Light Badge Bg / Text | Dark Badge Bg / Text | Accent Glow |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Apprentice Scribe** | `0 – 499 XP` | `#F1F1EF` / `#4B5563` | `#2D2D2D` / `#D1D5DB` | `#9CA3AF` (Slate) |
| **Tier 2: Systems Architect** | `500 – 2,499 XP` | `#E0F2FE` / `#0369A1` | `#16324A` / `#38BDF8` | `#0284C7` (Cobalt) |
| **Tier 3: Grandmaster Weaver** | `2,500+ XP` | `#FEF3C7` / `#B45309` | `#422D12` / `#FBBF24` | `#F59E0B` (Amber Gold) |

---

## 3. Typography System

### 3.1 Font Families (User-Selectable Page Font Style)
- **Default Sans (`--font-sans`):** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` (Crisp UI controls, databases, default documents).
- **Editorial Serif (`--font-serif`):** `'Newsreader', 'Lora', Georgia, serif` (Long-form essays, reading mode).
- **Technical Mono (`--font-mono`):** `'JetBrains Mono', 'Fira Code', monospace` (Code blocks, inline code, formulas, shortcut hints).

### 3.2 Type Scale & Hierarchy

| Role | Size | Line Height | Weight | Letter Spacing | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Page Title** | `40px` (`2.5rem`) | `48px` (`1.2`) | `700` (Bold) | `-0.025em` | Top-level document H1 title |
| **Heading 1** | `30px` (`1.875rem`) | `38px` (`1.27`) | `700` (Bold) | `-0.02em` | `/h1` major section header |
| **Heading 2** | `24px` (`1.5rem`) | `32px` (`1.33`) | `600` (SemiBold) | `-0.015em` | `/h2` sub-section header |
| **Heading 3** | `20px` (`1.25rem`) | `28px` (`1.4`) | `600` (SemiBold) | `-0.01em` | `/h3` minor section header |
| **Body Default** | `16px` (`1rem`) | `24px` (`1.5`) | `400` (Regular) | `0em` | Standard paragraph, list, and to-do blocks |
| **UI / Table Cell** | `14px` (`0.875rem`) | `20px` (`1.43`) | `400 / 500` | `0em` | Sidebar items, database cells, menus |
| **Caption / Meta** | `12px` (`0.75rem`) | `16px` (`1.33`) | `500` (Medium) | `0.01em` | Breadcrumbs, property headers, XP labels |
| **Micro Badge** | `11px` (`0.6875rem`) | `14px` (`1.27`) | `600` (SemiBold) | `0.03em` | Keyboard shortcut pills (`⌘K`, `/`), Tier tags |

---

## 4. Spatial Grid, Layout Dimensions & Elevation

### 4.1 8px Spacing Scale
All margins, paddings, and component gaps strictly follow multiples of `8px` (`4px` allowed for dense micro-elements like badges and icon-text gaps):
- `space-1`: `4px` (`0.25rem`) — Icon-to-label gap, inline badge padding
- `space-2`: `8px` (`0.5rem`) — Vertical gap between sibling blocks, compact button padding
- `space-3`: `12px` (`0.75rem`) — Kanban card padding, popover item padding
- `space-4`: `16px` (`1rem`) — Callout block padding, modal section spacing
- `space-6`: `24px` (`1.5rem`) — Modal outer padding, database header spacing
- `space-8`: `32px` (`2rem`) — Page header bottom margin
- `space-12`: `48px` (`3rem`) — Top canvas breathing room

### 4.2 Structural Shell Dimensions
- **Left Navigation Sidebar:** `240px` default width (resizable `200px–360px`, collapsible via `Cmd/Ctrl + \` to `0px` with hover edge trigger).
- **Top Breadcrumb & Action Bar:** `44px` fixed height (`position: sticky; top: 0; backdrop-filter: blur(8px)`).
- **Document Canvas Width:**
  - **Standard Reading Mode:** `720px` max-width centered with `96px` horizontal padding on desktop (`16px` on mobile).
  - **Full-Width Mode (Databases & Dashboards):** `100%` fluid width with `48px` horizontal padding.
- **Page Cover Banner:** `180px` height (`120px` on mobile) with `78px` overlapping page emoji/icon.

### 4.3 Border Radii & Elevation Shadows
- **Radii:**
  - `4px` (`rounded-sm`): Inline code, database property pills, checkboxes, block hover handles.
  - `6px` (`rounded-md`): Buttons, sidebar tree rows, slash menu items, input fields.
  - `8px` (`rounded-lg`): Kanban cards, callout blocks, chart containers, toast notifications.
  - `12px` (`rounded-xl`): Command palette (`Cmd+K`), Share/Publish popover, Pricing modal.
- **Elevation (Light / Dark):**
  - **Popover / Slash Menu (`--shadow-popover`):** `0 4px 16px rgba(15, 15, 15, 0.08), 0 0 0 1px var(--border-hairline)`
  - **Modal (`--shadow-modal`):** `0 12px 32px rgba(15, 15, 15, 0.16), 0 0 0 1px var(--border-hairline)`
  - **Kanban Card (`--shadow-card`):** `0 1px 2px rgba(15, 15, 15, 0.05), 0 0 0 1px var(--border-hairline)`

---

## 5. Core Component Specifications

### 5.1 Editable Block Wrapper (`BlockRenderer`)
- **Structure:** Flex row container with a `44px` left gutter (hidden on touch devices, accessible via mobile toolbar) containing `+` (insert block below) and `⋮⋮` (drag handle & block action menu).
- **States:**
  - **Resting:** Clean content only; zero borders or background fill.
  - **Hover:** Gutter icons (`+` and `⋮⋮`) fade in over `120ms` in `--ink-muted`; hovering the handle tints it `--ink-primary` with `--bg-hover`.
  - **Dragging:** Dragged block renders at `85%` opacity with `--shadow-popover`; drop target displays a `2px` solid `--accent-primary` horizontal indicator line (or vertical line when creating multi-column layouts).
  - **Multi-Selected:** Background fills with `--bg-selected` (`6px` radius).

### 5.2 Slash Command Palette (`SlashCommandMenu`)
- **Dimensions:** `320px` width, `360px` max-height with scrollable body and sticky category headers (`Basic Blocks`, `Database & Charts`, `Media & Advanced`).
- **Item Row (`44px` height):**
  - Left: `36x36px` rounded thumbnail box (`border: 1px solid var(--border-hairline)`) displaying block preview icon.
  - Center: Block title (`14px` Medium, `--ink-primary`) + 1-line description (`12px`, `--ink-secondary`).
  - Right: Markdown shortcut hint pill (`#`, `[]`, `>`) in `11px` `--font-mono`.
- **Keyboard Navigation:** First matching item highlighted by default (`--bg-hover`); `ArrowUp`/`ArrowDown` cycles selection; `Enter` transforms current empty block; `Escape` dismisses menu.

### 5.3 Multi-View Database Header & Views
- **View Switcher Bar:** Horizontal tab strip (`36px` height) with active bottom indicator (`2px` solid `--ink-primary`). Each tab displays layout icon + view name (`Table`, `Board`, `Calendar`, `Timeline`, `Gallery`) plus `+ Add view` button.
- **Filter & Sort Toolbar:** Appears below tabs when active; renders interactive pill chips (`Status is In Progress`, `Sort: Due Date ↑`) with `--bg-hover` fill and `+ Filter` / `+ Sort` triggers.
- **Kanban Card (`BOARD` layout):** `260px` column width, `8px` gap between cards. Card displays page icon + title (`14px` Medium), up to 3 visible property pills, assignee avatar (`20px`), and due date badge.

### 5.4 Local-First Sync & Gamification Widgets
- **Sync Status Pill (Topbar Right):** Compact `24px` height badge next to the `Share` button:
  - Green dot (`6px`) + `Saved` when IndexedDB outbox is empty.
  - Pulsing amber dot + `Syncing...` during batch delta flush.
  - Gray cloud-off icon + `Offline` when `navigator.onLine === false`.
- **Sidebar Gamification Footer (`BuilderStatusWidget`):**
  - Compact card at bottom of left sidebar (`margin: 8px`, `padding: 10px`, `border-radius: 8px`, `border: 1px solid var(--border-hairline)`).
  - Row 1: Tier Emblem + Tier Title (`Systems Architect`) + Streak Pill (`🔥 7d`).
  - Row 2: Thin `4px` XP progress bar (`--accent-primary` fill over `--bg-hover` track) with `1,240 / 2,500 XP` caption.
  - Clicking opens `Quest & Badge Popover`; hidden automatically if user disables `gamificationEnabled`.
- **XP Gain Toast (`XpToastNotification`):** Non-blocking `280px` floating toast at bottom-right (`16px` inset) that slides in for `2.5s` when completing a milestone (e.g., `+25 XP • Database Created`).

---

## 6. CSS Variables Implementation (`src/app/globals.css`)

Copy these design tokens directly into `src/app/globals.css` during `/replica-build`:

```css
@layer base {
  :root {
    --bg-canvas: #ffffff;
    --bg-sidebar: #f7f7f5;
    --bg-elevated: #ffffff;
    --bg-hover: #efefed;
    --bg-selected: #e8f1fc;

    --ink-primary: #37352f;
    --ink-secondary: #6b6a65;
    --ink-muted: #9b9a97;

    --border-hairline: #e9e9e7;
    --border-focus: #2383e2;

    --accent-primary: #2383e2;
    --accent-primary-hover: #1b6ec2;

    --status-saved: #0f7b6c;
    --status-syncing: #d9730d;
    --status-offline: #6b6a65;
    --status-danger: #e03e3e;

    --shadow-popover: 0 4px 16px rgba(15, 15, 15, 0.08), 0 0 0 1px var(--border-hairline);
    --shadow-modal: 0 12px 32px rgba(15, 15, 15, 0.16), 0 0 0 1px var(--border-hairline);
    --shadow-card: 0 1px 2px rgba(15, 15, 15, 0.05), 0 0 0 1px var(--border-hairline);
  }

  .dark {
    --bg-canvas: #191919;
    --bg-sidebar: #202020;
    --bg-elevated: #252525;
    --bg-hover: #2c2c2c;
    --bg-selected: #1e324a;

    --ink-primary: #ebebeb;
    --ink-secondary: #9b9b9b;
    --ink-muted: #666666;

    --border-hairline: #2f2f2f;
    --border-focus: #4799eb;

    --accent-primary: #4799eb;
    --accent-primary-hover: #5ca8f5;

    --status-saved: #4dab9a;
    --status-syncing: #ffa344;
    --status-offline: #9b9b9b;
    --status-danger: #ff7369;

    --shadow-popover: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--border-hairline);
    --shadow-modal: 0 12px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--border-hairline);
    --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--border-hairline);
  }

  body {
    background-color: var(--bg-canvas);
    color: var(--ink-primary);
    font-family: var(--font-sans, 'Inter', -apple-system, BlinkMacSystemFont, sans-serif);
    -webkit-font-smoothing: antialiased;
  }
}
