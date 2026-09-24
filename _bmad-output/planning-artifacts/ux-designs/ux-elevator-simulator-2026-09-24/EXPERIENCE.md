---
name: Ascent
status: final
sources:
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/prd-elevator-simulator-2026-09-23/prd.md'
updated: 2026-09-24
---

# Ascent — Experience Spine

## Foundation

Single-surface responsive web app. React 19 + Redux Toolkit + Vite, no component library or CSS framework — every component in `DESIGN.md.Components` is hand-built from scratch against the token set. `DESIGN.md` is the visual identity reference; this spine is the behavior. One shared `Building` (10 floors, 3 elevators), no auth, no multi-tenancy, no persistence — a server restart resets state and the client re-syncs from the next Snapshot. All rendering is Snapshot-driven (FR-13): the client never computes elevator position, direction, or door state itself, it only ever displays the latest `BuildingSnapshot` the server pushed.

Primary audience per the PRD: an interview reviewer running a live demo, secondarily reading source. The experience bar is **demo-clarity**, not consumer polish or accessibility compliance (neither required by NFR-7) — but nothing here should be gratuitously worse for that goal.

## Information Architecture

One surface — there is no navigation, no routing. The page is a single dashboard with three regions:

| Region | Contains | Notes |
|---|---|---|
| Header | App title, connection badge | Always visible, `{spacing.4}` padding |
| Hall Call rail | One row per floor (10→1, top to bottom), ↑/↓ buttons + pending fill-state | Left column, fixed width |
| Shaft View | Three vertical shaft columns (one per elevator), cabins positioned by `currentFloor` | Center, dominant region |
| Docked panel | Destination Panel + Door Controls for a cabin | Appears attached to that cabin's column only while `doorState === 'OPEN'`; absent otherwise — no placeholder/empty state, the column is just narrower |

IA closure: every stated need (place a hall call, watch elevators move, call a car destination, hold/close a door, see connection health) has exactly one region that delivers it, and the Key Flow below visits all four regions in one continuous read.

## Voice and Tone

Minimal microcopy — this is a control panel, not a conversational product. Brand voice lives in `DESIGN.md.Brand & Style` (instrument-panel, not marketing).

| Do | Don't |
|---|---|
| "Connecting…" / "Connected" / "Disconnected" | "We're getting things ready!" |
| "Floor 3" | "3F" or "Level 3" (match FR language exactly) |
| Bare numerals inside cabins and hall-call buttons, no units | "Fl. 3" |
| Silence when nothing is happening | Toasts/banners for routine, expected state changes |

## Component Patterns

Behavioral only — visual specs live in `DESIGN.md.Components`.

| Component | Maps to | Behavioral rules |
|---|---|---|
| Connection badge | New — header | Reflects `uiSlice.connectionStatus` 1:1 (`connecting`/`connected`/`disconnected`). No retry button — the socket layer already auto-reconnects; the badge is informational only. |
| Hall call button | `FloorHallPanel` (restyled) | One per available direction per floor (no ↑ at floor 10, no ↓ at floor 1, per FR-1). Click emits `hallCall`; idempotent — repeat clicks while already pending are visually inert (fill doesn't "flash" or duplicate). Fill state driven solely by `snapshot.activeHallCalls` (FR-2) — no local pending-click optimism, since the tick is ~500ms and optimistic state would need reconciling against the next Snapshot for no real benefit. |
| Elevator cabin | `ElevatorCar` (restyled + repositioned into Shaft View) | Vertical position = `currentFloor` mapped to the shaft's row grid, applied via CSS `transform: translateY()` with a `transition: transform 480ms linear` (slightly under the 500ms tick so a new position is always fully settled before the next tick can move it again) — a pure CSS approach, not GSAP, so it survives React's per-tick re-render without needing imperative animation cleanup. Fill color swaps `primary`→`open` immediately (no transition) the tick `doorState` becomes `OPEN` — the color change is a state cut, not a tween, so open/closed is never visually ambiguous mid-fade. |
| Destination Panel | `DestinationPanel` (restyled, now docked to its cabin) | Visible only while that cabin's doors are open (existing rule, unchanged). Floor buttons for every floor except `currentFloor`. Multiple selections in one open-door visit all queue (FR-3) — clicking a second floor doesn't replace the first. |
| Door Controls | `DoorControls` (restyled, docked alongside Destination Panel) | Hold and Close, visible only while doors are open (FR-4/FR-5, unchanged). Both are momentary actions — no pressed/toggled visual state to track, since the server alone owns the dwell timer. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Initial load (`snapshot === null`) | Whole dashboard | Shaft View and Hall Call rail render their static grid (floor rows, empty shafts) immediately — geometry never waits on data. Cabins simply aren't drawn until the first Snapshot arrives. No skeleton loaders; the grid *is* the loading state. |
| Connecting | Header | Connection badge: `pending`-fill, "Connecting…" |
| Connected | Header | Connection badge: `open`-fill, "Connected" |
| Disconnected (mid-session) | Header | Connection badge: `destructive`-fill, "Disconnected". Last-known Snapshot stays on screen (frozen, not cleared) — better to show slightly stale truth than blank the whole dashboard PRD-style (server restart wipes state; a hard clear would fight the eventual reconnect Snapshot anyway, since `connect` already resets client state per `useBuildingSocket.ts`). |
| Hall call pending | Hall Call rail | That floor's directional button fill flips to `pending`; clears the instant an elevator opens doors there for that direction (FR-2), driven purely by `activeHallCalls` membership. |
| Door open | Shaft View + Docked panel | Cabin fill flips to `open`; Destination Panel + Door Controls mount for that cabin. |
| Door closed / in transit | Shaft View | Docked panel unmounts; cabin fill reverts to `primary`; cabin begins tweening toward its next `currentFloor`. |

## Interaction Primitives

**Mouse/touch only** — no keyboard shortcuts defined; this is a click-driven control panel, not a power-user tool (PRD has no such requirement, and the reviewer audience interacts via mouse during a screen-shared demo).

- Click a hall-call arrow → `emitHallCall(floor, direction)`.
- Click a destination floor inside an open cabin → `emitCarCall(elevatorId, floor)`.
- Click Hold (◁▷) → `emitDoorHold(elevatorId)`. Click Close (▷◁) → `emitDoorClose(elevatorId)`.
- All three emits are fire-and-forget from the UI's perspective — no optimistic local state, no disabled-while-pending affordance; the next ~500ms Snapshot is the only source of truth for whether the action "took."

**Banned:** drag interactions, double-click semantics, hover-only affordances (this is demoed via screen-share and occasionally touch — hover must never be required to discover or use a control).

## Accessibility Floor

WCAG compliance work is explicitly out of scope (NFR-7) — this is a floor of baseline decency that costs near-zero extra implementation effort, not a compliance program:

- Semantic HTML (`<button>` for every control, not clickable `<div>`s) — free correctness, not "accessibility work."
- Icon-only controls (hall-call arrows, door hold/close) get an `aria-label` naming the action ("Call elevator up from floor 3", "Hold door") — the icon is decorative, the label carries meaning.
- Visible focus ring using `{colors.ring}` — helps screen-share viewers and keyboard users alike see where focus is, at zero design cost (browser default retained, just recolored to match the token).
- Color is never the *only* signal: pending hall-call buttons also change fill (not just add a dot), cabin open/closed is paired with the docked panel appearing/disappearing, connection badge pairs color with a text label — so state still reads if a viewer is colorblind or the demo is projected on a washed-out screen.

## Key Flows

### Flow 1 — Live demo walkthrough (Alex, interview reviewer, screen-sharing the running stack)

1. Alex opens the app. The Shaft View and Hall Call rail render immediately as an empty grid; header shows the connection badge in `pending`-fill: "Connecting…".
2. Within a tick, the badge flips to `open`-fill: "Connected" — the first `BuildingSnapshot` arrives and three cabins appear in their shafts at their current floors.
3. Alex clicks the ↑ hall-call button at floor 3. It immediately flips to `pending`-fill amber.
4. The nearest idle cabin begins sliding toward floor 3 — Alex watches it glide smoothly down/up the shaft column, one 480ms tween per tick, tabular floor digits ticking cleanly with no jitter.
5. The cabin arrives at floor 3; its fill cuts from blue to green as doors open. Floor 3's hall-call button simultaneously reverts from amber to idle — both changes land in the same Snapshot, reinforcing that one server-side event caused both.
6. The Destination Panel and Door Controls dock onto that cabin's column. Alex clicks floor 8.
7. Alex clicks Hold — the door stays open past its normal dwell (Alex can see the docked panel doesn't disappear on schedule). Alex then clicks Close — doors shut immediately, panel undocks, cabin fill reverts to blue and begins tweening toward floor 8.
8. **Climax:** while the cabin is mid-transit, Alex opens a second browser tab side-by-side. Both tabs show the identical cabin position, mid-tween, in the same visual state — no flicker, no divergence, no re-sync delay. The real-time sync guarantee (FR-13/FR-14) is visible, not just asserted in code.

Failure: WebSocket drops mid-demo → badge flips to `destructive`-fill "Disconnected", last Snapshot freezes in place (cabins stop animating but stay visible, not blanked) until the socket auto-reconnects and the badge/Snapshot resume live.
