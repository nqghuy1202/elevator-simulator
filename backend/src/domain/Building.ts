import { Dispatcher } from './Dispatcher.js';
import { Elevator, type ElevatorSnapshot } from './Elevator.js';
import { NearestCarStrategy } from './scheduling/NearestCarStrategy.js';
import type { HallCallRequest } from './scheduling/SchedulingStrategy.js';

/** Constructor configuration for `Building` — the sole parameterization point for FR-16. */
export interface BuildingConfig {
  readonly floors: number;
  readonly elevatorCount: number;
}

/**
 * Composition root that owns a fixed set of `Elevator`s and the single
 * `Dispatcher` coordinating them. `tick()` is the AD-7 wiring this epic has
 * been building toward: every Elevator ticks first, in fixed (construction)
 * order, then `Dispatcher.reevaluatePending()` runs exactly once, at the end
 * of that same tick — never before all elevators have ticked, never more
 * than once.
 *
 * `Building` is deliberately thin: it introduces no new domain logic, only
 * composes `Elevator`/`Dispatcher`/`NearestCarStrategy` (all unmodified) and
 * exposes a read-only, non-leaking surface to external callers (tests today,
 * Epic 2's WS adapter later).
 */
export class Building {
  private readonly elevators: Elevator[];
  private readonly dispatcher: Dispatcher;
  private readonly floors: number;
  /**
   * Every Hall Call `{floor, direction}` from press until the elevator that
   * took it opens its doors there (Story 2.3, FR-2). Independent of
   * `Dispatcher`'s pending-call backlog: a call added here stays until
   * `drainServicedHallCalls` observes an elevator open its doors at that
   * floor having taken that direction — regardless of how quickly (or
   * slowly) `Dispatcher` assigns it.
   */
  private outstandingHallCalls: HallCallRequest[] = [];

  constructor({ floors, elevatorCount }: BuildingConfig) {
    if (!Number.isInteger(floors) || floors <= 0) {
      throw new Error(`Building floors must be a positive integer, got ${floors}`);
    }
    if (!Number.isInteger(elevatorCount) || elevatorCount <= 0) {
      throw new Error(`Building elevatorCount must be a positive integer, got ${elevatorCount}`);
    }
    this.floors = floors;
    this.elevators = Array.from({ length: elevatorCount }, (_, i) => new Elevator(`E${i + 1}`, 1));
    this.dispatcher = new Dispatcher(this.elevators, new NearestCarStrategy());
  }

  /**
   * Advance the simulation by one tick: every Elevator ticks first, in
   * fixed array order, then `Dispatcher.reevaluatePending()` runs exactly
   * once (AD-7). Pending Calls resolved by an elevator that becomes
   * eligible during this same loop are picked up within this same
   * `tick()` call, since `reevaluatePending()` always runs after every
   * elevator has ticked.
   */
  tick(): void {
    for (const elevator of this.elevators) {
      elevator.tick();
    }
    this.dispatcher.reevaluatePending();
    // Covers arrivals-by-movement and any later reassignment: must run after
    // reevaluatePending() so a call resolved within this same tick is
    // observed as serviced (if its assignee also opens its doors this tick).
    this.drainServicedHallCalls();
  }

  /**
   * Handle a Hall Call for `floor` in `direction`, delegating to this
   * Building's `Dispatcher`. External callers reach Hall Call assignment
   * through `Building`, never through `Dispatcher` directly.
   *
   * Also records `{floor, direction}` in `outstandingHallCalls` (deduped by
   * floor+direction, same pattern as `Dispatcher.addPending`) — independent
   * of `Dispatcher`'s own pending-call bookkeeping — and immediately drains
   * any Hall Calls serviced synchronously by this same call (the same-floor
   * fast path, or a press while an elevator's doors are already open here).
   */
  handleHallCall(floor: number, direction: HallCallRequest['direction']): void {
    this.addOutstandingHallCall({ floor, direction });
    this.dispatcher.handleHallCall(floor, direction);
    this.drainServicedHallCalls();
  }

  /**
   * Handle a Car Call for `floor` on the elevator identified by
   * `elevatorId` (in-cabin button press). Silent no-op if `elevatorId`
   * doesn't match any managed Elevator — this is a client-input boundary,
   * distinct from `Dispatcher.tryAssign`'s internal-consistency throw.
   */
  handleCarCall(elevatorId: string, floor: number): void {
    const elevator = this.findElevator(elevatorId);
    elevator?.assignCarCall(floor);
  }

  /**
   * Handle a Door Hold for the elevator identified by `elevatorId`. Silent
   * no-op if `elevatorId` doesn't match any managed Elevator, or if that
   * elevator isn't currently holding its doors open (per `Elevator.openDoor`).
   */
  handleDoorHold(elevatorId: string): void {
    const elevator = this.findElevator(elevatorId);
    elevator?.openDoor();
  }

  /**
   * Handle a Door Close for the elevator identified by `elevatorId`. Silent
   * no-op if `elevatorId` doesn't match any managed Elevator, or if that
   * elevator's doors aren't currently open (per `Elevator.closeDoor`).
   */
  handleDoorClose(elevatorId: string): void {
    const elevator = this.findElevator(elevatorId);
    elevator?.closeDoor();
  }

  /** Read-only snapshots of every managed Elevator, in fixed (construction) order. */
  getElevatorSnapshots(): ElevatorSnapshot[] {
    return this.elevators.map((elevator) => elevator.getSnapshot());
  }

  /** Read-only view of currently pending Hall Calls, in FIFO arrival order. */
  getPendingCalls(): readonly HallCallRequest[] {
    return this.dispatcher.getPendingCalls();
  }

  /**
   * Read-only view of every Hall Call from press until serviced (Story 2.3,
   * FR-2) — independent of `getPendingCalls()`'s Dispatcher-backlog concept.
   */
  getActiveHallCalls(): readonly HallCallRequest[] {
    return [...this.outstandingHallCalls];
  }

  /** The floor count this Building was configured with. */
  getFloorCount(): number {
    return this.floors;
  }

  /**
   * Find a managed Elevator by id, or `undefined` if `elevatorId` doesn't
   * match any of them. Backs the silent-no-op-on-unknown-id contract shared
   * by `handleCarCall`/`handleDoorHold`/`handleDoorClose`.
   */
  private findElevator(elevatorId: string): Elevator | undefined {
    return this.elevators.find((elevator) => elevator.id === elevatorId);
  }

  /** Record `request` in `outstandingHallCalls`, unless one for the same (floor, direction) is already outstanding. */
  private addOutstandingHallCall(request: HallCallRequest): void {
    const alreadyOutstanding = this.outstandingHallCalls.some(
      (call) => call.floor === request.floor && call.direction === request.direction,
    );
    if (!alreadyOutstanding) {
      this.outstandingHallCalls.push(request);
    }
  }

  /**
   * For every Elevator whose doors are currently `OPEN`, drain whichever
   * Hall Call directions it has taken responsibility for at its current
   * floor (`takeServicedHallCallDirections`) and remove matching entries
   * from `outstandingHallCalls`. Called at the end of `handleHallCall()`
   * (covers the synchronous same-floor fast path) and at the end of
   * `tick()`, after `reevaluatePending()` (covers arrivals-by-movement and
   * later reassignment).
   */
  private drainServicedHallCalls(): void {
    for (const elevator of this.elevators) {
      const snapshot = elevator.getSnapshot();
      if (snapshot.doorState !== 'OPEN') continue;

      for (const direction of elevator.takeServicedHallCallDirections(snapshot.currentFloor)) {
        this.outstandingHallCalls = this.outstandingHallCalls.filter(
          (call) => !(call.floor === snapshot.currentFloor && call.direction === direction),
        );
      }
    }
  }
}
