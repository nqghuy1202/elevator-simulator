---
title: 'Pending Call Re-evaluation'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_commit: '1474937c4ad7adaa4c56614803269b5f87560992'
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

**Problem:** Today (Story 1.2), a Hall Call with no eligible elevator is simply dropped — `Dispatcher.handleHallCall` does nothing further. The PRD requires a Hall Call to never be silently lost: it must be remembered and retried once an elevator becomes eligible.

**Approach:** Add Pending Call storage to `Dispatcher` and a `reevaluatePending()` method: an unassignable Hall Call is stored instead of dropped; `reevaluatePending()` retries every stored call, in FIFO arrival order, against a fresh Strategy evaluation, removing each that succeeds. (`Building.tick()` will call `reevaluatePending()` once per tick — that wiring is Story 1.5's job; this story only builds and directly-testable the retry mechanism itself.)

## Boundaries & Constraints

**Always:**
- An unassignable Hall Call (`tryAssign` returns no eligible elevator) is stored in `Dispatcher`'s Pending Calls, never discarded.
- `reevaluatePending()` processes Pending Calls in FIFO arrival order, computing a fresh `ElevatorSnapshot[]` and invoking the Strategy fresh for each call — so an assignment made earlier in the same pass (which changes that elevator's state) is visible to later calls in the same pass.
- A Hall Call already pending for the same `(floor, direction)` is not added a second time (de-duplicated).
- `reevaluatePending()` is pull-based: it does its own work only when called; it is never triggered by an `Elevator` or invoked automatically by this story's own code.

**Never:**
- No `Building` class and no automatic tick-driven scheduling of `reevaluatePending()` — Story 1.5's job. This story exposes the method; something else calls it.
- No changes to `Elevator`, its states, or `NearestCarStrategy`'s eligibility/selection logic (Story 1.1/1.2) — this story only adds retry orchestration around the existing `tryAssign` path.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No eligible elevator at request time | 1 elevator moving opposite direction; Hall Call | Call stored in Pending; not assigned | No error expected |
| Re-evaluate, still no eligible elevator | Pending call from above; `reevaluatePending()` called, elevator state unchanged | Call remains pending — not dropped, not duplicated | No error expected |
| Re-evaluate after an elevator becomes eligible | Pending call; the elevator reverses direction (via ticks) or goes Idle | `reevaluatePending()` assigns it (`addStop` called); removed from pending | No error expected |
| Duplicate Hall Call for the same pending (floor, direction) | A call is already pending; the same `(floor, direction)` is requested again | Not added a second time; still exactly one pending entry for it | No error expected |
| Multiple pending calls, one elevator becomes eligible for only one of them | 2 pending calls for different floors; 1 elevator becomes eligible for the first (FIFO) but not the second | First is assigned and removed; second remains pending | No error expected |
| Assignment within a pass affects a later call in the same pass | 2 pending calls both servable by the same now-idle elevator | First call's `addStop` (Story 1.1's `onHallAssigned`) moves that elevator out of Idle before the second call is evaluated in the same `reevaluatePending()` pass — second call's eligibility reflects the elevator's new state | No error expected |

</frozen-after-approval>

## Code Map

- `backend/src/domain/Dispatcher.ts` -- EDIT: extract existing `handleHallCall` assignment logic into a private `tryAssign(request): boolean`; add `pendingCalls: HallCallRequest[]`, `addPending()` (deduped), `reevaluatePending()`, `getPendingCalls()` (read-only)
- `backend/src/domain/Dispatcher.test.ts` -- EDIT: add tests covering every I/O Matrix row

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/domain/Dispatcher.ts` -- extract `tryAssign(request: HallCallRequest): boolean` from the existing `handleHallCall` body (same snapshot → strategy → addStop-or-throw-on-unknown-id logic) -- keeps FR-6/1.2 behavior unchanged, DRY
- [x] `backend/src/domain/Dispatcher.ts` -- `handleHallCall` calls `tryAssign`; on failure, calls `addPending(request)` instead of doing nothing -- FR-7
- [x] `backend/src/domain/Dispatcher.ts` -- `addPending(request)`: push only if no existing pending entry has the same `floor`+`direction` -- de-dup per Boundaries
- [x] `backend/src/domain/Dispatcher.ts` -- `reevaluatePending()`: snapshot current `pendingCalls`, clear the field, retry each via `tryAssign` in original order, re-push failures -- AD-7
- [x] `backend/src/domain/Dispatcher.ts` -- `getPendingCalls(): readonly HallCallRequest[]` -- read-only accessor for tests (and later Story 1.5/WS layer)
- [x] `backend/src/domain/Dispatcher.test.ts` -- one test per I/O Matrix row, including the "all ineligible → pending → reassigned after ticking the elevator to reversal" end-to-end scenario using real `Elevator.tick()` calls -- NFR-5

**Acceptance Criteria:**
- Given a Hall Call with no eligible elevator, when `handleHallCall` runs, then `getPendingCalls()` contains exactly one entry for that `(floor, direction)` and no `Elevator`'s `stopQueue` changed
- Given a pending call and an elevator that has since become eligible, when `reevaluatePending()` runs, then the call is assigned and no longer appears in `getPendingCalls()`
- Given `reevaluatePending()` is never called, when time passes (multiple `Elevator.tick()`s), then a pending call is never auto-assigned and never disappears on its own

## Implementation Notes

- Forward-pointer for Story 1.5: this story's `reevaluatePending()` covers AD-7's "FIFO arrival order, fresh Strategy evaluation per call" half of the contract. The other half — "`Building.tick()` calls each Elevator's `tick()` first, in fixed order, then calls `Dispatcher.reevaluatePending()` exactly once at tick-end, never mid-loop" — is Story 1.5's to implement when `Building` is built; `reevaluatePending()` here is intentionally pull-based and does not enforce that ordering itself.
- `addPending`'s dedup and `reevaluatePending`'s snapshot-then-clear-then-retry pattern both assume single-threaded, non-reentrant calls (true today — nothing calls `Dispatcher` concurrently). This assumption should be revisited once Epic 2's WebSocket handlers start calling `handleHallCall` from event callbacks.
- Reviewed (blind-hunter, edge-case-hunter, verification-gap, intent-alignment). One narrow edge case deferred to Story 1.4 — see `deferred-work.md`.

## Spec Change Log

## Review Triage Log

**Lenses run:** blind-hunter (8 findings), edge-case-hunter (4 findings), verification-gap (0 gaps), intent-alignment (descriptive, 2 minor test-precision notes, no defects).

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| 1 | (blind-hunter, edge-case-hunter x2) `getPendingCalls()` returns `this.pendingCalls` by reference, not a defensive copy — inconsistent with `Elevator.getSnapshot()`'s established `[...this.stopQueue]` pattern. | patch | Confirmed in code. Trivial, one-line fix, within this story's own file. |
| 2 | (blind-hunter) No test asserts `getSnapshot().direction` resets to `'IDLE'` after an elevator returns to Idle (only `stateName` was checked). | patch | Real coverage gap, trivial addition. |
| 3 | (blind-hunter) No test for `reevaluatePending()` called with zero pending calls. | patch | Real, trivial no-op-case test; worth having since Story 1.5 will call this every tick regardless. |
| 4 | (blind-hunter) Task checklist items (`## Tasks & Acceptance`) still show `- [ ]` despite the work being implemented. | patch | Cosmetic doc-sync fix, direct correction. |
| 5 | (blind-hunter) Spec's Design Notes cite "AD-7" only for the FIFO/fresh-snapshot half of the contract, not the "exactly once, after all elevators tick" ordering half Story 1.5 must satisfy. | patch (doc-only) | Real gap in forward-pointer documentation; added directly to Implementation Notes rather than re-engaging the implementer (no code change). |
| 6 | (blind-hunter) No comment documenting the single-threaded/non-reentrant assumption behind `addPending`'s dedup and `reevaluatePending`'s snapshot-then-clear pattern. | low→patch (doc-only) | Real, cheap: worth a one-line comment now, before Epic 2's WS handlers start calling `handleHallCall` from event callbacks. Added directly (doc/comment only). |
| 7 | (blind-hunter) Verification section doesn't list a `lint` command. | false | Checked `backend/package.json` — no lint script exists in the project at all; recommending one here would reference a nonexistent command. |
| 8 | (edge-case-hunter, blind-hunter) A single idle elevator sitting exactly at a floor, with two pending calls for that floor in opposite directions, can be selected twice in one `reevaluatePending()` pass — because Story 1.1's same-floor immediate-open fix (`IdleState`/`DoorOpenState`) never updates `direction` away from `'IDLE'`, so the elevator stays `IDLE`-eligible (any direction) for the second call too. Traced through: the second `addStop` re-queues the already-serviced floor, causing one extra, unnecessary dwell/door-open cycle before the elevator correctly settles Idle. Functionally harmless (the floor is still served, no call is lost or mis-served) but an observable inefficiency. | defer | Root cause lives in Story 1.1's `IdleState`/`DoorOpenState` (not touched by this diff), explicitly outside this story's frozen "Never" boundary ("No changes to Elevator, its states..."). Reachability requires a narrow, compound trigger (two opposite-direction pending calls at the exact floor an idle elevator already occupies) not exercised by this story's own I/O Matrix. Filed to `deferred-work.md`, flagged for Story 1.4 (Stop Queue Integrity), which already owns related same-floor/queue invariants. |

**Routing:** #1, #2, #3, #4 → patch (re-engaged step-03 implementer). #5, #6 → doc-only patch, applied directly. #8 → defer (`deferred-work.md`). #7 → false, no action.

## Design Notes

`tryAssign` becomes the one place that does snapshot→strategy→assign-or-throw; both `handleHallCall` and `reevaluatePending` call it, so 1.2's "unknown id" guard and AD-5's no-`instanceof` rule keep applying uniformly without duplication.

```ts
private tryAssign(request: HallCallRequest): boolean {
  const snapshots = this.elevators.map((e) => e.getSnapshot());
  const selected = this.strategy.selectElevator(snapshots, request);
  if (selected === null) return false;
  const elevator = this.elevators.find((e) => e.id === selected.id);
  if (!elevator) throw new Error(`Dispatcher: strategy selected unknown elevator id "${selected.id}"`);
  elevator.addStop(request.floor);
  return true;
}
```

## Verification

**Commands:**
- `npm test --workspace=backend` -- expected: all tests pass, including the extended `Dispatcher.test.ts`
- `npm run build --workspace=backend` -- expected: zero type errors
