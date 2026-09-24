---
status: final
updated: 2026-09-24
name: Ascent
description: Light-mode operations dashboard for a real-time multi-elevator simulator. From-scratch token set (no inherited UI system) built for a React 19 + Redux Toolkit frontend with zero prior styling.
colors:
  background: '#F8FAFC'
  foreground: '#1E293B'
  card: '#FFFFFF'
  card-foreground: '#1E293B'
  primary: '#1E40AF'
  on-primary: '#FFFFFF'
  secondary: '#3B82F6'
  on-secondary: '#FFFFFF'
  muted: '#E9EEF6'
  muted-foreground: '#475569'
  border: '#DBEAFE'
  ring: '#1E40AF'
  pending: '#D97706'
  on-pending: '#1F1300'
  open: '#15803D'
  on-open: '#FFFFFF'
  destructive: '#DC2626'
  on-destructive: '#FFFFFF'
typography:
  display:
    fontFamily: 'Plus Jakarta Sans'
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  heading:
    fontFamily: 'Plus Jakarta Sans'
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.3'
  body:
    fontFamily: 'Plus Jakarta Sans'
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.5'
  label:
    fontFamily: 'Plus Jakarta Sans'
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.03em
  floor-digit:
    fontFamily: 'Plus Jakarta Sans'
    fontSize: 15px
    fontWeight: '600'
    fontVariantNumeric: 'tabular-nums'
rounded:
  sm: 6px
  DEFAULT: 8px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '8': 32px
  '12': 48px
components:
  elevator-cabin:
    fill: '{colors.primary}'
    fill-open: '{colors.open}'
    foreground: '{colors.on-primary}'
    radius: '{rounded.md}'
  hall-call-button:
    idle-fill: '{colors.card}'
    idle-border: '{colors.border}'
    idle-foreground: '{colors.foreground}'
    pending-fill: '{colors.pending}'
    pending-foreground: '{colors.on-pending}'
    radius: '{rounded.sm}'
  door-control-button:
    fill: '{colors.card}'
    border: '{colors.border}'
    foreground: '{colors.foreground}'
    radius: '{rounded.sm}'
  connection-badge:
    connected-fill: '{colors.open}'
    connecting-fill: '{colors.pending}'
    disconnected-fill: '{colors.destructive}'
    radius: '{rounded.full}'
  status-chip:
    idle-fill: '{colors.muted}'
    idle-foreground: '{colors.muted-foreground}'
    transit-foreground: '{colors.primary}'
    open-foreground: '#14532D'
    radius: '{rounded.full}'
  destination-panel-button:
    idle-fill: '{colors.card}'
    idle-border: '{colors.border}'
    idle-foreground: '{colors.foreground}'
    current-fill: 'rgba(255,255,255,0.9)'
    current-foreground: '#14532D'
    radius: '{rounded.sm}'
  stat-strip:
    fill: '{colors.card}'
    border: '{colors.border}'
    value-foreground: '{colors.primary}'
    value-pending-foreground: '{colors.pending}'
    label-foreground: '{colors.muted-foreground}'
    radius: '{rounded.lg}'
---

## Brand & Style

Ascent is an operations-dashboard read on a physical system: the posture is Linear/Vercel/Stripe-style modern SaaS — flat surfaces, restrained color, information density over decoration — applied to a building's elevator bank instead of a product metrics board. The governing idea is **clarity-under-motion**: a reviewer watching a live demo must be able to read floor, direction, door state, and pending calls for three elevators at a glance, while cabins are physically sliding between floors on a 500ms tick. Every visual decision serves that legibility goal first; decoration is secondary and only added where it doesn't compete with it.

Light mode only. No glassmorphism, no gradients, no illustration — this is an instrument panel, not a marketing surface.

## Colors

Four-color semantic system, deliberately small so state reads unambiguously in motion:

- **Primary Blue (`#1E40AF`)** is the brand/structural color — elevator cabins in normal transit, primary buttons (Hall Call, Car Call selections), focus rings, the active-nav feel. This is "the system is working" blue.
- **Secondary Blue (`#3B82F6`)** is a lighter tint of the same hue, used only for de-emphasized structural elements (shaft rail lines, inactive floor separators) — never as a competing second brand color.
- **Pending Amber (`#D97706`)** means exactly one thing everywhere it appears: *a hall call is waiting to be served*. Used on the hall-call pending indicator and nowhere else — not on buttons, not decoratively. If a reviewer sees amber, a floor is waiting.
- **Open Green (`#16A34A`)** means *doors are open / connection is live*. Used on the elevator cabin fill when `doorState === 'OPEN'` and on the connection badge's `connected` state. Chosen distinctly from Pending Amber so "waiting" and "being served" are never visually confusable mid-demo.
- **Destructive Red (`#DC2626`)** is reserved for the disconnected connection-badge state. Not used anywhere else — there are no destructive actions in this product (PRD: no delete/cancel flows).
- **Background (`#F8FAFC`) / Card (`#FFFFFF`) / Foreground (`#1E293B`)** are the neutral base — a near-white canvas with pure-white elevated surfaces (shaft panel, destination panel) and slate-800 body text.
- **Muted (`#E9EEF6` bg / `#475569` fg)** is for secondary text and idle badges — floor numbers not currently in play, disabled-looking (but not truly disabled) affordances.
- **Border (`#DBEAFE`)** is a faint blue-tinted hairline — shaft cell divisions, card edges. Never black/gray; everything in this system is blue-tempered.

Do not introduce a fifth hue. If a new state needs color, reuse one of the four semantic colors by meaning (waiting → amber, active/positive → green, structural → blue, error → red) rather than adding one.

## Typography

Single family — **Plus Jakarta Sans** — at five weight/size roles: `display` (page title), `heading` (section labels like "Shaft A"), `body` (default UI text), `label` (all-caps-tracked micro-labels: "PENDING", "CONNECTING"), and `floor-digit` (the numeral inside every floor cell and cabin — `font-variant-numeric: tabular-nums` so floor numbers don't jitter in width as the cabin animates past them).

Body text sits at 15px, slightly below the usual 16px default, because this is a dense instrument-panel layout (three shafts × ten floors + control panels) where every row needs to fit without scrolling on a typical demo-share screen. `label` is used sparingly — state words and badges only, never body copy.

## Layout & Spacing

Dense dashboard scale: base unit `{spacing.2}` (8px), running 4/8/12/16/20/24/32/48px. The page is a centered column (max-width 1420px) with a header band (title + a "Building" stat strip — floors/elevators/pending — + connection badge) above a two-region board: a fixed-width Hall Call rail (240px) and the **Shaft View** (the elevator wells side by side, flexed to share remaining width). Each shaft column's own header (car id, status chip, Door Controls) and the rail's header share one `col-head` component at a fixed height, so a floor's rail row and its cell in every shaft line up at the same Y by construction, not by matching font metrics.

Floor rows inside each shaft are equal height, 58px tall (bumped from the original `{spacing.12}`/48px so the resting-position ring reads clearly), stacked floor 10 (top) to floor 1 (bottom) — the shaft is a literal vertical mirror of the building. Hall-call controls for a floor sit in the rail, one row per floor, aligned to the same 58px row height.

Destination Panel and Door Controls are **not** a separate docked/overlay block. The instant a cabin's doors open, its floor-cell — same in-flow element, same row height, never taller — becomes the Destination Panel's row of floor buttons in place of the cabin digit; Door Controls live in that shaft's `col-head`, always laid out there and toggled via `disabled`/`visibility` (never `display`), so no element's box ever grows, shrinks, or reflows a sibling when a door opens or closes. Shaft columns stay exactly equal width at all times (min-width 344px, sized to fit the 10-button floor-cell row without scrolling on a normal window); a local `overflow-x` on that one row is a safety net, not the expected path.

## Elevation & Depth

Nearly flat. Cards (Hall Call rail, shaft panel, stat strip) get a single shadow weight (`0 4px 12px rgba(30, 64, 175, 0.06), 0 1px 2px rgba(30, 64, 175, 0.05)`, blue-tinted at very low opacity — consistent with the border color) only to separate them from the page background, not to imply a z-axis hierarchy. No hover-lift, no heavy drop shadows — this is a panel, not a card-grid marketing page.

## Shapes

`{rounded.sm}` (6px) on interactive controls (hall-call buttons, door controls, destination-panel floor buttons) — crisp enough to read as "button," soft enough to not feel industrial. `{rounded.lg}` (12px, bumped from `{rounded.md}`) on containers (Hall Call rail, shaft panel, stat strip). `{rounded.full}` exclusively on the connection-status badge, the status chip, and the pending-indicator dot — pill/dot shapes are reserved for status, never used on actionable buttons, so shape itself signals "this is state, not a control."

## Components

- **Elevator cabin** — the animated unit inside a shaft column. `{colors.primary}` fill while doors are closed/transit, switches to `{colors.open}` fill the instant `doorState === 'OPEN'`. White (`on-primary`/`on-open`) floor-digit label centered inside. Position is driven by a CSS `transform: translateY()` transition (see EXPERIENCE.md `Component Patterns`). While idle with doors closed, the cabin also carries an inset white ring (never an outer glow, so it can't bleed into a neighboring floor-cell row) marking it as the car's resting position; the same floor-cell also carries a secondary tint/left-accent cue. The instant doors open, the cabin is hidden and its floor-cell becomes the Destination Panel row instead (see Layout & Spacing).
- **Hall call button** — one per floor per available direction (per FR-1, no ↑ at floor 10, no ↓ at floor 1). Idle: `card` fill, `border` outline, `foreground` arrow icon. Pending: fill flips to `{colors.pending}`, icon becomes `on-pending`. The fill-flip (not an added badge/dot) is the entire pending signal — keeps the dense hall-call rail legible without extra elements.
- **Status chip** — one per shaft column header, next to the car id. Text + fill reflect the car's state: neutral `muted` fill "Idle · Fl N", tinted-primary fill "↑/↓ Fl N" while moving, tinted-`open` fill "Doors Open · Fl N" while doors are open.
- **Door control button (Hold / Close)** — icon-only, `card` fill, `border` outline, `foreground` icon; identical visual weight to an idle hall-call button. Lives in the shaft column's `col-head`, always rendered there, only interactive while that car's doors are open.
- **Destination panel button** — one per floor `1..floors`, inline inside the open cabin's own floor-cell (not a separate panel). The car's own current floor renders lit/disabled rather than omitted, matching a real elevator car panel's convention of always showing every floor.
- **Connection badge** — small pill, top-right of the page. Fill color *is* the state: `{colors.open}` connected, `{colors.pending}` connecting, `{colors.destructive}` disconnected. No icon needed — color + one-word `label` text ("Connected" / "Connecting…" / "Disconnected") is sufficient at this size.
- **Stat strip** — small header group (Floors / Elevators / Pending) giving the header glanceable building-level context; `card` fill, same shadow weight as other containers. The Pending value uses `{colors.pending}`; the others use `{colors.primary}`.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use amber exclusively for "hall call pending" | Use amber for anything else (no warning toasts, no generic highlights) |
| Use green exclusively for "door open" / "connected" | Use green as a generic "success" color elsewhere |
| Keep the floor-digit font tabular so cabins don't jitter mid-animation | Let numeral width vary as elevators pass floors |
| Signal button vs. status through shape (`rounded.sm` vs `rounded.full`) | Use pill shapes on clickable buttons |
| One shadow weight everywhere elevation is used | Layer multiple shadow intensities to fake a z-hierarchy |
| Keep the palette to the four semantic hues (blue/amber/green/red) | Add a fifth accent color "for variety" |
