import type { ElevatorSnapshot } from 'shared/src/index.js';
import { DestinationPanel } from './DestinationPanel.js';
import { DoorControls } from './DoorControls.js';

export interface ElevatorCarProps {
  readonly elevator: ElevatorSnapshot;
  readonly floors: number;
  readonly onCarCall: (elevatorId: string, floor: number) => void;
  readonly onDoorHold: (elevatorId: string) => void;
  readonly onDoorClose: (elevatorId: string) => void;
}

/**
 * One elevator's summary line (id/floor/direction/doorState — previously a
 * raw `<li>` inlined in `App.tsx`) plus its `DestinationPanel` (Story 2.4)
 * and `DoorControls` (Story 2.5), shown only while `elevator.doorState ===
 * 'OPEN'` per the Snapshot — no client-side memory of "was it open," they
 * appear/disappear purely by re-rendering off `doorState`.
 */
export function ElevatorCar({ elevator, floors, onCarCall, onDoorHold, onDoorClose }: ElevatorCarProps) {
  return (
    <li>
      {elevator.id}: floor {elevator.currentFloor}, {elevator.direction}, doors{' '}
      {elevator.doorState}
      {elevator.doorState === 'OPEN' && (
        <>
          <DestinationPanel
            elevatorId={elevator.id}
            currentFloor={elevator.currentFloor}
            floors={floors}
            stopQueue={elevator.stopQueue}
            onCarCall={onCarCall}
          />
          <DoorControls elevatorId={elevator.id} onDoorHold={onDoorHold} onDoorClose={onDoorClose} />
        </>
      )}
    </li>
  );
}
