import { Elevator } from './Elevator.js';
import type { SchedulingStrategy } from './scheduling/SchedulingStrategy.js';

/**
 * Orchestrates Hall Call assignment: takes a snapshot of every managed
 * `Elevator`, delegates elevator selection to a `SchedulingStrategy`, and
 * — if one is selected — calls `addStop()` on the matching live `Elevator`.
 * Holds only the `SchedulingStrategy` interface; never branches on the
 * concrete strategy's type.
 */
export class Dispatcher {
  private readonly elevators: Elevator[];
  private readonly strategy: SchedulingStrategy;

  constructor(elevators: Elevator[], strategy: SchedulingStrategy) {
    this.elevators = elevators;
    this.strategy = strategy;
  }

  /**
   * Handle a Hall Call for `floor` in `direction`. If the strategy selects
   * an eligible elevator, queues the stop on it via `addStop()`. If no
   * elevator is eligible, does nothing — Pending Call storage is Story 1.3.
   */
  handleHallCall(floor: number, direction: 'UP' | 'DOWN'): void {
    const snapshots = this.elevators.map((elevator) => elevator.getSnapshot());
    const selected = this.strategy.selectElevator(snapshots, { floor, direction });

    if (selected === null) {
      return;
    }

    const elevator = this.elevators.find((candidate) => candidate.id === selected.id);
    if (!elevator) {
      throw new Error(`Dispatcher: strategy selected unknown elevator id "${selected.id}"`);
    }
    elevator.addStop(floor);
  }
}
