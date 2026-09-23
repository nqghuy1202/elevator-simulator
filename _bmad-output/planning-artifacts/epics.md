---
stepsCompleted: [1, 2, 3]
inputDocuments: ["_bmad-output/planning-artifacts/prds/prd-elevator-simulator-2026-09-23/prd.md", "_bmad-output/planning-artifacts/architecture/architecture-elevator-simulator-2026-09-23/ARCHITECTURE-SPINE.md", "docs/ARCHITECTURE.md"]
---

# Elevator Simulator - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Elevator Simulator, decomposing the requirements from the PRD and Architecture Spine (plus supplementary seed detail from `docs/ARCHITECTURE.md`) into implementable stories. No UX design contract exists for this project — it's a solo interview take-home test with a single occupant persona and an intentionally minimal UI (PRD §7).

## Requirements Inventory

### Functional Requirements

FR-1: Occupant can place a Hall Call from any floor — press ↑ (floors 1-9) or ↓ (floors 2-10); button absent where not applicable.
FR-2: Hall Call pending state is visible until serviced; ↑/↓ pending indicators per floor are tracked independently; repeat presses don't duplicate or reorder the request.
FR-3: Occupant can place a Car Call while inside an open-door Elevator; multiple Car Calls queue in a single visit.
FR-4: Occupant can hold the door open; each Hold press resets the Dwell Timer.
FR-5: Occupant can close the door immediately; cancels the remaining Dwell Timer.
FR-6: Dispatcher assigns each Hall Call under the SCAN/LOOK rule via the Nearest-Car Strategy.
FR-7: Unservable Hall Calls become Pending and are re-evaluated whenever any Elevator idles or reverses — never dropped.
FR-8: A moving Elevator stops only where its Stop Queue and Direction agree.
FR-9: Stop Queue insertion never causes overshoot (ordering invariant).
FR-10: Elevator and Dispatcher behavior is polymorphic (state pattern + strategy pattern), not conditional/switch-based.
FR-11: Elevator States form a real ≥2-level inheritance hierarchy (ElevatorState → MovingState → MovingUpState/MovingDownState, plus IdleState/DoorOpenState).
FR-12: Elevator's internal state (floor, direction, doorState, stopQueue) is encapsulated — mutated only via public commands or the state's own handlers.
FR-13: Connected clients receive Building state updates in real time (sub-second, every tick).
FR-14: Client renders Snapshots only — never computes Elevator/Building state itself.
FR-15: 3 Elevators operate concurrently and independently — one can't block, delay, or corrupt another.
FR-16: Building floor count and Elevator count are parameterized (config change, not code change).
FR-17: Client-side Building/UI state is managed via Redux Toolkit.
FR-18: Application can be built and run via Docker — backend + frontend, via `docker-compose up`.
FR-19: Frontend is served via Nginx in the containerized setup.

### NonFunctional Requirements

NFR-1: Correctness over polish — every SCAN/LOOK edge case (not just the PDF's worked example) must resolve correctly; this is the highest-weighted evaluation criterion.
NFR-2: OOP legibility — encapsulation, inheritance, and polymorphism must be identifiable by reading the code, without narration.
NFR-3: Reliability — no Hall Call or Car Call is ever silently lost (FR-7 is the load-bearing guarantee).
NFR-4: Performance — simulation tick rate (~500ms) must feel like continuous movement without overwhelming client re-renders.
NFR-5: Testability — dispatch logic and state transitions are unit-testable in isolation from WS/UI; `NearestCarStrategy` and each Elevator State's transitions ship with unit tests.
NFR-6: Deployability — a reviewer can get the full stack running locally from one documented command (or Docker).
NFR-7: UI simplicity is permitted, not a shortfall — minimal/unstyled UI is acceptable; time is not to be spent on visual polish.

### Additional Requirements

**Starter template:** Vite (`npm create vite@latest -- --template react-ts`) is the recommended frontend starter — create-react-app is deprecated. Impacts Epic 1 Story 1 (project scaffolding).

**Repo structure (from Architecture Spine):** npm workspace — root `package.json` with `backend`, `frontend`, `shared` as workspaces. `shared/` is backend-owned and is the single source of wire-contract types (`ElevatorSnapshot`, `BuildingSnapshot`, WS event payloads).

**Architecture invariants (AD-1..AD-8) that stories must respect:**
- AD-1: `domain/` has zero dependency on `ws/`, `server.ts`, React, or Redux; client never derives simulation state locally (client-side tween/interpolation of a Snapshot value for rendering smoothness is explicitly permitted, but must not feed back into Redux or app logic).
- AD-2: `Elevator`'s fields are mutated only via its own methods or its current `ElevatorState`'s handlers; each transition has exactly one designated writer; every public command (`assignHallCall`, `assignCarCall`, `openDoor`, `closeDoor`) returns a result indicating acceptance.
- AD-3: Every `buildingState` event fully replaces the Redux Snapshot slice (never merges); UI-only state lives in a separate slice/component state; the reducer drops any Snapshot whose `tick` sequence number isn't strictly greater than the stored one.
- AD-4: `shared/` is the only place wire-contract types are defined; `BuildingSnapshot` carries a monotonic `tick` sequence number; a `shared/` type PR must land with its backend call-site change in the same commit.
- AD-5: `Dispatcher` depends only on the `SchedulingStrategy` interface, never branches on concrete type; Car Call intentionally never touches `Dispatcher`/`SchedulingStrategy` (in-cabin only, no elevator-selection decision).
- AD-6: `assignHallCall` and `assignCarCall` insert through one shared `insertStop(floor)` method (direction-ordered, no-ops a floor equal to `currentFloor` while doors aren't closed, de-duplicates); IDLE-direction seeding rule (first insert sets Direction); removal is centralized through one `completeStop(floor)` method called only from the arrival handler.
- AD-7: `Building.tick()` ticks each Elevator (fixed order) then calls `Dispatcher.reevaluatePending()` exactly once, pull-based, at tick-end; no Elevator pushes to Dispatcher mid-loop; Pending Calls processed FIFO, elevators in fixed order, Strategy invoked fresh per call.
- AD-8: Elevators share no mutable state; `Building` iterates sequentially; `SchedulingStrategy`/`Dispatcher` read elevators via public read-only accessors, never live cross-Elevator access.

**Operational conventions (from Architecture Spine):**
- On WS `connect`, server immediately emits a full `buildingState` Snapshot — a joining/reconnecting client is never blank until the next tick.
- Frontend's Nginx container proxies WS/API traffic to the backend via Docker Compose service-name DNS (`proxy_pass http://backend:<port>`), never a hardcoded IP/`localhost`.
- No auth/session layer. No persistence — process memory only, restart resets the Building. No WS error envelope — invalid client actions are a silent server-side no-op.
- WS event names (client→server): `hallCall`, `carCall`, `doorHold`, `doorClose`. (server→client): `buildingState`.

**Pinned stack versions (Architecture Spine, web-verified 2026-09):** Node.js 24 LTS (24.21.0) · TypeScript ^5.9 (not 7.0.x) · React 19.3.0 · Vite 8.3.0 · Redux Toolkit 2.12.0 · react-redux 9.3.0 · Socket.IO 4.8.3 (server+client) · Vitest 5.0.1 · Nginx `1.30-alpine`.

**Supplementary seed detail (from `docs/ARCHITECTURE.md`, useful for AC precision):**
- `ElevatorSnapshot` fields: `id`, `currentFloor`, `direction`, `doorState`, `destinations[]`.
- `BuildingSnapshot` fields: `floors`, `elevators[]`, `pendingHallCalls[]`.
- Door dwell timer default ~3s; simulation tick ~500ms.
- Unit test scenarios called out for `NearestCarStrategy`: idle-nearest, moving-same-direction-ahead (accept), moving-opposite-direction (reject), all-elevators-ineligible (falls to Pending).
- A small integration test runs `Building.tick()` across multiple ticks and asserts the final Snapshot — no UI needed.

### UX Design Requirements

N/A — no UX design contract for this project. Single in-world persona (building occupant), UI intentionally minimal per PRD §7/NFR-7.

### FR Coverage Map

FR-1: Epic 2 - Hall Call button UI/interaction
FR-2: Epic 2 - Hall Call pending-state UI
FR-3: Epic 2 - Car Call UI/interaction
FR-4: Epic 2 - Door hold UI/interaction
FR-5: Epic 2 - Door close UI/interaction
FR-6: Epic 1 - Dispatcher SCAN/LOOK + Nearest-Car assignment
FR-7: Epic 1 - Pending Call re-evaluation
FR-8: Epic 1 - Moving Elevator stop rule
FR-9: Epic 1 - Stop Queue no-overshoot invariant
FR-10: Epic 1 - Polymorphic state/strategy dispatch
FR-11: Epic 1 - ElevatorState inheritance hierarchy
FR-12: Epic 1 - Elevator encapsulation
FR-13: Epic 2 - Real-time client updates (WS)
FR-14: Epic 2 - Client renders Snapshot only
FR-15: Epic 1 - 3 Elevators concurrent/independent
FR-16: Epic 1 - Parameterized floor/elevator count
FR-17: Epic 2 - Redux Toolkit client state
FR-18: Epic 3 - Docker build/run (backend+frontend)
FR-19: Epic 3 - Nginx-served frontend container

## Epic List

### Epic 1: Elevator Domain Core
Prove — via unit tests and a headless demo path — that dispatch logic and the Elevator state machine are correct under the SCAN/LOOK rule and structurally demonstrate OOP (encapsulation, inheritance, polymorphism). No UI dependency; this is the highest-weighted, highest-risk part of the grading, built and validated first.
**FRs covered:** FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-15, FR-16

### Epic 2: Real-time Web App
An occupant can use the real web app end-to-end: place Hall Calls and Car Calls, hold/close doors, and watch 3 Elevators move in real time across 10 floors, backed by Redux-managed client state. Builds on Epic 1's domain core over WebSocket.
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-13, FR-14, FR-17

### Epic 3: Containerized Delivery
A reviewer can bring up the entire stack with a single `docker-compose up`, frontend served through Nginx. Purely additive — touches only container/deploy files, no application logic.
**FRs covered:** FR-18, FR-19

## Epic 1: Elevator Domain Core

Prove — via unit tests and a headless demo path — that dispatch logic and the Elevator state machine are correct under the SCAN/LOOK rule and structurally demonstrate OOP (encapsulation, inheritance, polymorphism). No UI dependency; this is the highest-weighted, highest-risk part of the grading, built and validated first.

### Story 1.1: Elevator State Machine Foundation

As a building occupant,
I want an elevator's movement and door behavior to follow a correct, inspectable state machine,
So that its behavior is predictable and provably correct — not a tangle of conditionals.

**Acceptance Criteria:**

**Given** the npm workspace root (`backend`/`frontend`/`shared` per Architecture Spine) is scaffolded with Node 24 LTS, TypeScript ^5.9, and Vitest 5.0.1
**When** the `Elevator` class and `ElevatorState` hierarchy (`ElevatorState` abstract → `MovingState` abstract → `MovingUpState`/`MovingDownState`; plus `IdleState`, `DoorOpenState`) are implemented
**Then** `Elevator`'s fields (`currentFloor`, `direction`, `doorState`, `stopQueue`) are private, exposed only via public methods and a read-only `getSnapshot()` (FR-12, AD-2)
**And** `Elevator.tick()` dispatches to `this.state`'s handler with no `switch`/`if`-chain on state name (FR-10, AD-2)
**And** `MovingUpState`/`MovingDownState` share movement logic inherited from `MovingState`, overriding only direction-specific behavior — not duplicated in both leaf classes (FR-11)
**And** unit tests cover every (state, stopQueue, direction) transition deterministically, with no server/WS running (NFR-5)

### Story 1.2: Dispatch Engine — SCAN/LOOK Hall Call Assignment

As a building occupant,
I want my hall call to be assigned to an elevator only when it's idle or already headed my way,
So that elevators behave exactly like the classic worked example (floor 5, elevator going 1→10).

**Acceptance Criteria:**

**Given** `Dispatcher` holds a `SchedulingStrategy` reference (interface) and `NearestCarStrategy` is its one implementation
**When** a Hall Call arrives for a floor and direction
**Then** an Idle elevator, or one already moving in the requested direction with the floor still ahead, is eligible; `Dispatcher` never branches on `NearestCarStrategy`'s concrete type (FR-6, FR-10, AD-5)
**And** among eligible elevators, the nearest one (least distance to travel) is assigned
**And** a Hall Call ↑ at floor 5 is accepted by an elevator moving 1→10; a Hall Call ↓ at floor 5 is NOT accepted by that same elevator (the PRD's worked example, FR-6)
**And** Car Call never touches `Dispatcher`/`SchedulingStrategy` at all — it's handled directly on `Elevator` (AD-5)
**And** unit tests cover: idle-nearest, moving-same-direction-ahead (accept), moving-opposite-direction (reject) — per `docs/ARCHITECTURE.md` §9 scenarios

### Story 1.3: Pending Call Re-evaluation

As a building occupant,
I want my hall call to be remembered and retried once an elevator frees up, even if none could serve it immediately,
So that my request is never silently dropped.

**Acceptance Criteria:**

**Given** a Hall Call has no eligible elevator at request time
**When** `Dispatcher.handleHallCall` runs
**Then** the call is added to `pendingCalls`, never discarded (FR-7)
**And** `Building.tick()` ticks every Elevator first in fixed order, then calls `Dispatcher.reevaluatePending()` exactly once at tick-end — never from inside an Elevator's state-transition handler, and no Elevator pushes a callback to Dispatcher mid-loop (AD-7)
**And** `reevaluatePending` processes Pending Calls in FIFO arrival order, invoking the Strategy fresh per call, so results are reproducible for the same input (AD-7)
**And** a unit test proves the "all elevators ineligible → pending → later reassigned on reversal" scenario end-to-end across multiple ticks

### Story 1.4: Stop Queue Integrity

As a building occupant,
I want my hall call and car call stops visited in the correct order without the elevator overshooting or skipping my floor,
So that I'm never stranded or bypassed.

**Acceptance Criteria:**

**Given** an elevator with an active `stopQueue`
**When** `assignHallCall` or `assignCarCall` adds a floor
**Then** both call the same single `insertStop(floor)` method — no second insertion path exists (FR-9, AD-6)
**And** `insertStop` inserts in position consistent with current `Direction`; when the queue is empty and `Direction === 'IDLE'`, the first insert sets `Direction`, and further same-tick inserts order relative to it (AD-6)
**And** `insertStop` no-ops a floor equal to `currentFloor` while `doorState !== 'CLOSED'`, and de-duplicates an already-queued floor (AD-6)
**And** a moving elevator stops only where `stopQueue` and `Direction` agree — floors that don't match are skipped until a reversal makes them reachable (FR-8)
**And** exactly one method, `completeStop(floor)`, called only from the arrival handler, removes queue entries — no other method (including `closeDoor`) does (AD-6)

### Story 1.5: Multi-Elevator Building Coordination

As a building occupant,
I want all 3 elevators to run independently and in parallel, and the building to support a configurable floor/elevator count,
So that the simulation scales correctly and no elevator interferes with another.

**Acceptance Criteria:**

**Given** a `Building` holding 3 `Elevator` instances and a `Dispatcher`
**When** `Building.tick()` runs
**Then** each `Elevator` instance owns only its own fields; no Elevator's transition reads or writes another's state (FR-15, AD-8)
**And** `SchedulingStrategy`/`Dispatcher` read elevators only via public read-only accessors — never live cross-Elevator access (AD-8)
**And** changing floor count (10) or elevator count (3) is a configuration change, not a code change to dispatch/state logic (FR-16)
**And** a unit test instantiates `Building` with a different floor/elevator count and confirms dispatch/state logic behaves identically in shape

## Epic 2: Real-time Web App

An occupant can use the real web app end-to-end: place Hall Calls and Car Calls, hold/close doors, and watch 3 Elevators move in real time across 10 floors, backed by Redux-managed client state. Builds on Epic 1's domain core over WebSocket.

### Story 2.1: Backend WebSocket Adapter & Shared Wire Contract

As a building occupant,
I want the backend to broadcast the building's real-time state over WebSocket using one shared, versioned contract,
So that my browser always sees the true, current elevator positions.

**Acceptance Criteria:**

**Given** the `shared` workspace package (backend-owned) defines `ElevatorSnapshot`, `BuildingSnapshot` (with a monotonic `tick` sequence number), and WS event payload types
**When** `ws/socketHandlers.ts` wraps Epic 1's `Building`/`Dispatcher` for Socket.IO 4.8.3
**Then** `ws/` imports only from `domain/` and `shared/` — never the reverse (AD-1)
**And** client→server events `hallCall`, `carCall`, `doorHold`, `doorClose` map 1:1 to `Elevator`/`Dispatcher` public commands; server→client `buildingState` broadcasts the full `BuildingSnapshot` every tick (~500ms) (FR-13)
**And** on a client's `connect` event, the server immediately emits a full `buildingState` Snapshot — a joining/reconnecting client is never blank until the next tick
**And** an invalid client action (e.g. Car Call to current floor) is a silent server-side no-op, never a thrown/emitted error

### Story 2.2: Frontend Scaffold + Redux Snapshot Store

As a building occupant,
I want the web app to receive and store the live building snapshot via Redux,
So that the UI has one always-consistent source of truth and never drifts from the server.

**Acceptance Criteria:**

**Given** a Vite + React 19.3 + TypeScript ^5.9 frontend scaffolded (`npm create vite@latest -- --template react-ts`) inside the npm workspace, with Redux Toolkit 2.12 + react-redux 9.3
**When** `useBuildingSocket.ts` connects to the backend and receives `buildingState` events
**Then** the client never computes Elevator/Building state itself — it only stores and renders the latest Snapshot (FR-14, AD-1)
**And** every `buildingState` event fully replaces the `buildingSlice` (never merges); the reducer drops any Snapshot whose `tick` sequence number isn't strictly greater than the one stored (AD-3)
**And** UI-only state (e.g. which panel is expanded) lives in a separate slice/component state that a Snapshot replace never touches (AD-3)
**And** all Snapshot/UI interaction state lives in the Redux store, not ad hoc component state passed through props (FR-17)

### Story 2.3: Hall Call & Pending Indicator UI

As a building occupant,
I want to press ↑/↓ at any floor and see a pending indicator light up until an elevator arrives,
So that I know my request was registered.

**Acceptance Criteria:**

**Given** the `FloorHallPanel` component for a floor 1-10
**When** I press ↑ (unavailable at floor 10) or ↓ (unavailable at floor 2-10, i.e. absent at floor 1)
**Then** a `hallCall` event is emitted and the floor's pending indicator for that direction lights up immediately (FR-1)
**And** ↑ and ↓ pending indicators on the same floor are tracked independently — servicing one doesn't clear the other (FR-2)
**And** pressing an already-pending direction again does not duplicate the request or change its position in the assignment order (FR-2)
**And** the indicator clears only when an elevator opens its doors at that floor for that direction (per the next Snapshot)

### Story 2.4: Car Call UI

As a building occupant,
I want to select my destination floor once inside an open-door elevator,
So that it takes me there.

**Acceptance Criteria:**

**Given** an `ElevatorCar`/`DestinationPanel` for an elevator currently in `DoorOpenState`
**When** I select a destination floor (any floor 1-10 except the current one)
**Then** a `carCall` event is emitted for that elevator and floor (FR-3)
**And** I can select multiple destinations in one visit before the doors close, each queued in current-direction order
**And** the panel only appears while that elevator's doors are open (per Snapshot `doorState`)

### Story 2.5: Door Hold/Close UI

As a building occupant,
I want to hold the door open or close it immediately,
So that I control my boarding time.

**Acceptance Criteria:**

**Given** an elevator in `DoorOpenState`
**When** I press Hold (◁▷)
**Then** a `doorHold` event resets the Dwell Timer server-side; doors do not auto-close while held (FR-4)
**When** I press Close (▷◁)
**Then** a `doorClose` event cancels the remaining Dwell Timer and the elevator begins closing on the next tick (FR-5)
**And** both controls are visible only while that elevator's doors are open (per Snapshot `doorState`)

## Epic 3: Containerized Delivery

A reviewer can bring up the entire stack with a single `docker-compose up`, frontend served through Nginx. Purely additive — touches only container/deploy files, no application logic.

### Story 3.1: Backend Container

As a reviewer,
I want the backend to run in a Docker container,
So that I don't need Node.js installed locally to evaluate it.

**Acceptance Criteria:**

**Given** a `backend/Dockerfile` building the Node.js 24 LTS backend workspace package
**When** the image is built and run standalone
**Then** the backend starts, serves WebSocket on its configured port, with no manual `npm install` step outside the image (FR-18)
**And** the image only copies what `backend` + `shared` need — no frontend source in the backend image

### Story 3.2: Frontend Container (Nginx) + Compose Orchestration

As a reviewer,
I want to bring up the entire stack with one `docker-compose up`,
So that I can evaluate the working app with zero manual setup.

**Acceptance Criteria:**

**Given** a `frontend/Dockerfile` that builds the Vite production bundle and serves it via `nginx:1.30-alpine`, plus a root `docker-compose.yml` (using the `docker compose` CLI plugin, no `version:` key)
**When** `docker-compose up` runs
**Then** the frontend Nginx container proxies WS/API traffic to the backend via Compose's internal service-name DNS (`proxy_pass http://backend:<port>`) — never a hardcoded IP/`localhost` (FR-19)
**And** opening the frontend's exposed port in a browser reaches a fully working app — Hall Call, Car Call, Door Control, and real-time sync all functional, matching Epic 2's behavior exactly
**And** the README documents this as the one-command path to run the whole stack (NFR-6)
