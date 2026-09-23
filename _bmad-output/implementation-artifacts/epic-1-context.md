# Epic 1 Context: Elevator Domain Core

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Prove, via unit tests and a headless demo path, that the dispatch logic and Elevator state machine are correct under the SCAN/LOOK rule and structurally demonstrate OOP (encapsulation, inheritance, polymorphism). This epic has no UI dependency — it is the highest-weighted, highest-risk part of the evaluation and must be built and validated before anything else.

## Stories

- Story 1.1: Elevator State Machine Foundation
- Story 1.2: Dispatch Engine — SCAN/LOOK Hall Call Assignment
- Story 1.3: Pending Call Re-evaluation
- Story 1.4: Stop Queue Integrity
- Story 1.5: Multi-Elevator Building Coordination

## Requirements & Constraints

- Hall Calls are assigned under the SCAN/LOOK rule via a Nearest-Car strategy: an idle elevator, or one already moving in the requested direction with the floor still ahead, is eligible; among eligible elevators the nearest wins. The canonical worked example: an elevator moving 1→10 accepts a ↑ call at floor 5 but rejects a ↓ call at floor 5.
- A Hall Call with no eligible elevator at request time becomes Pending — never dropped — and is re-evaluated whenever any elevator idles or reverses direction.
- A moving elevator stops only where its stop queue and current direction agree; stop-queue insertion must never cause overshoot.
- Elevator and Dispatcher behavior must be polymorphic (state pattern, strategy pattern) — no conditional/switch-based dispatch on state or strategy type.
- The `ElevatorState` hierarchy must be a real ≥2-level inheritance tree: `ElevatorState` (abstract) → `MovingState` (abstract) → `MovingUpState`/`MovingDownState`, plus `IdleState` and `DoorOpenState`.
- `Elevator`'s internal state (`currentFloor`, `direction`, `doorState`, `stopQueue`) is encapsulated — mutated only via its own public commands or its current state's handlers.
- 3 elevators operate concurrently and independently; one must never block, delay, or corrupt another.
- Floor count and elevator count are parameterized (a config change, not a code change).
- Dispatch logic and state transitions must be unit-testable in isolation, with no server/WS running. `NearestCarStrategy` and each Elevator state's transitions ship with unit tests.
- Correctness over polish: every SCAN/LOOK edge case — not just the single worked example — must resolve correctly; this is the highest-weighted evaluation criterion.
- OOP legibility (encapsulation, inheritance, polymorphism) must be identifiable by reading the code, without narration.

## Technical Decisions

- Domain code (`domain/`) has zero dependency on `ws/`, `server.ts`, React, or Redux — it is a pure hexagon core, unit-testable standalone.
- `Elevator`'s fields are mutated only via its own methods or its current `ElevatorState`'s handlers (`onTick`, `onArriveFloor`, `onHallAssigned`); each transition has exactly one designated writer. Every public command (`assignHallCall`, `assignCarCall`, `openDoor`, `closeDoor`) returns a result indicating acceptance.
- `Dispatcher` holds only a `SchedulingStrategy` interface reference and never branches on the concrete strategy's type, even with `NearestCarStrategy` as the sole implementation. Car Call intentionally never touches `Dispatcher`/`SchedulingStrategy` — it's an in-cabin, direct-to-`Elevator` operation with no elevator-selection decision.
- `assignHallCall` and `assignCarCall` both insert through one shared private `insertStop(floor)` method — no second insertion path. `insertStop` orders relative to current `Direction`; when the queue is empty and `Direction === 'IDLE'`, the first insert sets `Direction`. It no-ops a floor equal to `currentFloor` while `doorState !== 'CLOSED'`, and de-duplicates an already-queued floor. Removal is centralized in exactly one method, `completeStop(floor)`, called only from the arrival handler — no other method (including `closeDoor`) removes queue entries.
- `Building.tick()` ticks every Elevator first, in fixed array order, then calls `Dispatcher.reevaluatePending()` exactly once at tick-end — pull-based, never triggered mid-loop by an Elevator. Pending Calls are processed FIFO; the Strategy is invoked fresh per call so results are reproducible for identical input.
- Each `Elevator` instance owns only its own fields; no elevator's transition reads or writes another elevator's state. `SchedulingStrategy`/`Dispatcher` read elevators only via public read-only accessors — never live cross-elevator access.
- Domain types/enums: `Direction` = `'UP' | 'DOWN' | 'IDLE'`; `DoorState` = `'OPEN' | 'OPENING' | 'CLOSING' | 'CLOSED'`. Floors are 1-indexed integers.
- Structural seed for this epic: `backend/src/domain/{Direction.ts, DoorState.ts, Elevator.ts}`, `domain/states/{ElevatorState, IdleState, MovingState, MovingUpState, MovingDownState, DoorOpenState}`, `domain/scheduling/{SchedulingStrategy, NearestCarStrategy}`, `domain/{Dispatcher.ts, Building.ts}`.
- Class/type naming must match verbatim: `Elevator`, `ElevatorState`, `MovingState`, `IdleState`, `MovingUpState`, `MovingDownState`, `DoorOpenState`, `Dispatcher`, `SchedulingStrategy`, `NearestCarStrategy`, `PendingCall`, `StopQueue`, `Building`.
- Repo is an npm workspace (root `package.json` with `backend`/`frontend`/`shared` workspaces). Stack for this epic: Node.js 24 LTS (24.21.0), TypeScript ^5.9 (not 7.0.x), Vitest 5.0.1.
- Unit test scenarios expected for `NearestCarStrategy`: idle-nearest, moving-same-direction-ahead (accept), moving-opposite-direction (reject), all-elevators-ineligible (falls to Pending). A small integration test should run `Building.tick()` across multiple ticks and assert the final snapshot state — no UI needed.
- Door dwell timer and simulation tick rate are not this epic's concern to wire up against real time, but downstream design assumes a dwell timer (~3s) and tick interval (~500ms); this epic's state machine should accommodate that model even though WS/timers are added in Epic 2.

## Cross-Story Dependencies

- Story 1.1 (state machine) is the foundation: Stories 1.2–1.5 all build on `Elevator`'s states and public command surface.
- Story 1.2 (Dispatch/SCAN-LOOK) depends on Story 1.1's `Elevator` state exposure (direction, floor) to evaluate eligibility.
- Story 1.3 (Pending re-evaluation) depends on Story 1.2's `Dispatcher`/`NearestCarStrategy` — it reuses the same selection logic on retry.
- Story 1.4 (Stop Queue integrity) underpins both Story 1.2 (Hall Call insertion) and Story 1.3 (re-evaluation assigns via the same `insertStop` path); it should land alongside or before heavy use of `assignHallCall`/`assignCarCall`.
- Story 1.5 (multi-elevator/Building coordination) depends on all prior stories being elevator-instance-safe (no shared mutable state) and wires `Building.tick()`'s fixed-order loop plus the single end-of-tick `reevaluatePending()` call described in Story 1.3.
- Epic 2 (Real-time Web App) depends entirely on this epic's `Building`/`Dispatcher`/`Elevator` domain core being complete and correct before wrapping it in a WebSocket adapter.
