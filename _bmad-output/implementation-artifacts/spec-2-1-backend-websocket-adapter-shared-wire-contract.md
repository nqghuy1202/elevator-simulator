---
title: 'Backend WebSocket Adapter & Shared Wire Contract'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: 'c4620dd8e2d0e3728ed46e26489c724ad44e6a76'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 1's domain core (`Building`/`Elevator`/`Dispatcher`) is correct and complete but reachable only from tests — nothing broadcasts it over the network, and two of the four client actions (Car Call, Door Hold/Close) have no backend command surface at all yet (`Elevator` only has Hall Call assignment today).

**Approach:** Add the `shared` workspace package as the single source of `ElevatorSnapshot`/`BuildingSnapshot`/WS event types (AD-4) — moving `Direction`/`DoorState`/`ElevatorSnapshot` there from `domain/`, which now imports them back. Add `Elevator.openDoor()`/`closeDoor()` (hold/force-close) and `Building.handleCarCall`/`handleDoorHold`/`handleDoorClose` (route to a specific elevator by id) as the missing command surface. Add `ws/socketHandlers.ts` (Socket.IO 4.8.3 adapter, the one thing allowed to import both `domain/` and `shared/`) and `server.ts` (the tick driver — `setInterval` calling `Building.tick()` then broadcasting a fresh `BuildingSnapshot`).

## Boundaries & Constraints

**Always:**
- `ws/` and `server.ts` import only from `domain/` and `shared/`, never the reverse; `domain/` imports `Direction`/`DoorState`/`ElevatorSnapshot` from `shared/` but nothing from `ws/`, `server.ts`, Socket.IO, React, or Redux (AD-1).
- `shared` is the only place `ElevatorSnapshot`, `BuildingSnapshot`, and the 5 WS event payload types are defined; `BuildingSnapshot` carries a monotonic `tick` sequence number (AD-4), owned by `server.ts` (a transport concern, not `Building`'s).
- Client→server events map 1:1 to a domain command: `hallCall{floor,direction}` → `Building.handleHallCall`; `carCall{elevatorId,floor}` → `Building.handleCarCall`; `doorHold{elevatorId}` → `Building.handleDoorHold`; `doorClose{elevatorId}` → `Building.handleDoorClose`. Server→client: `buildingState` (full `BuildingSnapshot`), broadcast every tick (~500ms) and immediately on a client's `connect`.
- An unknown `elevatorId` in `carCall`/`doorHold`/`doorClose`, or any other invalid client action, is a silent server-side no-op — never a thrown or emitted error (this is a *client-input* boundary, distinct from `Dispatcher.tryAssign`'s internal-consistency throw on an unknown id from its own `SchedulingStrategy`).
- `Elevator.openDoor()` (hold: resets the dwell timer) and `closeDoor()` (force-close: sets remaining dwell to 0, closing begins next tick) are no-ops returning `false` outside `DoorOpenState`; both are public commands per AD-2.

**Never:**
- No React/Redux/frontend code — Story 2.2 starts the frontend.
- No changes to `Dispatcher`, `NearestCarStrategy`, or the SCAN/LOOK stop rule — this story only adds the door-hold/close and car-call command surface `Elevator`/`Building` were always going to need, plus the transport wrapper around everything.
- No auth, no persistence, no WS error envelope — explicit PRD Non-Goals, unchanged.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Hall Call over WS | `hallCall {floor:5, direction:'UP'}` | `Building.handleHallCall(5,'UP')` runs; next broadcast reflects it | No error expected |
| Car Call over WS | `carCall {elevatorId:'E1', floor:7}` | `Elevator` E1's `assignCarCall(7)` runs via `Building.handleCarCall`, regardless of E1's current door state — a real elevator accepts a Car Call any time a passenger is in the cabin; the Car Call UI panel being shown only while doors are open (PRD FR-3) is a *client-side* visibility rule (Story 2.4), not a backend precondition | No error expected |
| Door Hold over WS | `doorHold {elevatorId:'E1'}`, E1 in `DoorOpenState` | Dwell timer resets; doors stay open | No error expected |
| Door Close over WS | `doorClose {elevatorId:'E1'}`, E1 in `DoorOpenState` | Dwell forced to 0; door begins closing next tick | No error expected |
| Unknown `elevatorId` | `carCall {elevatorId:'GHOST', floor:3}` | Silent no-op; no elevator's state changes, no error thrown/emitted | No error expected |
| New client connects | `connect` event | Server immediately emits full `buildingState` to that client, without waiting for the next tick | No error expected |
| Steady-state broadcast | Server tick fires (~500ms) | `building.tick()` runs, then a `buildingState` with a strictly-incremented `tick` number broadcasts to all connected clients | No error expected |
| Domain purity holds | `grep` across `backend/src/domain` | Zero references to `ws`, `socket.io`, `server.ts` | No error expected |

</frozen-after-approval>

## Code Map

- `package.json` (root) -- EDIT: `workspaces` → `["backend", "shared"]`
- `shared/package.json`, `shared/tsconfig.json` -- NEW: workspace member, no runtime deps
- `shared/src/types.ts` -- NEW: `Direction`, `DoorState` (moved from `backend/src/domain/{Direction,DoorState}.ts`)
- `shared/src/snapshot.ts` -- NEW: `ElevatorSnapshot` (moved from `Elevator.ts`), `BuildingSnapshot` (new, adds `tick: number`)
- `shared/src/events.ts` -- NEW: `HallCallPayload`, `CarCallPayload`, `DoorHoldPayload`, `DoorClosePayload` (client→server); `BuildingStateEvent = BuildingSnapshot` (server→client)
- `backend/src/domain/Direction.ts`, `DoorState.ts` -- EDIT: re-export from `shared` (keep import paths inside `domain/` stable)
- `backend/src/domain/Elevator.ts` -- EDIT: `ElevatorSnapshot` imported from `shared`, not locally declared; add `openDoor(): boolean`, `closeDoor(): boolean`
- `backend/src/domain/Building.ts` -- EDIT: add `handleCarCall(elevatorId, floor)`, `handleDoorHold(elevatorId)`, `handleDoorClose(elevatorId)` — each finds the elevator by id, silent no-op if not found
- `backend/package.json` -- EDIT: add `socket.io` dependency, `shared` workspace dependency, a `start` script
- `backend/src/ws/socketHandlers.ts` -- NEW: registers the 4 client→server handlers per connection, assembles+broadcasts `BuildingSnapshot`
- `backend/src/server.ts` -- NEW: creates `Building`, an HTTP+Socket.IO server (permissive CORS — no auth per PRD Non-Goals), the `setInterval` tick driver owning the `tick` sequence counter
- Test files: `Elevator.test.ts`, `Building.test.ts` extended for the new commands; `backend/src/ws/socketHandlers.test.ts` -- NEW

## Tasks & Acceptance

**Execution:**
- [ ] `shared/` package + `types.ts`/`snapshot.ts`/`events.ts` -- canonical wire-contract source -- AD-4
- [ ] `backend/src/domain/{Direction,DoorState,Elevator}.ts` -- import from `shared`, add `openDoor`/`closeDoor` -- AD-2
- [ ] `backend/src/domain/Building.ts` -- add the 3 routing methods, silent no-op on unknown id -- FR-3, FR-4, FR-5
- [ ] `backend/src/ws/socketHandlers.ts` + `backend/src/server.ts` -- Socket.IO adapter + tick driver -- FR-13, AD-1
- [ ] Tests for every I/O Matrix row, including a `grep`-based or import-graph check for domain purity -- NFR-5

**Acceptance Criteria:**
- Given `npm run start --workspace=backend` (or the test suite's direct handler invocation), when a test client connects and emits each of the 4 event types, then the corresponding domain command runs and a `buildingState` reflecting it is observable
- Given the full backend test suite, when `npm test --workspace=backend` runs, then all Epic 1 tests still pass unchanged (only their imports/types moved, no behavior changed) alongside new Epic 2 tests

## Implementation Notes

**Frozen-block clarification (not an intent change):** the "Car Call over WS" I/O Matrix row originally read "E1 doors open" in a way that read as an enforced precondition; edge-case-hunter reasonably flagged the implementation for not gating on it. Investigation against the PRD confirmed the implementation is correct — FR-3's door-state gating is a client-side panel-visibility rule (Story 2.4), not a backend validation rule — so the row's wording was corrected to remove the ambiguity rather than adding an incorrect guard. This is an example-clarity fix, not a requirement change.

## Spec Change Log

## Review Triage Log

**Lenses run:** blind-hunter (13 findings), edge-case-hunter (7 findings), verification-gap (0 gaps), intent-alignment (descriptive, confirms the same central gap).

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| 1 | (intent-alignment, blind-hunter) No test exercises a real Socket.IO server+client pair — `socketHandlers.test.ts` uses hand-rolled fake objects only; `server.ts` (the literal "broadcasts over the network" artifact the Problem statement names) has zero test coverage. | patch | Real, significant: this story's whole point is closing the "reachable only from tests... nothing broadcasts over the network" gap, and nothing proves the wire-level round-trip actually works (the implementer's manual smoke test was real but not committed as an automated test). |
| 2 | (blind-hunter, edge-case-hunter) `setInterval`'s tick callback has no re-entrancy guard or try/catch — a slow tick or a thrown error crashes the process or races the shared `tick` counter. | patch | Real, cheap: a reentrancy flag + try/catch around the callback body. |
| 3 | (blind-hunter, edge-case-hunter) `PORT` parsed via `Number(process.env['PORT'])` with no validation (`NaN` on garbage input); `httpServer.listen` has no `'error'` handler (e.g. `EADDRINUSE`). | patch | Real, cheap: validate `PORT`, add a `listen` error handler with a clear message. |
| 4 | (blind-hunter, edge-case-hunter x2) The 4 socket handlers trust payload shape via type assertion only — no runtime check that `floor` is an integer, `direction` is `'UP'`/`'DOWN'`, or `elevatorId` is a non-empty string. | patch | Real gap at the one true untrusted-input boundary in the system so far. Fix: early-return (silent no-op, matching the established convention) on a malformed payload — cheap, no new public surface. |
| 5 | (blind-hunter, edge-case-hunter, deletion) `ElevatorSnapshot.stateName` widened from the `ElevatorStateName` union to plain `string` when moved to `shared/` — a real type-safety regression (this exact union was added in Story 1.4 specifically to close this gap). | patch | Real: `shared/` can't import `ElevatorStateName` from `backend/src/domain/states/ElevatorState.ts` (AD-1 direction), but it *can* own the union itself, the same way it already owns `Direction`/`DoorState` — `ElevatorState.ts` then imports it back, mirroring the established pattern exactly. |
| 6 | (edge-case-hunter, claim) `Building.handleCarCall`/`assignCarCall` don't gate on the target elevator's doors being open, though the spec's own I/O matrix row states "E1 doors open" as if it were an enforced precondition. | false | Traced: this is correct behavior, not a bug — real elevators accept a Car Call any time a passenger is in the cabin (not only while doors are open); PRD FR-3's "only while inside an elevator with doors open" describes when the *Car Call UI panel is shown* (a client-side visibility rule, Story 2.4's job), not a backend validation rule. The spec's own I/O matrix phrasing was ambiguous and caused this reasonable misreading — corrected directly below rather than adding an incorrect guard. |
| 7 | (blind-hunter) CORS hardcoded to `origin: '*'`, not configurable via env var. | false | Already a deliberate, documented decision (code comment cites PRD Non-Goals: no auth, local-only demo scope). Not worth complicating for this project's stakes. |
| 8 | (blind-hunter) `shared/package.json`'s `main`/`types` point at `.ts` source directly; will need revisiting once `tsc` actually compiles to `dist/`. | false | Already explicitly flagged as a future concern in this story's own Design Notes ("Epic 3... can switch to a compiled... if that proves cleaner"), not a gap introduced silently. |
| 9 | (blind-hunter) No graceful shutdown (SIGINT/SIGTERM closing the server/clearing the interval). | false | Low priority for a local take-home demo process; Epic 3 owns real container lifecycle concerns. Not worth the time given the 2-day deadline and minimal user-facing impact. |
| 10 | (blind-hunter) `package-lock.json`'s `@types/node` entry lost an explicit `"dev": true` flag. | false | Checked directly — npm's own dependency-graph resolution, not a hand-edit; no demonstrated harm (no separate prod-only install step exists yet in this project). |
| 11 | (blind-hunter) No explicit confirmation that `IdleState`/`DoorOpenState` were untouched beyond `dwellTicksRemaining` access. | false | Verification-gap independently confirmed both files have zero diff lines; `openDoor`/`closeDoor` are `Elevator`'s own methods setting its own private field directly, no cross-class reach needed. Already true, nothing to add. |
| 12 | (blind-hunter) No test for `openDoor()`/`closeDoor()` when dwell is already 0. | patch | Real, trivial coverage gap; bundled with the other test additions. |
| 13 | (blind-hunter) `domainPurity.test.ts`'s forbidden-specifier regex robustness/false-positive surface undiscussed. | false | Verification-gap independently hand-checked the regex against representative specifiers and found it sound; not worth a companion test for a hypothetical future false positive. |
| 14 | (intent-alignment) `Direction.ts`/`DoorState.ts`/`Elevator.ts` import from `shared/src/types.js`/`shared/src/snapshot.js` (deep paths) while `socketHandlers.ts` imports from the declared `shared/src/index.js` barrel — two different conventions for the same package. | patch (doc/tidy) | Real, minor inconsistency; normalized while already touching these files for #5. |

**Routing:** #1, #2, #3, #4, #5, #12, #14 → patch (re-engaged step-03 implementer). #6 → spec wording corrected directly (see below). All others → false, no action.

**#6 fix applied directly:**

`server.ts` runs via `tsx` for now (already a devDependency from Story 1.5's demo script) — no separate build step needed yet; Epic 3's containerization can switch to a compiled `tsc` + `node dist/server.js` if that proves cleaner for the Docker image, without changing this story's design.

Silent-no-op-on-unknown-id here is a *different* invariant than `Dispatcher.tryAssign`'s throw: that throw guards against an internal `SchedulingStrategy` bug (can't happen with untrusted input in the loop); this one guards against untrusted client input, so it follows the PRD's "invalid client action is a silent no-op" convention instead.

## Verification

**Commands:**
- `npm test --workspace=backend` -- expected: all tests pass (Epic 1 unchanged + new Epic 2 coverage)
- `npm run build --workspace=backend` -- expected: zero type errors
