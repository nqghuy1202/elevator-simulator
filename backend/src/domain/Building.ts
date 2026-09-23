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
  }

  /**
   * Handle a Hall Call for `floor` in `direction`, delegating to this
   * Building's `Dispatcher`. External callers reach Hall Call assignment
   * through `Building`, never through `Dispatcher` directly.
   */
  handleHallCall(floor: number, direction: HallCallRequest['direction']): void {
    this.dispatcher.handleHallCall(floor, direction);
  }

  /** Read-only snapshots of every managed Elevator, in fixed (construction) order. */
  getElevatorSnapshots(): ElevatorSnapshot[] {
    return this.elevators.map((elevator) => elevator.getSnapshot());
  }

  /** Read-only view of currently pending Hall Calls, in FIFO arrival order. */
  getPendingCalls(): readonly HallCallRequest[] {
    return this.dispatcher.getPendingCalls();
  }

  /** The floor count this Building was configured with. */
  getFloorCount(): number {
    return this.floors;
  }
}
