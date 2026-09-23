import type { Direction } from '../Direction.js';
import type { ElevatorSnapshot } from '../Elevator.js';

/** A Hall Call: a floor with the direction the waiting passenger wants to travel. */
export interface HallCallRequest {
  readonly floor: number;
  readonly direction: Exclude<Direction, 'IDLE'>;
}

/**
 * Polymorphism seam for elevator selection. Operates purely on read-only
 * `ElevatorSnapshot[]` data — never on live `Elevator` instances — so
 * implementations are unit-testable with plain snapshot literals.
 * `Dispatcher` holds a reference to this interface and never branches on
 * the concrete implementation.
 */
export interface SchedulingStrategy {
  /**
   * Select the elevator that should service `request`, or `null` if none
   * of `elevators` is eligible.
   */
  selectElevator(elevators: ElevatorSnapshot[], request: HallCallRequest): ElevatorSnapshot | null;
}
