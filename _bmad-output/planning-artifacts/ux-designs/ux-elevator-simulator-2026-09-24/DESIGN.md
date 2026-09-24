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
  open: '#16A34A'
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

Dense dashboard scale: base unit `{spacing.2}` (8px), running 4/8/12/16/20/24/32/48px. Three-column layout at the top level: **Shaft View** (dominant, center — the three vertical elevator wells side by side) flanked conceptually by per-shaft **Destination Panel** and **Door Controls**, which appear docked to their cabin only while that cabin's doors are open (per Snapshot `doorState`, no separate visibility state).

Floor rows inside each shaft are equal height, `{spacing.12}` (48px) tall, stacked floor 10 (top) to floor 1 (bottom) — the shaft is a literal vertical mirror of the building. Hall-call controls for a floor sit in a slim rail to the left of the three shafts, one row per floor, aligned to the same 48px row height so a floor's hall-call row and its position across all three shafts line up on a single horizontal line.

## Elevation & Depth

Nearly flat. Cards (shaft panel, destination panel, door controls) get a single subtle shadow (`0 1px 2px rgba(30, 64, 175, 0.06)`, blue-tinted at very low opacity — consistent with the border color) only to separate them from the page background, not to imply a z-axis hierarchy. No hover-lift, no heavy drop shadows — this is a panel, not a card-grid marketing page.

## Shapes

`{rounded.sm}` (6px) on interactive controls (hall-call buttons, door controls, destination-panel floor buttons) — crisp enough to read as "button," soft enough to not feel industrial. `{rounded.md}` (8px) on containers (shaft panel, destination panel). `{rounded.full}` exclusively on the connection-status badge and the pending-indicator dot — pill/dot shapes are reserved for status, never used on actionable buttons, so shape itself signals "this is state, not a control."

## Components

- **Elevator cabin** — the animated unit inside a shaft column. `{colors.primary}` fill while doors are closed/transit, switches to `{colors.open}` fill the instant `doorState === 'OPEN'`. White (`on-primary`/`on-open`) floor-digit label centered inside. Position is driven by a CSS `transform: translateY()` transition (see EXPERIENCE.md `Component Patterns` for the behavioral rule) — the color and shape are static, only position and fill-color transition.
- **Hall call button** — one per floor per available direction (per FR-1, no ↑ at floor 10, no ↓ at floor 1). Idle: `card` fill, `border` outline, `foreground` arrow icon. Pending: fill flips to `{colors.pending}`, icon becomes `on-pending`. The fill-flip (not an added badge/dot) is the entire pending signal — keeps the dense hall-call rail legible without extra elements.
- **Door control button (Hold / Close)** — `card` fill, `border` outline, `foreground` icon; identical visual weight to an idle hall-call button (both are "a control you can press"), rendered only inside the open cabin's docked panel.
- **Connection badge** — small pill, top-right of the page. Fill color *is* the state: `{colors.open}` connected, `{colors.pending}` connecting, `{colors.destructive}` disconnected. No icon needed — color + one-word `label` text ("Connected" / "Connecting…" / "Disconnected") is sufficient at this size.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use amber exclusively for "hall call pending" | Use amber for anything else (no warning toasts, no generic highlights) |
| Use green exclusively for "door open" / "connected" | Use green as a generic "success" color elsewhere |
| Keep the floor-digit font tabular so cabins don't jitter mid-animation | Let numeral width vary as elevators pass floors |
| Signal button vs. status through shape (`rounded.sm` vs `rounded.full`) | Use pill shapes on clickable buttons |
| One shadow weight everywhere elevation is used | Layer multiple shadow intensities to fake a z-hierarchy |
| Keep the palette to the four semantic hues (blue/amber/green/red) | Add a fifth accent color "for variety" |
