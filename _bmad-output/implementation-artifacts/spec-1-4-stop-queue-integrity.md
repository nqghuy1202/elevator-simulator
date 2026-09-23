---
title: 'Stop Queue Integrity'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: '04bd8bc315209a4230b6ce9e59a6673c532a6a29'
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

**Problem:** Stories 1.1–1.3 use a placeholder queue API on `Elevator` (`addStop`/`removeStop`, `void`-returning) explicitly flagged as temporary. It doesn't yet implement AD-6's single-entry-point contract, doesn't distinguish Hall Call from Car Call insertion, and can't report whether an insertion actually happened — which is also the exact gap behind a deferred Story 1.3 finding (an idle elevator already at a floor can get "double-counted" for two opposite-direction pending calls).

**Approach:** Replace `addStop`/`removeStop` with the formal AD-6 contract: public `assignHallCall(floor)` / `assignCarCall(floor)`, both routing through one private `insertStop(floor): boolean` (direction-ordered, same-floor/duplicate no-op, returns whether it actually inserted); removal centralized in one private `completeStop(floor)`, called only from arrival handlers. `Dispatcher` is updated to call `assignHallCall` and to treat a `false` return as "not actually assigned" — closing the deferred Story 1.3 edge case as a side effect of building the real contract.

## Boundaries & Constraints

**Always:**
- `assignHallCall(floor)` and `assignCarCall(floor)` are `Elevator`'s only two insertion entry points; both call the same private `insertStop(floor)` — no second insertion path exists (FR-9, AD-6).
- `insertStop` inserts in position consistent with current `Direction`; inserting into an empty queue from `IdleState` still lets `IdleState`'s existing dispatch logic set `Direction` based on the post-insertion queue (unchanged from Story 1.1/1.1's fix — this story does not alter *how* direction gets set, only *how insertion is entered*).
- `insertStop` returns `false` (no insertion) when the floor is already queued, or when the floor equals `currentFloor` while `doorState !== 'CLOSED'`; returns `true` otherwise. `assignHallCall`/`assignCarCall` return `insertStop`'s result, satisfying AD-2's "every public command reports whether it was accepted."
- `completeStop(floor)` is the only method that removes a `stopQueue` entry; it replaces every existing `removeStop` call site (the arrival handler in `MovingState`, and the same-floor fast paths in `IdleState`/`DoorOpenState`) — no other method removes entries.
- `Dispatcher.tryAssign` calls `elevator.assignHallCall(floor)` and treats its `false` return the same as "no eligible elevator" (the call is not considered assigned) — this is the fix for the deferred Story 1.3 edge case.
- The internal state hook renamed `onHallAssigned` → `onStopAssigned` across `ElevatorState`/`IdleState`, since it now fires for both Hall and Car Call insertion, not just Hall.

**Never:**
- No changes to `NearestCarStrategy`'s eligibility/selection math, or to the SCAN/LOOK stop rule in `MovingState.onArriveFloor` beyond the `removeStop`→`completeStop` rename — those are Story 1.1/1.2's settled behavior.
- No Car Call caller is wired yet (`assignCarCall` exists and is directly tested, but nothing calls it in production code until Epic 2).
- No door-hold/door-close command methods (`openDoor`/`closeDoor`) — out of this story's scope; Epic 2's WS-adapter story owns introducing those.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Hall Call and Car Call both route through one insertion path | Idle elevator; call `assignHallCall(8)` on one, `assignCarCall(8)` on another otherwise-identical elevator | Both produce the same resulting `stopQueue`/`direction`/`stateName` | No error expected |
| Insert into empty queue while Idle | `IdleState`, empty queue; `assignHallCall(8)` | Returns `true`; elevator transitions toward floor 8 (unchanged from Story 1.1) | No error expected |
| Insert floor equal to currentFloor, doors closed (genuinely new stop at own floor) | `IdleState`, `currentFloor` 5; `assignHallCall(5)` | Returns `true`; floor is queued, then immediately serviced by the existing same-floor fast path | No error expected |
| Insert floor equal to currentFloor, doors already open (mid-visit duplicate) | `DoorOpenState`, `currentFloor` 5, `doorState` `OPEN`; `assignHallCall(5)` | Returns `false`; `stopQueue` unchanged | No error expected |
| Insert an already-queued floor | `stopQueue` contains 8; `assignHallCall(8)` again | Returns `false`; `stopQueue` still contains exactly one `8` | No error expected |
| `completeStop` is the only removal path | Elevator with a queued stop it arrives at | `MovingState.onArriveFloor` removes it via `completeStop`; no other code path shrinks the queue | No error expected |
| Dispatcher no longer silently "succeeds" on a no-op insertion | Idle elevator at floor 5; two pending calls `(5, 'UP')` and `(5, 'DOWN')` reach `reevaluatePending()` in one pass | First is genuinely assigned (`insertStop` returns `true`); second's `assignHallCall` returns `false` (same-floor, doors now open) so `Dispatcher` does not treat it as assigned — it is re-added to pending instead of being silently dropped | No error expected |

</frozen-after-approval>

## Code Map

- `backend/src/domain/Elevator.ts` -- EDIT: remove `addStop`/`removeStop`; `hasStop` stays (used internally by `IdleState`/`DoorOpenState`/`MovingState`, not "unused" — Code Map corrected post-review); add public `assignHallCall(floor): boolean`, `assignCarCall(floor): boolean`; add `insertStop(floor): boolean` (private), `completeStop(floor): void` (public — same cross-class-collaboration constraint as `setState`, see Story 1.1)
- `backend/src/domain/states/ElevatorState.ts` -- EDIT: rename abstract `onHallAssigned` → `onStopAssigned`
- `backend/src/domain/states/IdleState.ts` -- EDIT: rename hook override; `removeStop` → `completeStop` in the same-floor fast path
- `backend/src/domain/states/DoorOpenState.ts` -- EDIT: `removeStop` → `completeStop` in its same-floor fast path
- `backend/src/domain/states/MovingState.ts` -- EDIT: `removeStop` → `completeStop` in `onArriveFloor`
- `backend/src/domain/Dispatcher.ts` -- EDIT: `tryAssign` calls `assignHallCall` instead of `addStop`; treats its `false` return as assignment failure
- `backend/src/domain/Elevator.test.ts`, `backend/src/domain/Dispatcher.test.ts` -- EDIT: update call sites for the rename; add tests for every I/O Matrix row

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/domain/states/ElevatorState.ts` -- rename `onHallAssigned` → `onStopAssigned` -- reflects that both Hall and Car Call insertion trigger it
- [x] `backend/src/domain/states/IdleState.ts`, `DoorOpenState.ts`, `MovingState.ts` -- rename hook override and `removeStop`→`completeStop` call sites -- no behavior change, just the AD-6 method names
- [x] `backend/src/domain/Elevator.ts` -- `insertStop(floor): boolean` (private): direction-ordered insertion; no-op+`false` for already-queued or same-floor-while-door-open; `true` otherwise -- FR-9, AD-6
- [x] `backend/src/domain/Elevator.ts` -- `completeStop(floor): void` (private): the sole removal path, called only from the arrival handler -- AD-6
- [x] `backend/src/domain/Elevator.ts` -- `assignHallCall(floor): boolean`, `assignCarCall(floor): boolean` (public): both call `insertStop` and `this.state.onStopAssigned(this)` on success, return `insertStop`'s result -- FR-1, FR-3, AD-2, AD-6
- [x] `backend/src/domain/Dispatcher.ts` -- `tryAssign` calls `elevator.assignHallCall(request.floor)`; if it returns `false`, treat as assignment failure (same as "no eligible elevator") -- closes the deferred Story 1.3 edge case
- [x] `backend/src/domain/Elevator.test.ts` -- update existing tests for the rename; add insertion-contract tests for every I/O Matrix row not already covered
- [x] `backend/src/domain/Dispatcher.test.ts` -- update existing tests for the rename; add the "no-op insertion isn't silently treated as assigned" test (last I/O Matrix row)

**Acceptance Criteria:**
- Given the full backend test suite, when `npm test --workspace=backend` runs, then all tests pass, including every Story 1.1–1.3 test now exercising the renamed API with unchanged observable behavior
- Given the codebase, when searched for `removeStop`/`addStop`/`onHallAssigned`, then zero references remain outside this spec's own text
- Given the deferred Story 1.3 edge case (idle elevator at a floor, two opposite-direction pending calls), when re-run against the new code, then the second call is correctly left unresolved (re-pended) rather than silently marked assigned

## Implementation Notes

`insertStop`'s direction-ordered placement is implemented via `findInsertionIndex`: ascending order while `Direction` is `UP` or `IDLE`, descending while `DOWN`. No current consumer (`NearestCarStrategy`, `hasStopAbove`/`hasStopBelow`, `hasStop`) depends on queue order — only membership — so this is a legibility/AD-6-faithfulness choice, not an observable-behavior change.

`hasStop`/`hasStopAbove`/`hasStopBelow`/`isStopQueueEmpty` were kept as-is (still used internally by `IdleState`/`DoorOpenState`/`MovingState`); only `addStop`→(`assignHallCall`/`assignCarCall`/`insertStop`) and `removeStop`→`completeStop` were renamed/replaced per the Code Map.

`assignHallCall(floor)` intentionally takes only `floor`, not `docs/ARCHITECTURE.md`'s original `assignHallCall(floor, dir)` — `Dispatcher` already validates direction-eligibility via `NearestCarStrategy` before calling this, so `Elevator` only ever needs its own `direction` field, never the caller's stated direction. `docs/ARCHITECTURE.md`'s class diagram is superseded by the Architecture Spine for this kind of invariant (per the Spine's own Structural Seed note); this deliberate signature simplification is recorded here rather than editing that historical seed document.

`insertStop`'s same-floor no-op guard checks `doorState !== 'CLOSED'`, not the elevator's state name — so inserting `floor === currentFloor` while genuinely `MovingUpState`/`MovingDownState` (doors closed) is not itself guarded. This is a documented, currently-unreachable invariant assumption, not a gap: `Dispatcher` only calls `assignHallCall` for a moving elevator when `NearestCarStrategy` already confirmed the floor is strictly ahead (never the elevator's own current floor), and `assignCarCall` — though it has no caller yet — will be constrained by PRD FR-3's UI rule that a Car Call excludes the current floor. If a future caller ever bypasses both constraints, this guard would need extending.

## Spec Change Log

## Review Triage Log

**Lenses run:** blind-hunter (10 findings), edge-case-hunter (2 findings), verification-gap (0 gaps), intent-alignment (descriptive, 1 nuance, no defect).

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| 1 | (blind-hunter) No test asserts `stopQueue`'s actual *order* after inserting multiple stops while moving (ascending UP / descending DOWN) — all new tests check membership (`toContain`) only. | patch | Real, significant gap: `findInsertionIndex`'s direction-ordering is the actual FR-9 deliverable of this story, and nothing verifies it does what it claims. |
| 2 | (blind-hunter) No test for mid-queue insertion (a stop landing strictly between two already-queued stops) — the actual interesting case for `findInsertionIndex`'s splice logic. | patch | Real, same root gap as #1; bundled into the same test addition. |
| 3 | (blind-hunter) Spec's own Code Map says `hasStop` should be removed ("unused externally"); Implementation Notes says it was kept. Self-contradictory spec text. | patch (doc-only) | Confirmed inconsistency; `hasStop` is correctly kept (used internally by state classes) — Code Map line was wrong, corrected directly. |
| 4 | (blind-hunter) `assignHallCall(floor)` drops the `dir` parameter `docs/ARCHITECTURE.md`'s class diagram specifies (`assignHallCall(floor, dir)`), undocumented in the spec. | patch (doc-only) | Real gap in documentation, not in correctness: `Dispatcher` already validates direction-eligibility via `NearestCarStrategy` before calling this, so `Elevator` never needs the caller's stated direction — only its own `direction` field, which it already tracks. `docs/ARCHITECTURE.md` is superseded by the Architecture Spine for invariants (the spine's AD-2 only mandates the method *names* + boolean return, not this parameter) — noted directly rather than editing the large historical seed doc. |
| 5 | (edge-case-hunter) `insertStop`'s same-floor guard only checks `doorState !== 'CLOSED'`, not whether the elevator is `MovingUpState`/`MovingDownState` — inserting `floor === currentFloor` while genuinely moving (doors closed) succeeds and could leave a stop permanently unserviced (behind the direction of travel, never re-checked). | false | Traced reachability: `Dispatcher.tryAssign` only calls `assignHallCall` when `NearestCarStrategy` already confirmed the floor is strictly *ahead* (or the elevator is Idle) — a moving elevator is never selected for its own current floor. `assignCarCall` has no production caller yet, and PRD FR-3 explicitly excludes the current floor from the future Car Call UI's floor-selection ("Any floor 1-10 except the current floor is selectable") — so no planned caller can ever produce this input. Documented as an explicit invariant assumption rather than adding a guard against an input no real caller will ever send. |
| 6 | (edge-case-hunter, claim) Spec's Intent/Code Map/Tasks describe `completeStop` as "private"; actual code has no `private` modifier. | false | Same TypeScript constraint already adjudicated in Story 1.1 (`setState`): `completeStop` is called from `ElevatorState` subclasses in separate files, which requires it to be public — TS has no access modifier for "visible to specific external classes only." Non-frozen Code Map wording was imprecise, consistent with the established Story 1.1 pattern; frozen AC doesn't claim otherwise. |
| 7 | (blind-hunter) `assignCarCall` ships with no production caller. | false | Explicitly disclosed and expected per this story's own frozen "Never" boundary — Epic 2 wires the caller. |
| 8 | (blind-hunter) No isolated test for "snapshot re-taken fresh per call within one `reevaluatePending` pass." | false | Already covered by Story 1.3's own dedicated test (`Dispatcher.test.ts`: "assignment within a pass affects a later call in the same pass") — confirmed present; no need to duplicate. |
| 9 | (blind-hunter) `completeStop` returns `void`, asymmetric with `insertStop`'s `boolean`, even though it also silently no-ops on an absent floor. | false | `completeStop` is only ever called after the caller has already confirmed (`hasStop`) the floor is present — the no-op branch is defensive and unreached by any current call site; not worth reporting a result nothing consumes. |
| 10 | (blind-hunter) Empty `Review Triage Log`/`Spec Change Log` placeholders; `sprint-status.yaml` timestamp gap. | false | Normal in-progress state — filled by this same review pass; no concurrent edits were dropped. |
| 11 | (intent-alignment) The deferred-Story-1.3 regression test exercises a same-pass, two-calls-in-sequence race rather than an "already idle for a while, calls arrive later" scenario. | false | The fix mechanism (`insertStop`'s same-floor-while-open guard, now correctly propagated through `tryAssign`) is pass-agnostic — it triggers on the same condition (`floor === currentFloor && doorState !== 'CLOSED'`) regardless of whether the two calls are separated by one pass or many, since `direction` resets to `'IDLE'` again once the elevator settles. No materially different code path exists for the "later pass" variant; an additional test would exercise the identical guard. |

**Routing:** #1, #2 → patch (re-engaged step-03 implementer, test coverage only). #3, #4, #5 → doc-only, applied directly. All others → false, no action.

## Design Notes

`assignHallCall` and `assignCarCall` are intentionally near-identical thin wrappers over `insertStop` today — the mechanics of inserting a floor don't differ between Hall and Car Calls. They're kept as two named methods (matching `docs/ARCHITECTURE.md`'s original class diagram and AD-2's naming) rather than one generic method, both to match the established public-command vocabulary and to leave room for the two to diverge later (e.g. if Car Calls ever need different priority) without an API break.

```ts
assignHallCall(floor: number): boolean {
  const inserted = this.insertStop(floor);
  if (inserted) this.state.onStopAssigned(this);
  return inserted;
}
assignCarCall(floor: number): boolean {
  const inserted = this.insertStop(floor);
  if (inserted) this.state.onStopAssigned(this);
  return inserted;
}
```

Note: `onStopAssigned` only needs to fire when `insertStop` actually inserted something — calling it on a no-op would re-trigger `IdleState`'s dispatch logic for no reason (harmless today since it's idempotent, but firing it conditionally is more correct and marginally cheaper).

## Verification

**Commands:**
- `npm test --workspace=backend` -- expected: all tests pass (Stories 1.1–1.4 combined) -- ACTUAL: 43/43 passed (3 test files)
- `npm run build --workspace=backend` -- expected: zero type errors -- ACTUAL: `tsc --noEmit` clean, zero errors
- `grep -rn "addStop\|removeStop\|onHallAssigned" backend/` -- expected: zero references -- ACTUAL: zero matches
