import type { Elevator } from '../Elevator.js';

/** Identifier for each concrete ElevatorState. */
export type ElevatorStateName = 'IDLE' | 'MOVING_UP' | 'MOVING_DOWN' | 'DOOR_OPEN';

/**
 * Abstract root of the Elevator state hierarchy (state pattern).
 *
 * `Elevator.tick()` dispatches polymorphically to `this.state`'s `onTick` —
 * no switch/if-chain keyed on state name is allowed anywhere in this
 * hierarchy or in `Elevator`.
 */
export abstract class ElevatorState {
  /** Human-readable/testable identifier for the concrete state. */
  abstract readonly name: ElevatorStateName;

  /**
   * Advance simulation by one tick. Each concrete state decides what a
   * tick means for it (move a floor, count down a dwell timer, or no-op).
   */
  abstract onTick(elevator: Elevator): void;

  /**
   * Called when the elevator's position lands exactly on a floor that is
   * queued as a stop. Concrete states that can move override this to open
   * the doors; states that never move can leave the base no-op.
   */
  onArriveFloor(_elevator: Elevator): void {
    // No-op by default; movement states override.
  }

  /**
   * Called when a new stop is queued for this elevator while it is in this
   * state (Hall Call or Car Call insertion via `insertStop`). Idle needs
   * this to kick off movement; other states may leave the base no-op since
   * their `onTick` already inspects the queue.
   */
  onStopAssigned(_elevator: Elevator): void {
    // No-op by default.
  }
}
