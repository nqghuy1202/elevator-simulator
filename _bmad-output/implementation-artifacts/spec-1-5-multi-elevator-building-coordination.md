---
title: 'Multi-Elevator Building Coordination'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: 'b21eac1758dc8a7dadeed521b4f2f39c563be229'
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

**Problem:** Stories 1.1–1.4 built a correct single-elevator state machine and a `Dispatcher` that can assign and retry Hall Calls — but nothing yet owns multiple `Elevator` instances together, drives the tick loop, or calls `Dispatcher.reevaluatePending()`. `reevaluatePending()` has been callable-but-never-called since Story 1.3.

**Approach:** Add `Building`, the last piece of Epic 1: holds a configurable number of `Elevator`s and a `Dispatcher`; `Building.tick()` ticks every Elevator first, in fixed array order, then calls `Dispatcher.reevaluatePending()` exactly once — the AD-7 wiring this whole epic has been building toward. `Building`'s constructor takes floor count and elevator count as configuration, satisfying FR-16.

## Boundaries & Constraints

**Always:**
- `Building.tick()` calls each `Elevator.tick()` first, in the fixed order the elevators array was constructed in, then calls `Dispatcher.reevaluatePending()` exactly once, at the end of that same tick call — never before all elevators have ticked, never more than once (AD-7).
- `Building`'s constructor accepts `{ floors: number; elevatorCount: number }`; changing either is a constructor-argument change, not a code change to `Dispatcher`/`Elevator`/state logic (FR-16).
- `Building` exposes Hall Call assignment (`handleHallCall(floor, direction)`) by delegating to its `Dispatcher` — external callers (tests today, Epic 2's WS adapter later) go through `Building`, not by reaching into `Dispatcher` directly.
- `Building` exposes read-only introspection: `getElevatorSnapshots(): ElevatorSnapshot[]`, `getPendingCalls(): readonly HallCallRequest[]`, `getFloorCount(): number` — no method returns a live `Elevator` reference.
- Each `Elevator` instance is independently constructed and owns only its own fields; `Building` never lets one `Elevator` read or write another's state (FR-15, AD-8 — already structurally guaranteed by Stories 1.1–1.4, verified here at the multi-instance level for the first time).

**Never:**
- No WebSocket/transport code, no `shared/` wire-contract types, no `tick` sequence numbers — those are Epic 2 Story 2.1's job. `Building`'s snapshot methods are domain-level only.
- No changes to `Elevator`, `Dispatcher`, `NearestCarStrategy`, or any `ElevatorState` — this story only adds `Building` as a new composition root around the existing, unmodified pieces.
- No floor-bounds validation on `handleHallCall`'s `floor` argument — deferred to whichever system boundary introduces untrusted input (Epic 2's WS adapter), consistent with the decision already made in Story 1.2's review.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default construction | `new Building({ floors: 10, elevatorCount: 3 })` | 3 `Elevator`s created, all Idle at floor 1; `getElevatorSnapshots()` returns 3 entries | No error expected |
| Hall Call routes end-to-end through Building | `building.handleHallCall(5, 'UP')` then repeated `building.tick()` | The nearest elevator is assigned and eventually arrives at floor 5, doors open (same behavior as direct `Dispatcher` use, Stories 1.2–1.4) | No error expected |
| `reevaluatePending` runs exactly once per `tick()`, after all elevators | A pending call exists; the elevator that frees it up reaches Idle during the *same* `Building.tick()` call it becomes eligible in | The pending call is resolved within that single `tick()` call — proving elevators tick before `reevaluatePending()` runs, not after or interleaved | No error expected |
| Two elevators operate independently in the same tick | Elevator A assigned a call heading UP, Elevator B assigned a different call heading DOWN, both ticked via one `building.tick()` | Both progress correctly on their own paths; neither's `stopQueue`/`direction`/`currentFloor` is affected by the other's movement | No error expected |
| Configurable floor/elevator count | `new Building({ floors: 5, elevatorCount: 2 })` | 2 `Elevator`s created; a Hall Call assigned and ticked to completion behaves identically in shape to the 10-floor/3-elevator default — no code branch differs | No error expected |
| Introspection never exposes a live `Elevator` | `building.getElevatorSnapshots()` | Returns plain `ElevatorSnapshot` data (per Story 1.1's `getSnapshot()`), not `Elevator` instances | No error expected |

</frozen-after-approval>

## Code Map

- `backend/src/domain/Building.ts` -- NEW: composition root — constructs `Elevator[]` + `Dispatcher`, `tick()`, `handleHallCall()`, `getElevatorSnapshots()`, `getPendingCalls()`, `getFloorCount()`
- `backend/src/domain/Building.test.ts` -- NEW: tests covering every I/O Matrix row
- `backend/src/domain/Elevator.ts`, `Dispatcher.ts`, `NearestCarStrategy.ts`, states/* -- reuse only, no edits

## Tasks & Acceptance

**Execution:**
- [ ] `backend/src/domain/Building.ts` -- constructor `{ floors: number; elevatorCount: number }`: build `elevatorCount` `Elevator`s (ids `E1..EN`, starting at floor 1), one `Dispatcher` wrapping them with `NearestCarStrategy` -- FR-16
- [ ] `backend/src/domain/Building.ts` -- `tick()`: iterate elevators in fixed (construction) order calling `.tick()` on each, then call `dispatcher.reevaluatePending()` exactly once -- AD-7
- [ ] `backend/src/domain/Building.ts` -- `handleHallCall(floor, direction)`: delegates to `dispatcher.handleHallCall` -- FR-1, encapsulation boundary for future callers
- [ ] `backend/src/domain/Building.ts` -- `getElevatorSnapshots()`, `getPendingCalls()`, `getFloorCount()`: read-only introspection, no live `Elevator` exposure -- AD-8
- [ ] `backend/src/domain/Building.test.ts` -- one test per I/O Matrix row -- FR-15, FR-16, NFR-5
- [ ] `backend/src/demo.ts` -- ADDED post-review, user-approved: standalone headless demo script — construct a default `Building` (10 floors, 3 elevators), place a few Hall Calls (including the PRD's worked example), run ~20 ticks, `console.log` a readable snapshot each tick -- fulfills Epic 1's "headless demo path" goal
- [ ] `backend/package.json` -- ADDED post-review: `demo` script running `backend/src/demo.ts` (add `tsx` as a devDependency to run TS directly, no build step) -- makes the demo runnable via `npm run demo --workspace=backend`

**Acceptance Criteria:**
- Given `Building.tick()`'s implementation, when read, then it ticks every elevator before calling `reevaluatePending()`, and calls `reevaluatePending()` exactly once per `tick()` invocation
- Given two `Building` instances constructed with different `{ floors, elevatorCount }`, when the same Hall Call + tick sequence is run against each, then both resolve correctly with no code path unique to either configuration
- Given `Building`'s public methods, when inspected, then none returns a live `Elevator` reference — only `ElevatorSnapshot`/`HallCallRequest` data

## Implementation Notes

## Spec Change Log

## Review Triage Log

**Lenses run:** blind-hunter (7 findings), edge-case-hunter (3 findings), verification-gap (0 gaps), intent-alignment (descriptive, 1 significant ambiguity surfaced to user).

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| 1 | (blind-hunter, edge-case-hunter x3) `Building`'s constructor never validates `floors`/`elevatorCount` — zero, negative, or non-integer values either throw an opaque `RangeError` (`Array.from({length: -1}, ...)`) or silently produce a useless/broken `Building`. | patch | Real, cheap: `Elevator`'s own constructor already validates `startFloor`; this config entry point deserves the same. |
| 2 | (blind-hunter) No test for tie-break determinism when two idle elevators are equidistant, at the `Building` level. | false | Already covered at the correct layer — `NearestCarStrategy`'s own tie-break test (Story 1.2). `Building` is a thin pass-through; re-testing the same property here would be duplicative, not new coverage. |
| 3 | (blind-hunter) Verification section says "Epic 1 complete: Stories 1.1–1.5" while `sprint-status.yaml` still shows Stories 1.2–1.4 at `review`, not `done`. | patch (doc-only) | Real wording imprecision — `review` (not `done`) is the correct, intentional terminal state this workflow's own step-05 always sets after an automated review pass; softened the claim directly rather than changing sprint-status semantics. |
| 4 | (blind-hunter) `getFloorCount()`/`floors` aren't used to bound `handleHallCall`; no test confirms an out-of-range floor is still a harmless no-op today. | false | Already explicitly and repeatedly decided (Story 1.2's review, reaffirmed in this story's own "Never" list): floor-bounds validation belongs at the future input boundary (Epic 2's WS adapter), not here. No new information. |
| 5 | (blind-hunter) No test for *multiple* elevators becoming simultaneously eligible in the same `tick()`, with multiple pending calls — the genuine multi-elevator version of AD-7's core claim, not covered by Story 1.3's Dispatcher-only test (which didn't drive real elevators through `Building.tick()`). | patch | Real gap: this is new composition-level behavior specific to what `Building` introduces, not a duplicate of an existing test. |
| 6 | (blind-hunter) Design Notes' embedded code sketch omits `BuildingConfig`, `handleHallCall`, `getElevatorSnapshots`, `getPendingCalls`, `getFloorCount` — stale vs. the actual public surface described a few sections earlier. | patch (doc-only) | Confirmed stale; corrected directly. |
| 7 | (blind-hunter) `Elevator` construction hardcodes `startFloor: 1` for every car with no documented rationale. | patch (doc-only) | Real, cheap: documented as a deliberate simplification in Implementation Notes. |
| 8 | (intent-alignment) The Problem statement's "drives the tick loop" is genuinely ambiguous: does it require `Building.tick()`'s *internal ordering* to be correct (satisfied — proven by 4 describe blocks), or a real runtime driver/demo path invoking it outside tests (not satisfied — nothing outside `Building.test.ts` calls `tick()`, and Epic 1's own goal statement in `epics.md` promises a "headless demo path" no story concretely delivered)? | intent_gap | Root cause is inside this story's own frozen Problem statement, genuinely ambiguous between two defensible readings — not something I should silently resolve either way. Surfaced to the user directly rather than guessed. |

**Routing:** #1, #5 → patch (re-engaged step-03 implementer). #3, #6, #7 → doc-only, applied directly. #8 → surfaced to user as a question (see below). #2, #4 → false, no action.

**#8 resolved by user:** add a small headless demo script — `backend/src/demo.ts`, run via a new `demo` npm script, constructing a `Building`, placing a few Hall Calls, ticking it repeatedly, and logging snapshots to console. Added as an additional task below (post-review scope addition, explicitly approved).

## Design Notes

```ts
interface BuildingConfig { floors: number; elevatorCount: number; }

class Building {
  private readonly elevators: Elevator[];
  private readonly dispatcher: Dispatcher;
  private readonly floors: number;

  constructor({ floors, elevatorCount }: BuildingConfig) {
    this.floors = floors;
    this.elevators = Array.from({ length: elevatorCount }, (_, i) => new Elevator(`E${i + 1}`, 1));
    this.dispatcher = new Dispatcher(this.elevators, new NearestCarStrategy());
  }

  tick(): void {
    for (const elevator of this.elevators) elevator.tick();
    this.dispatcher.reevaluatePending();
  }

  handleHallCall(floor: number, direction: HallCallRequest['direction']): void {
    this.dispatcher.handleHallCall(floor, direction);
  }

  getElevatorSnapshots(): ElevatorSnapshot[] { return this.elevators.map((e) => e.getSnapshot()); }
  getPendingCalls(): readonly HallCallRequest[] { return this.dispatcher.getPendingCalls(); }
  getFloorCount(): number { return this.floors; }
}
```

All elevators start at floor 1 — a deliberate simplification (real buildings sometimes stagger parked cars; this simulator doesn't need to) rather than a gap. `floors`/`getFloorCount()` is stored and exposed but not yet used to bound `handleHallCall`'s input — consistent with the standing decision (Story 1.2's review) that boundary validation belongs at the future untrusted-input edge (Epic 2's WS adapter), not here.

This is the epic's payoff moment: every invariant Stories 1.1–1.4 built in isolation (encapsulation, polymorphism, SCAN/LOOK eligibility, pending retry, AD-6's insertion contract) is exercised together for the first time through one `Building` composition root, with nothing new to get wrong at the domain level — `Building` is deliberately thin.

## Verification

**Commands:**
- `npm test --workspace=backend` -- expected: all tests pass (all 5 Epic 1 stories' code merged; sprint-status promotion to `done` for 1.2–1.4 happens per this workflow's own review-state conventions, not implied by this line)
- `npm run build --workspace=backend` -- expected: zero type errors
