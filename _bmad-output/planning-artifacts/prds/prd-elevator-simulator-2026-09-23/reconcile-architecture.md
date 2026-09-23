# Reconciliation: ARCHITECTURE.md → PRD

**Source input:** `docs/ARCHITECTURE.md`
**Target PRD:** `_bmad-output/planning-artifacts/prds/prd-elevator-simulator-2026-09-23/prd.md`
**Date:** 2026-09-23

Scope of this pass: capability-level gaps only. Implementation detail (pseudocode, class names, file layout) is intentionally NOT flagged as missing from the PRD — that's expected, per the PRD's own stated boundary (§0: "this PRD does not duplicate [ARCHITECTURE.md]; it defines *what*... ARCHITECTURE.md defines *how*").

---

## 1. Section 8 edge cases — coverage check

ARCHITECTURE.md §8 lists 5 edge cases. Status of each against the PRD:

| # | Edge case (ARCHITECTURE.md §8) | PRD coverage | Status |
|---|---|---|---|
| 1 | Multiple hall calls at once, different floors/directions — `reevaluatePending` must not drop any | FR-7 ("No Hall Call is ever discarded... re-evaluated") | Covered |
| 2 | Hall call at a floor where an elevator is already stopped with doors open, same eventual direction — optional merge optimization | PRD §6.2 explicitly lists "Hall-call merge optimization... noted in ARCHITECTURE.md §8 as optional" as Out of Scope for MVP | Covered — explicitly out-of-scope, matches ARCHITECTURE.md's own "optional, not required" framing |
| 3 | Repeated Hold presses — must only reset timer, not allow infinite hold (optional max-hold cap) | FR-4 covers reset-timer behavior. §6.2 explicitly defers "Max-hold-time cap on Door Hold" as optional hardening | Covered |
| 4 | All 3 elevators busy/going wrong direction → request must land in pendingCalls, not be lost | FR-7 | Covered |
| 5 | Elevator already has a long Stop Queue (many car calls) — queue must stay a sorted set matching current direction so the car never overshoots and has to backtrack | **No direct FR or NFR states this invariant.** FR-3 says Car Calls are "added to the Stop Queue in current-direction order" (close, but only covers insertion, not the general correctness invariant under a long/growing queue). FR-8 covers direction-matching for *stopping*, not queue *ordering* under load. | **Gap** — see Gap 1 below |

## 2. Section 9 testing strategy — comparison

ARCHITECTURE.md §9 proposes three concrete required test types as part of the design:
- Unit tests for `NearestCarStrategy.selectElevator` (idle-nearest, same-direction-ahead, wrong-direction-excluded, all-ineligible-falls-to-pending cases)
- Unit tests per `ElevatorState` (especially Moving states: only stop when floor is in queue AND direction matches)
- A small integration test running `Building.tick()` over multiple ticks, checking final snapshot correctness

PRD's stance (§6.2, §7, §8, §9):
- §7 NFR "Testability": "Dispatch logic and state transitions must be unit-testable in isolation" — this is a capability (testable-in-isolation), not a commitment to write the tests.
- §6.2 Out of Scope: "Broad automated test coverage / CI pipeline — testing scope intentionally limited to what's needed for the 45-min presentation... (decided by user)."
- §8 Constraints: scope-cutting order ranks "test coverage" near the bottom (above only Docker).
- §9 Success Metrics: SM-1 relies on *manual* test / demo-time correctness, not automated tests.

**Status:** This is a **documented scope decision**, not an oversight — the PRD is aware of and consciously narrows ARCHITECTURE.md's testing proposal. Flagging as a gap in the "the PRD contradicts/narrows the architecture doc" sense, not "the PRD forgot something." Worth a reviewer's explicit sign-off since ARCHITECTURE.md frames these tests as part of the recommended design, while the PRD downgrades automated tests to optional/deferred.

## 3. Glossary vs. class diagram — domain concepts implicitly relied on but undefined

ARCHITECTURE.md §2 class diagram concepts checked against PRD §3 Glossary:

| Concept in ARCHITECTURE.md | Used implicitly by which FR | In PRD Glossary? |
|---|---|---|
| `Direction`, `DoorState`, `Dwell Timer`, `Stop Queue`, `Dispatcher`, `Pending Call`, `Hall Call`, `Car Call`, `Snapshot`, `Building`, `Nearest-Car Strategy`, `SCAN/LOOK Rule` | Various | Yes — all defined |
| `ElevatorState` (abstract state-machine concept: Idle/MovingUp/MovingDown/DoorOpen as a formal state type) | FR-9 ("governed by an explicit, inspectable state model"), FR-10 | **Not in Glossary** — FR-9 names the four states inline but the Glossary never defines "Elevator State" as a first-class term, unlike its sibling concepts (Direction, Door State) which do get entries |
| `SchedulingStrategy` (the swappable interface, distinct from `Nearest-Car Strategy` the concrete implementation) | Referenced implicitly in §5 Non-Goals ("Strategy pattern makes one swappable in ARCHITECTURE.md") | **Not in Glossary** — only the concrete Nearest-Car Strategy is defined; the abstract strategy concept that Non-Goals references by name is not |
| `isAhead(elevator, floor, dir)` — the "lies ahead of current position" test | FR-6 ("requested floor still ahead of it") | Not in Glossary — minor; FR-6's phrasing is close enough that this is a nice-to-have, not a real ambiguity risk |

---

## Summary of gaps

1. **Stop Queue ordering/no-overshoot invariant** (ARCHITECTURE.md §8, edge case 5) has no explicit FR or NFR. FR-3 and FR-8 partially cover adjacent behavior (insertion order, stop-only-if-direction-matches) but neither states the general invariant that a long/growing Stop Queue must remain correctly ordered so the elevator never passes a queued floor without stopping and has to reverse to catch it. Recommend either a new FR/NFR consequence under §4.4 Dispatch Engine or §4.5 State Machine, or an explicit note that this is subsumed by FR-8 if that's the intent.

2. **Testing strategy divergence between documents.** ARCHITECTURE.md §9 proposes three specific required automated test suites; PRD explicitly narrows this to "manual test coverage sufficient for the demo" and defers automated/CI coverage. This is a conscious, documented scope decision in the PRD (not a silent gap) — flagging so the reconciliation record shows the two documents intentionally diverge here, in case a reviewer expects ARCHITECTURE.md's testing section to be authoritative.

3. **"Elevator State" as a formal Glossary term is missing**, despite being structurally central to FR-9/FR-10 and to the OOP demonstration goal (§1 Vision, SM-2). Its sibling concept "Door State" has an entry; "Elevator State" (Idle/MovingUp/MovingDown/DoorOpen) does not.

4. **"Scheduling Strategy" (the abstract/swappable interface) is missing from the Glossary**, even though §5 Non-Goals references "Strategy pattern... swappable" by name. Only the concrete "Nearest-Car Strategy" is defined.

No missing edge cases were found for items 1-4 of ARCHITECTURE.md §8 — those are fully covered (either by an FR or by an explicit non-goal/out-of-scope entry that matches ARCHITECTURE.md's own "optional" framing).
