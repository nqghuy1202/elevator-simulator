---
title: 'Dispatch Engine — SCAN/LOOK Hall Call Assignment'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_commit: '840de1c21065d0f737c7431882b490159e40b7da'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Hall Calls have no assignment logic yet — `Elevator` (Story 1.1) can only be told directly to add a stop. The simulator needs the SCAN/LOOK eligibility rule (idle, or already moving toward the floor) and a Nearest-Car selection among eligible elevators, exactly matching the PRD's worked example.

**Approach:** Add `Dispatcher` + a `SchedulingStrategy` interface with one implementation, `NearestCarStrategy`. `Dispatcher.handleHallCall(floor, direction)` computes each Elevator's `getSnapshot()`, passes the snapshots to the Strategy, and calls `addStop()` on the elevator the Strategy returns (if any).

## Boundaries & Constraints

**Always:**
- `Dispatcher` holds only a `SchedulingStrategy` reference; it never branches on the strategy's concrete type, even though only `NearestCarStrategy` exists.
- `SchedulingStrategy.selectElevator` operates on `ElevatorSnapshot[]` (Story 1.1's read-only accessor), never on live `Elevator` instances — keeps the strategy testable with plain data, no `Elevator` construction needed in its tests.
- Eligibility: an elevator is eligible for a Hall Call `(floor, direction)` when its snapshot `direction === 'IDLE'`, or `direction === requestedDirection` AND the floor is still ahead of `currentFloor` (`UP` → `floor > currentFloor`; `DOWN` → `floor < currentFloor`).
- Among eligible elevators, the one with least `abs(currentFloor - floor)` is selected.
- Car Call never touches `Dispatcher`/`SchedulingStrategy` — unaffected by this story, already true since `Elevator.addStop` has no dependency on either.

**Never:**
- No Pending Call storage/tracking — that's Story 1.3. When no elevator is eligible, `Dispatcher.handleHallCall` simply does not assign anything; nothing is persisted or retried yet.
- No `Building` class or multi-elevator lifecycle wiring beyond a plain array passed into `Dispatcher` — Story 1.5's job.
- No changes to `Elevator`, its states, or the Story 1.1 queue methods (`addStop`/`removeStop`/etc.) — this story only adds a caller of `addStop`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Single idle elevator | 1 elevator, `IDLE` at floor 3; Hall Call floor 7 UP | Elevator selected, `addStop(7)` called | No error expected |
| Two idle elevators, different distances | Elevators idle at floor 2 and floor 8; Hall Call floor 7 UP | Elevator at floor 8 selected (distance 1 < 5) | No error expected |
| Moving same direction, floor ahead (PRD worked example, accept) | Elevator `MOVING_UP`, `currentFloor` 3; Hall Call floor 5 UP | Elevator selected | No error expected |
| Moving same direction, floor behind | Elevator `MOVING_UP`, `currentFloor` 6; Hall Call floor 5 UP | Elevator NOT eligible | No error expected |
| Moving opposite direction (PRD worked example, reject) | Elevator `MOVING_UP`, `currentFloor` 3; Hall Call floor 5 DOWN | Elevator NOT eligible | No error expected |
| Mixed pool, nearest wins regardless of idle/moving | One idle far away, one `MOVING_UP` close and ahead; Hall Call matching the moving one's direction | The closer, moving-and-eligible elevator selected | No error expected |
| No eligible elevator | All elevators moving opposite direction or floor already behind | `selectElevator` returns `null`; `Dispatcher.handleHallCall` assigns nothing | No error, no throw |

</frozen-after-approval>

## Code Map

- `backend/src/domain/Elevator.ts` -- reuse only: `getSnapshot()` (read), `addStop()` (write) — no edits
- `backend/src/domain/scheduling/SchedulingStrategy.ts` -- NEW: interface `selectElevator(elevators: ElevatorSnapshot[], request: HallCallRequest): ElevatorSnapshot | null`
- `backend/src/domain/scheduling/NearestCarStrategy.ts` -- NEW: the one implementation, SCAN/LOOK eligibility + nearest-distance selection
- `backend/src/domain/Dispatcher.ts` -- NEW: holds `Elevator[]` + `SchedulingStrategy`; `handleHallCall(floor, direction)` orchestrates snapshot → strategy → `addStop`

## Tasks & Acceptance

**Execution:**
- [ ] `backend/src/domain/scheduling/SchedulingStrategy.ts` -- interface + `HallCallRequest` type (`{ floor: number; direction: 'UP' | 'DOWN' }`) -- FR-10, AD-5 polymorphism seam
- [ ] `backend/src/domain/scheduling/NearestCarStrategy.ts` -- implements eligibility (idle-or-ahead-same-direction) + nearest-distance pick -- FR-6
- [ ] `backend/src/domain/scheduling/NearestCarStrategy.test.ts` -- unit tests covering every I/O Matrix row, using plain `ElevatorSnapshot` literals (no `Elevator` construction) -- NFR-5
- [ ] `backend/src/domain/Dispatcher.ts` -- `handleHallCall(floor, direction)`: map elevators to snapshots, call `strategy.selectElevator`, if non-null find the matching `Elevator` by `id` and call `addStop(floor)` -- FR-6, AD-5
- [ ] `backend/src/domain/Dispatcher.test.ts` -- integration-style test: real `Elevator` instances, assert `addStop` effect via `getSnapshot().stopQueue` after `handleHallCall`

**Acceptance Criteria:**
- Given a Hall Call for a floor/direction, when `Dispatcher.handleHallCall` runs, then it calls `strategy.selectElevator` exactly once and never inspects `NearestCarStrategy` by name/`instanceof`
- Given the PRD's worked example (elevator moving 1→10, currently at floor 3), when a Hall Call ↑ at floor 5 arrives, then that elevator is selected; when a Hall Call ↓ at floor 5 arrives instead, then it is not
- Given no elevator is eligible, when `handleHallCall` runs, then no `Elevator`'s `stopQueue` changes and nothing throws

## Implementation Notes

## Spec Change Log

## Review Triage Log

**Lenses run:** blind-hunter (7 findings), edge-case-hunter (2 findings), verification-gap (0 gaps), intent-alignment (descriptive, 1 actionable overlap).

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| 1 | (blind-hunter, intent-alignment) `NearestCarStrategy.selectElevator`'s `reduce` tie-break (strict `<`, first-wins) is undocumented and untested. | low→patch | Confirmed in code. Fix is a direct addition: one test asserting the deterministic tie-break, no behavior change. |
| 2 | (blind-hunter) No caller-facing note that an unassignable Hall Call silently no-ops (FR-7/Story 1.3 boundary). | false | `Dispatcher.handleHallCall`'s JSDoc already states this exactly: "If no elevator is eligible, does nothing — Pending Call storage is Story 1.3." Already documented. |
| 3 | (blind-hunter, intent-alignment) No test for `floor === currentFloor` on a *moving* elevator. | low→patch | Behavior is correct-as-specified (eligibility requires the floor "still ahead", strict inequality is deliberate) — this is a coverage gap, not a bug. Trivial test to add. |
| 4 | (blind-hunter) No test with two *moving* (non-idle) eligible elevators at different distances. | patch | Real coverage gap; existing "mixed pool" test only covers idle-vs-moving. Trivial addition. |
| 5 | (blind-hunter, edge-case-hunter) `Dispatcher.handleHallCall` silently no-ops if the strategy returns a snapshot `id` with no matching live `Elevator`. | low→patch | Unreachable with the one shipped `NearestCarStrategy` (it can only return a snapshot from the array it was given), but AD-5 anticipates future strategies. Fix is a direct, cheap guard (throw with a clear message) — worth the small robustness gain. |
| 6 | (blind-hunter) `HallCallRequest.direction` duplicates the `'UP' \| 'DOWN'` literal instead of reusing/narrowing `Direction`. | patch | Real, trivial: `Exclude<Direction, 'IDLE'>`, no behavior change. |
| 7 | (blind-hunter) `Dispatcher` stores the `elevators` array by reference, not a defensive copy. | false | Dispatcher must hold live `Elevator` references to call `addStop()` on them — that's intentional, not a leak. `getSnapshot()`'s defensive-copy analogy doesn't transfer: copying the array wouldn't protect anything meaningful here, and no code path in this story or the next mutates the array after construction. |
| 8 | (edge-case-hunter) `handleHallCall`'s `floor` parameter isn't validated (NaN/non-integer/negative). | false | Dispatcher is only ever called by trusted internal code; no external input reaches it yet. Validating malformed input belongs at the system boundary that will introduce it (Epic 2's WS adapter, Story 2.1), not preemptively here — matches the project's own "validate at boundaries, trust internal callers" principle. |

**Routing:** #1, #3, #4, #5, #6 → patch (bundled, re-engaged step-03 implementer). #2, #7, #8 → false, no action.

## Design Notes

`NearestCarStrategy` takes only `ElevatorSnapshot[]`, never `Elevator[]` — this is what makes it unit-testable with hand-written snapshot literals instead of constructing real `Elevator` instances for every case. `Dispatcher` is the only place that bridges snapshot-space selection back to a live `Elevator` (by matching `id`) to call the mutating `addStop()`.

```ts
interface HallCallRequest { floor: number; direction: 'UP' | 'DOWN'; }
interface SchedulingStrategy {
  selectElevator(elevators: ElevatorSnapshot[], request: HallCallRequest): ElevatorSnapshot | null;
}
```

## Verification

**Commands:**
- `npm test --workspace=backend` -- expected: all tests pass, including new `NearestCarStrategy.test.ts`/`Dispatcher.test.ts`
- `npm run build --workspace=backend` -- expected: zero type errors
