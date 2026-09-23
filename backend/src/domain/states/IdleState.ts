import type { Elevator } from '../Elevator.js';
import { ElevatorState } from './ElevatorState.js';
import { MovingUpState } from './MovingUpState.js';
import { MovingDownState } from './MovingDownState.js';

/**
 * Elevator is stationary with doors closed and nothing to do until a stop
 * is queued. Decides initial direction once a stop appears.
 */
export class IdleState extends ElevatorState {
  override readonly name = 'IDLE';

  override onTick(elevator: Elevator): void {
    this.dispatchIfNeeded(elevator);
  }

  override onHallAssigned(elevator: Elevator): void {
    this.dispatchIfNeeded(elevator);
  }

  private dispatchIfNeeded(elevator: Elevator): void {
    if (elevator.isStopQueueEmpty()) {
      // Nothing to do: tick is a no-op, stays Idle.
      return;
    }

    const floor = elevator.getCurrentFloor();
    if (elevator.hasStop(floor)) {
      elevator.removeStop(floor);
      elevator.openDoorForArrival();
      return;
    }

    if (elevator.hasStopAbove()) {
      elevator.setDirection('UP');
      elevator.setState(new MovingUpState());
      return;
    }

    if (elevator.hasStopBelow()) {
      elevator.setDirection('DOWN');
      elevator.setState(new MovingDownState());
    }
  }
}
