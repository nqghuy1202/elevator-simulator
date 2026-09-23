import type { Elevator } from '../Elevator.js';
import { ElevatorState } from './ElevatorState.js';
import { IdleState } from './IdleState.js';
import { MovingUpState } from './MovingUpState.js';
import { MovingDownState } from './MovingDownState.js';

/**
 * Doors are open, holding for the dwell timer. When the timer expires the
 * door closes and this state decides what comes next: continue in the same
 * direction, reverse, or go Idle if the queue is empty.
 */
export class DoorOpenState extends ElevatorState {
  override readonly name = 'DOOR_OPEN';

  override onTick(elevator: Elevator): void {
    if (elevator.getDwellTicksRemaining() > 0) {
      elevator.decrementDwellTicks();
      return;
    }

    elevator.setDoorState('CLOSED');

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
      return;
    }

    elevator.setDirection('IDLE');
    elevator.setState(new IdleState());
  }
}
