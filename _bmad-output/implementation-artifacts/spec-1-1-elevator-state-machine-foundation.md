---
title: 'Elevator State Machine Foundation'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_commit: '97916472b95b613cdaab695e8f4b2aaa3c440205'
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

**Problem:** No elevator domain model exists yet (greenfield). The simulator needs an Elevator whose movement/door behavior is a correct, inspectable state machine — not conditionals — and whose internal state is encapsulated, since this is the most heavily graded part of the take-home test.

**Approach:** Scaffold a fresh npm workspace (`backend` package, TypeScript ^5.9, Vitest 5.0.1) and implement `Elevator` plus a real `ElevatorState` inheritance hierarchy: `ElevatorState` (abstract) → `MovingState` (abstract) → `MovingUpState`/`MovingDownState`, plus `IdleState`/`DoorOpenState`. `Elevator.tick()` dispatches polymorphically to `this.state`.

## Boundaries & Constraints

**Always:**
- `Elevator`'s fields (`currentFloor`, `direction`, `doorState`, `stopQueue`) are private; reachable only via public commands or a read-only `getSnapshot()`.
- `Elevator.tick()` delegates to `this.state`'s handler — no `switch`/`if`-chain keyed on state name.
- `MovingUpState`/`MovingDownState` extend `MovingState` and inherit its shared movement logic, overriding only direction-specific behavior.
- `backend/src/domain/**` imports nothing outside the `domain` folder (no transport/UI dependency to violate yet, but the boundary starts here).
- Every test runs headless via Vitest — no server/WS involved.

**Never:**
- No `Dispatcher`, `SchedulingStrategy`, or `Building` — those are Stories 1.2 and 1.5.
- No Pending Call handling — Story 1.3.
- No formalized `insertStop`/`completeStop` single-entry-point queue API — that centralization contract is Story 1.4's job. This story only needs enough internal `stopQueue` representation for state transitions to be correct and testable; keep queue mutation private to `Elevator` so 1.4 can formalize it without an external API break.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Idle gets a stop above | `IdleState`, floor 5, stopQueue gets floor 8 | `tick()` transitions to `MovingUpState` | No error expected |
| Idle gets a stop below | `IdleState`, floor 5, stopQueue gets floor 2 | `tick()` transitions to `MovingDownState` | No error expected |
| Arrival at a queued floor, same direction | `MovingUpState`, floor 7→8, 8 in stopQueue | Transitions to `DoorOpenState` at floor 8; 8 removed from queue | No error expected |
| Passing a floor not in queue | `MovingUpState`, floor 6→7, 7 not in stopQueue | Elevator continues moving, stays `MovingUpState` | No error expected |
| Door open, queue empty above and below | `DoorOpenState`, dwell timer expires, stopQueue empty | Transitions to `IdleState` after closing | No error expected |
| Door open, more stops above | `DoorOpenState`, dwell expires, stopQueue has a higher floor | Transitions to `MovingUpState` after closing | No error expected |
| Door open, only stops below (reversal) | `DoorOpenState`, dwell expires, stopQueue has only lower floors | Transitions to `MovingDownState` after closing | No error expected |
| Tick with nothing to do | `IdleState`, empty stopQueue | `tick()` is a no-op, stays `IdleState` | No error expected |

</frozen-after-approval>

## Code Map

Greenfield — no existing backend code. Target files to create:

- `package.json` (root) -- npm workspace root, `workspaces: ["backend"]`
- `backend/package.json` -- backend workspace member: TypeScript ^5.9, Vitest ^5.0.1, `@types/node`, `test`/`build` scripts
- `backend/tsconfig.json` -- strict TS config, targets Node 24, enables private class fields/abstract classes
- `backend/vitest.config.ts` -- Vitest config scoped to `backend/src`
- `backend/src/domain/Direction.ts` -- `Direction` = `'UP' | 'DOWN' | 'IDLE'`
- `backend/src/domain/DoorState.ts` -- `DoorState` = `'OPEN' | 'OPENING' | 'CLOSING' | 'CLOSED'`
- `backend/src/domain/states/ElevatorState.ts` -- abstract base: `onTick`, `onArriveFloor`, `onHallAssigned`, `name`
- `backend/src/domain/states/MovingState.ts` -- abstract, extends `ElevatorState`, shared movement logic
- `backend/src/domain/states/MovingUpState.ts` / `MovingDownState.ts` -- extend `MovingState`
- `backend/src/domain/states/IdleState.ts`, `DoorOpenState.ts` -- extend `ElevatorState` directly
- `backend/src/domain/Elevator.ts` -- encapsulated class, `tick()`, `getSnapshot()`, private `setState`

## Tasks & Acceptance

**Execution:**
- [ ] `package.json` -- create npm workspace root (`workspaces: ["backend"]`) -- establishes the monorepo structure the Architecture Spine specifies
- [ ] `backend/package.json` -- create backend package (TS ^5.9, Vitest ^5.0.1, `@types/node`; scripts: `test`, `build`) -- backend workspace member
- [ ] `backend/tsconfig.json` -- strict config targeting Node 24 -- enables the OOP constructs this story needs
- [ ] `backend/vitest.config.ts` -- point at `backend/src/**/*.test.ts` -- headless test runner
- [ ] `backend/src/domain/Direction.ts`, `DoorState.ts` -- domain enums -- shared vocabulary, matches PRD Glossary verbatim
- [ ] `backend/src/domain/states/ElevatorState.ts` -- abstract base class -- FR-11 inheritance root
- [ ] `backend/src/domain/states/MovingState.ts` -- abstract, shared movement logic -- FR-11 intermediate level, avoids duplicating movement code in Up/Down
- [ ] `backend/src/domain/states/MovingUpState.ts`, `MovingDownState.ts` -- direction-specific leaves -- FR-11
- [ ] `backend/src/domain/states/IdleState.ts`, `DoorOpenState.ts` -- remaining leaves, `DoorOpenState` handles dwell-timer-driven reversal/idle decision -- FR-11
- [ ] `backend/src/domain/Elevator.ts` -- encapsulated fields, `tick()` polymorphic dispatch, `getSnapshot()`, private `setState` -- FR-10, FR-12, AD-2
- [ ] `backend/src/domain/Elevator.test.ts` -- unit tests covering every I/O Matrix row -- NFR-5

**Acceptance Criteria:**
- Given the workspace is scaffolded, when `npm install && npm test --workspace=backend` runs from repo root, then all tests pass with zero TypeScript errors
- Given `Elevator`'s fields, when accessed from outside the class, then `currentFloor`/`direction`/`doorState`/`stopQueue` are unreachable except via `getSnapshot()` or a public command (compiler-enforced via `private`)
- Given `Elevator.tick()`'s source, when read, then it contains no `switch`/`if`-chain branching on state name — only delegation to `this.state`

## Implementation Notes

- The natural class layout (`MovingState → DoorOpenState`, with `DoorOpenState → MovingUpState/MovingDownState → MovingState`) is a genuine ESM circular import; it broke at runtime (`Class extends value undefined`). Fixed by adding `Elevator.openDoorForArrival()`: `MovingState.onArriveFloor` calls it instead of constructing `DoorOpenState` itself. `MovingState.ts` now has no top-level dependency on any leaf state that extends it. Consistent with AD-2 — the transition is still triggered by a state handler, just performed via an `Elevator` method rather than the handler importing the target state class directly.
- `addStop`/`removeStop`/`hasStop`/`hasStopAbove`/`hasStopBelow` on `Elevator` are an internal-only queue surface for this story — not the formalized `insertStop`/`completeStop` single-entry-point contract (AD-6). Story 1.4 should replace/wrap these, not add a second parallel mutation path.
- Verified with `npm install && npm test --workspace=backend && npm run build --workspace=backend`: 9/9 tests pass (8 I/O Matrix rows + 1 snapshot-isolation check), zero TypeScript errors.
- Dev sandbox runs Node 22.14.0, not the Node 24 the Architecture Spine pins; `package.json` declares `engines: {"node": ">=24"}` as advisory. Everything installs/runs correctly regardless — flagged for verification on an actual Node 24 runtime before final grading if that matters.

## Spec Change Log

## Review Triage Log

**Lenses run:** blind-hunter (10 findings), edge-case-hunter (7 findings), verification-gap (0 gaps, 1 other finding), intent-alignment (4 divergences).

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| 1 | (blind-hunter, edge-case-hunter x2, verification-gap) A stop queued exactly at `currentFloor` is never serviced: `IdleState.dispatchIfNeeded` and `DoorOpenState.onTick` use `hasStopAbove()`/`hasStopBelow()` (strict `>`/`<`), which never match `floor === currentFloor`. Elevator stalls forever holding that stop. | high | Verified: read both call sites, confirmed strict-inequality-only checks with no equality branch. verification-gap independently reproduced by running `new Elevator('E1', 5).addStop(5)` then ticking — stayed `IDLE`, doors stayed `CLOSED`, floor 5 stuck in queue permanently. Real defect against the frozen spec's own "state transitions to be correct" requirement. |
| 2 | (edge-case-hunter, claim) Code Map/Tasks list `Elevator.ts` as having "private `setState`"; actual `setState` has no `private` modifier. | false | Checked `Elevator.ts:81-83` — `setState` is public, confirmed. But the *frozen* AC only requires the 4 named fields (`currentFloor`/`direction`/`doorState`/`stopQueue`) to be private, which holds. TypeScript has no access modifier granting one external class (`ElevatorState` subclasses, in separate files) access without making the member `public` — literal privacy for `setState` is not achievable in TS given `ElevatorState.onTick(elevator: Elevator)` must call it across the class boundary. The Code Map's "private setState" annotation was aspirational/imprecise, not a violated frozen AC. No code fix; stale planning-doc wording only (not actionable per "reject findings whose fix is to edit this spec"). |
| 3 | (blind-hunter) `stateName` on `ElevatorSnapshot` is typed `string`, not a union of the 4 concrete state-name literals. | low→patch | Real: confirmed `stateName: string` in `Elevator.ts`. Fix is a direct, trivial addition (a union type), narrows rather than expands public surface, and downstream consumers (Epic 2's WS layer) benefit from it now rather than discovering it later. |
| 4 | (blind-hunter) No test for a stop added via `addStop` while the elevator is already `MovingUpState`/`MovingDownState`/`DoorOpenState` (inherited no-op `onHallAssigned`). | patch | Verified behavior is correct today (queued stop is picked up naturally by the next `onArriveFloor` check) — this is a test-coverage gap, not a behavior bug. Trivial to add. |
| 5 | (edge-case-hunter) `Elevator` constructor accepts any `number` for `startFloor` with no validation. | patch | Real, minor. Fix is a direct guard clause, no public surface growth. |
| 6 | (blind-hunter, edge-case-hunter, intent-alignment) `moveOneFloor`/`MovingState.onTick` have no floor-bounds clamp; a `MovingUpState` with nothing queued above could in principle increment `currentFloor` forever. | false | Traced all call sites: `MovingUpState`/`MovingDownState` are only ever entered by `IdleState.dispatchIfNeeded` or `DoorOpenState.onTick`, both of which check `hasStopAbove()`/`hasStopBelow()` before transitioning — a stop in that direction is guaranteed to exist at entry, and nothing removes the last reachable stop without arriving at it. Unreachable given this story's actual code. Story 1.5 (`Building`/floor-count parameterization) is the natural owner of bounds enforcement once external callers exist — noted, not filed as a defect. |
| 7 | (blind-hunter) `Elevator.addStop`'s dedup early-return (`if includes, return`) skips calling `state.onHallAssigned`. | false | Traced: by the time a duplicate floor could be re-added, the elevator has already left `IdleState` for that floor (the first add already triggered dispatch), so the skipped call has no observable effect. No reachable stuck scenario. |
| 8 | (blind-hunter) `openDoorForArrival`'s circular-import workaround has no test asserting the exact call path, only indirect assertions via `stateName`. | false | Asserting observable state-machine outcomes (as the existing tests do) rather than internal call paths is the correct level for these tests; asserting the internal path would be over-specification. |
| 9 | (blind-hunter) `package-lock.json` committed without being named in the spec's Code Map. | false | Standard, expected npm output from `npm install` at a workspace root; lockfiles are supposed to be committed for reproducible installs. Not a real gap. |
| 10 | (blind-hunter) No automated lint rule enforcing "no switch/if-chain on state name" (the AC is a reading-time check only). | low | Rejected: fix requires new lint tooling/config, more than a direct correction. |
| 11 | (blind-hunter) No automated import-boundary rule (dependency-cruiser/ESLint) enforcing `domain/**`'s zero-transport-dependency rule. | low | Rejected: same reason as #10. |
| 12 | (blind-hunter, intent-alignment) Dev sandbox verified on Node 22.14.0, not the Node 24 the Architecture Spine/spec pin; `engines` field is advisory-only. | defer | Real, pre-existing environment constraint, not something this story's code can fix. Filed to `deferred-work.md`. |
| 13 | (intent-alignment) Broader "many public methods on `Elevator` beyond the 4 fields, gated only by comment" legibility concern. | false | Same TS access-control constraint as #2; already mitigated by the existing "Internal API" comment block separating the collaboration surface from the public command surface (`addStop`/`getSnapshot`). No further action. |
| 14 | (intent-alignment) `openDoorForArrival` moves part of the door-open transition onto `Elevator` itself rather than a state handler constructing `DoorOpenState`. | false | Architectural note, not a defect — already disclosed with rationale in Implementation Notes; consistent with AD-2 (transition still triggered by a state handler, executed via an `Elevator` method). |
| 15 | (intent-alignment) `addStop` (this story's throwaway queue API) isn't named in the 2-paragraph verbatim intent. | false | Consistent with the frozen spec's own "Never" boundary, which explicitly scopes the formal `insertStop`/`completeStop` contract out of this story. No action. |

**Routing:** #1, #3, #4, #5 → patch (re-engaged step-03 implementer). #12 → defer (`deferred-work.md`). All others → false/rejected, no action.

## Design Notes

State dispatch shape (illustrative, not prescriptive):

```ts
class Elevator {
  private state: ElevatorState = new IdleState();
  tick(): void { this.state.onTick(this); }
  setState(s: ElevatorState): void { this.state = s; } // called only by state handlers
}
```

`stopQueue` in this story is a plain private array good enough to drive correct transitions and tests (e.g. a package-internal push/shift used only inside `domain/`). Story 1.4 replaces ad hoc mutation with the single `insertStop`/`completeStop` entry points (AD-6) — don't build that contract now, just don't scatter direct array mutation across multiple classes so 1.4's refactor stays contained to `Elevator`.

## Verification

**Commands:**
- `npm install` -- expected: installs cleanly, no peer-dependency errors
- `npm test --workspace=backend` -- expected: all `Elevator.test.ts` cases pass
- `npm run build --workspace=backend` (`tsc --noEmit`) -- expected: zero type errors
