---
title: 'Car Call UI'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: '5a8cc1d6e47cf9ee00536722ebbbc679f271dde9'
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

**Problem:** The `carCall` WS event and its domain command (`Building.handleCarCall` → `Elevator.assignCarCall`) have existed and been fully tested since Epic 1/Story 2.1, but nothing in the client emits it or lets an occupant see it — there is no in-cabin destination-selection UI.

**Approach:** Add `ElevatorCar`/`DestinationPanel` components — one per elevator, visible only while that elevator's `doorState` is `OPEN` (per Snapshot) — offering every floor except the elevator's own current floor; selecting one emits `carCall` via an extended `useBuildingSocket`. Purely additive frontend work: the backend/domain/shared command path is already implemented and tested, so this story only wires the client to it, mirroring the `useBuildingSocket`/component pattern Story 2.3 established for Hall Calls.

## Boundaries & Constraints

**Always:**
- Destination floors offered = every floor `1..snapshot.floors` except that elevator's own `currentFloor` (FR-3).
- A given elevator's panel is visible only while that elevator's `doorState === 'OPEN'` in the Snapshot — it appears/disappears purely by re-rendering off `doorState`, no client-side memory of "was it open."
- Selecting a floor already in that elevator's `stopQueue` (visible in the Snapshot) renders as already-queued and is not offered as a fresh selection — straight from Snapshot data, no client-derived state (AD-1).
- Multiple selections in one visit are each emitted independently; queuing order ("current-direction order") is entirely the existing, already-tested `Elevator.insertStop`/`assignCarCall` behavior (Epic 1) — this story adds no domain logic and makes no domain/backend changes.
- All Snapshot/UI-interaction state stays in Redux/props per the existing pattern — no ad hoc component state (FR-17).

**Never:**
- No backend, domain, or `shared` changes — `Building.handleCarCall`, `Elevator.assignCarCall`, and the `carCall` WS handler already exist and are tested; this story is frontend-only.
- No changes to the Hall Call UI (Story 2.3, done) or Door Hold/Close UI (Story 2.5, not yet built).
- No visual polish beyond what's needed to demonstrate correctness (PRD NFR-7).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Doors open, select destination | Elevator `E1`, `doorState: 'OPEN'`, `currentFloor: 5`; occupant selects floor 8 | `carCall{elevatorId:'E1', floor:8}` emitted | No error |
| Doors closed: no panel | Elevator's `doorState` is `CLOSED`/`OPENING`/`CLOSING` | No `DestinationPanel` rendered for that elevator | No error |
| Current floor excluded | Elevator at floor 5, doors open | No button offered for floor 5 | No error |
| Multiple selections in one visit | Doors open; occupant selects floor 3, then floor 8 | Two separate `carCall` events emitted, one per press | No error |
| Already-queued floor shown, not re-offered | `stopQueue` already contains floor 8 | Floor 8 renders as already-queued (disabled/marked), not a fresh clickable option | No error |

</frozen-after-approval>

## Code Map

- `frontend/src/hooks/useBuildingSocket.ts` -- EDIT: add `emitCarCall(elevatorId, floor)` to the returned object, mirroring `emitHallCall`'s `socketRef.current?.emit(...)` pattern
- `frontend/src/components/DestinationPanel.tsx` -- NEW: given `{ elevatorId, currentFloor, floors, stopQueue, onCarCall }`, renders a button for every floor `1..floors` except `currentFloor`; a floor already in `stopQueue` renders `disabled` instead of clickable
- `frontend/src/components/ElevatorCar.tsx` -- NEW: renders one elevator's existing summary line (id/floor/direction/doorState — currently inlined as a raw `<li>` in `App.tsx`) and conditionally renders `DestinationPanel` when `doorState === 'OPEN'`
- `frontend/src/App.tsx` -- EDIT: replace the raw `<ul>{snapshot.elevators.map(...)}</ul>` block with a mapped list of `<ElevatorCar>`, wiring `emitCarCall` through; no `App.test.tsx` exists today so nothing to update there
- `frontend/src/hooks/useBuildingSocket.test.tsx` -- EDIT: add an `emitCarCall` test mirroring the existing `emitHallCall` one
- `frontend/src/components/DestinationPanel.test.tsx` -- NEW: covers the I/O Matrix's client-visible rows (floor offering, current-floor exclusion, already-queued disabling, click emits)
- `frontend/src/components/ElevatorCar.test.tsx` -- NEW: covers panel visibility toggling on `doorState`

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/hooks/useBuildingSocket.ts` -- add `emitCarCall` -- client emit path, mirrors Story 2.3's `emitHallCall`
- [x] `frontend/src/components/DestinationPanel.tsx` -- floor selection UI -- FR-3
- [x] `frontend/src/components/ElevatorCar.tsx` -- per-elevator summary + conditional panel -- FR-3, doors-open visibility rule
- [x] `frontend/src/App.tsx` -- wire `ElevatorCar`/`emitCarCall` in, replacing the raw elevator list -- completes the pipeline
- [x] Frontend tests -- cover all 5 I/O Matrix rows -- NFR-5

**Acceptance Criteria:**
- Given `npm test --workspace=frontend`, when run, then all pass including new coverage
- Given `npm run build --workspace=frontend`, when run, then zero type errors
- Given the backend+frontend running live, when an elevator's doors open and a destination floor is selected, then a `carCall` is emitted and the elevator later visits that floor (manual verification, recorded in Implementation Notes)

## Implementation Notes

- `frontend/src/hooks/useBuildingSocket.ts`: added `emitCarCall(elevatorId, floor)`, mirroring `emitHallCall` exactly (same `socketRef.current?.emit(...)` no-op-if-unconnected pattern, using the existing `CarCallPayload` shared type).
- `frontend/src/components/DestinationPanel.tsx` (new): pure presentational component. Offers a button for every floor `1..floors` except `currentFloor`; a floor present in `stopQueue` renders `disabled` with a "(queued)" suffix instead of being a fresh clickable option. No internal state — driven entirely by props straight from the Snapshot (AD-1).
- `frontend/src/components/ElevatorCar.tsx` (new): renders the elevator summary line (previously an inline `<li>` in `App.tsx`) and conditionally renders `DestinationPanel` only when `elevator.doorState === 'OPEN'`. No memoized/derived "was open" state — visibility is purely `doorState === 'OPEN'` on every render.
- `frontend/src/App.tsx`: replaced the raw `<ul>{snapshot.elevators.map(...)}</ul>` block with a mapped list of `<ElevatorCar>`, threading `emitCarCall` (destructured alongside `emitHallCall` from `useBuildingSocket`) through as `onCarCall`.
- Tests added: `useBuildingSocket.test.tsx` gained an `emitCarCall` case mirroring the existing `emitHallCall` one; `DestinationPanel.test.tsx` and `ElevatorCar.test.tsx` are new, covering all 5 I/O Matrix rows (doors-open selection emits `carCall`, no panel while doors aren't `OPEN`, current-floor exclusion, multiple independent selections in one visit, already-queued floor rendering disabled and not re-emitting on click).
- Manual live verification: ran `npm run start --workspace=backend` and a throwaway `socket.io-client` script (not committed) that connected, emitted a `hallCall` to nudge an elevator to floor 5 (idle elevators never open doors on their own, so a nudge was needed to reach the doors-open state), observed `buildingState` broadcasts showing elevator `E1`'s `doorState` go `OPEN` at floor 5, emitted `carCall {elevatorId: 'E1', floor: 1}` — the exact event/payload the new `emitCarCall` sends — and confirmed `E1` later arrived at floor 1 with `doorState: 'OPEN'`. This exercised the identical wire path the frontend UI now drives; the script and backend process were removed/stopped afterward, nothing was committed.
- No backend/domain/shared changes were made, per the spec's boundary.

## Spec Change Log

## Review Triage Log

**Lenses run:** blind-hunter (7 findings), edge-case-hunter (3 findings), verification-gap (0 gaps — "No verification gaps found"), intent-alignment (descriptive, 4 divergence points).

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| 1 | (blind-hunter + edge-case-hunter, same root cause) `DestinationPanel` doesn't bounds-check `floors`/`currentFloor`; a `floors <= 0` snapshot would throw `RangeError` from `Array.from`, and an out-of-range `currentFloor` would silently fail to exclude any button. | false / out of scope | `Building`'s constructor throws for `floors <= 0` (unreachable for any real Snapshot, same reasoning as Story 2.3's pass-1 row #15). `currentFloor` only ever leaves the domain-managed `1..floors` range via a malicious/buggy WS client bypassing the UI entirely (the UI itself only ever derives bounded floors) — a pre-existing server-input-validation gap unrelated to this frontend-only story's scope. |
| 2 | (blind-hunter + edge-case-hunter, same root cause) No debounce/disabled-on-click guard — rapid double-click before the next Snapshot tick could emit `carCall` twice for the same floor. | low → reject | Traced: the second emission is a harmless no-op server-side — `Elevator.insertStop` already dedupes (`stopQueue.includes(floor)` check, Epic 1, well-tested) synchronously against the *actual* server state, not the client's stale prop, so no duplicate booking occurs. Matches this project's established pattern (Story 2.3's "repeat press" case) of relying on server-side dedupe rather than client-side gating (AD-1). |
| 3 | (blind-hunter) No test covers doors staying `OPEN` across a `currentFloor` change without closing first. | false | Unreachable per the state machine's own design — an elevator only moves while *not* in `DoorOpenState`; doors don't stay open across a floor transition. |
| 4 | (blind-hunter) No test asserts `emitHallCall`/`emitCarCall` no-op when `socketRef.current` is `null` (pre-connect). | false | Same disposition as Story 2.3's pass-1 row #9: optional chaining (`socketRef.current?.emit(...)`) makes a throw impossible; the claimed bad outcome cannot occur. |
| 5 | (blind-hunter) `ElevatorCar`'s hardcoded `<li>` wrapper bakes in a "rendered inside a `<ul>`" assumption with no comment. | low → reject | Cosmetic coupling note; true today, no behavioral risk, fix is a documentation nit at best. |
| 6 | (blind-hunter) No `aria-live`/`aria-pressed` accessibility semantics on the panel or its disabled buttons. | false / out of scope | Same gap already present in Story 2.3's `FloorHallPanel`; explicitly deprioritized by PRD NFR-7 ("no visual polish"), not a stated requirement. |
| 7 | (blind-hunter) `ElevatorCar.test.tsx`'s `makeElevator` helper includes an unused `stateName` field. | low → reject | Trivial test-scaffolding tidiness nit; no functional impact. |
| 8 | (intent-alignment) `App.tsx`'s pre-existing per-elevator `<li>` markup was moved/refactored into `ElevatorCar` rather than left untouched, arguably beyond "purely additive." | false | The refactor preserves the exact same rendered summary line (verified by `ElevatorCar.test.tsx`'s text-match assertion) and touches no other UI surface (Hall Call/Door Hold-Close untouched, per the frozen "Never" boundary) — a faithful, necessary relocation to host the new panel, not a scope violation. |
| 9 | (intent-alignment) No test renders `App` itself to confirm `emitCarCall` is actually wired to `ElevatorCar`'s `onCarCall` prop end-to-end. | false / accepted precedent | Trivial, non-branching prop pass-through (`onCarCall={emitCarCall}`); verification-gap independently classified this as a "low-risk pass-through" not requiring dedicated coverage. Matches the exact precedent already accepted in Story 2.3's review (no `App.tsx` test exists or is expected for simple wiring). |
| 10 | (intent-alignment) AD-1's "already-queued... not offered as a fresh selection" is implemented as a disabled button rather than omitting it entirely. | false | Both readings satisfy the intent's actual guarantee (not selectable/re-emittable); the diff's own tests assert the disabled-button form directly and consistently — not a contradiction, just one of two compatible implementations. |

**Routing:** No `high`/`medium` findings, no `intent_gap`/`bad_spec`/`patch`/`defer` entries. Review is clean on the first pass — proceeding to present.

## Design Notes

## Verification

**Commands:**
- `npm test --workspace=frontend` -- expected: all pass, including new `DestinationPanel`/`ElevatorCar` coverage -- **Result: PASS, 7 test files / 43 tests passed**
- `npm run build --workspace=frontend` -- expected: zero type errors -- **Result: PASS, `tsc -b && vite build` completed with zero errors**

**Manual checks (if no CLI):**
- Run backend + frontend dev servers together, wait for an elevator's doors to open, select a destination floor, confirm the panel disappears once doors close and the elevator later visits the selected floor. -- **Result: PASS (via a scripted socket.io-client standing in for the browser, see Implementation Notes) — E1 opened doors at floor 5, `carCall{elevatorId:'E1', floor:1}` was emitted, E1 later arrived at floor 1 with doors open.**
