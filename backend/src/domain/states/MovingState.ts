import type { Elevator } from '../Elevator.js';
import type { Direction } from '../Direction.js';
import { ElevatorState } from './ElevatorState.js';

/**
 * Abstract intermediate level of the state hierarchy shared by
 * `MovingUpState`/`MovingDownState`. Holds the movement logic that is
 * identical regardless of direction; subclasses supply only the
 * direction-specific floor delta and direction tag.
 */
export abstract class MovingState extends ElevatorState {
  /** The Direction this concrete moving state represents. */
  protected abstract readonly direction: Direction;

  /** Per-tick floor delta: +1 for up, -1 for down. */
  protected abstract readonly floorDelta: 1 | -1;

  override onTick(elevator: Elevator): void {
    elevator.setDirection(this.direction);
    elevator.moveOneFloor(this.floorDelta);
    this.onArriveFloor(elevator);
  }

  override onArriveFloor(elevator: Elevator): void {
    const floor = elevator.getCurrentFloor();
    if (!elevator.hasStop(floor)) {
      // Passing a floor that isn't queued: keep moving, stay in this state.
      return;
    }

    elevator.removeStop(floor);
    elevator.openDoorForArrival();
  }
}
