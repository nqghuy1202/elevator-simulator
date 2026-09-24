import { ArrowUp, ArrowDown } from '@phosphor-icons/react';
import type { ElevatorSnapshot } from 'shared/src/index.js';
import { ROW_HEIGHT_PX } from '../designTokens.js';
import { DestinationPanel } from './DestinationPanel.js';
import { DoorControls } from './DoorControls.js';
import './ElevatorCar.css';

export interface ElevatorCarProps {
  readonly elevator: ElevatorSnapshot;
  readonly floors: number;
  readonly onCarCall: (elevatorId: string, floor: number) => void;
  readonly onDoorHold: (elevatorId: string) => void;
  readonly onDoorClose: (elevatorId: string) => void;
}

/**
 * One elevator, rendered as its own shaft column (Story 2.4/2.5, restyled
 * per EXPERIENCE.md's Shaft View). The cabin's vertical position is a CSS
 * `transform: translateY()` computed from `currentFloor`, transitioning at
 * 480ms — just under the ~500ms tick, so a position always fully settles
 * before the next tick can move it again (see ElevatorCar.css). Fill color
 * cuts (no transition) from `primary` to `open` the instant `doorState`
 * becomes `'OPEN'`, so open/closed is never ambiguous mid-fade. The
 * `DestinationPanel` (Story 2.4) and `DoorControls` (Story 2.5) dock below
 * the shaft only while `elevator.doorState === 'OPEN'` — no client-side
 * memory of "was it open," they appear/disappear purely by re-rendering off
 * `doorState`.
 */
export function ElevatorCar({ elevator, floors, onCarCall, onDoorHold, onDoorClose }: ElevatorCarProps) {
  const isOpen = elevator.doorState === 'OPEN';
  const rowFromTop = floors - elevator.currentFloor;

  return (
    <div className="elevator-car">
      <div className="elevator-car__shaft" style={{ height: floors * ROW_HEIGHT_PX }}>
        {Array.from({ length: floors }, (_, i) => (
          <div key={i} className="elevator-car__floor-cell" aria-hidden="true" />
        ))}
        <div
          className={`elevator-car__cabin${isOpen ? ' elevator-car__cabin--open' : ''}`}
          style={{ transform: `translateY(${rowFromTop * ROW_HEIGHT_PX}px)` }}
        >
          {elevator.direction === 'UP' && <ArrowUp size={12} weight="bold" aria-hidden="true" />}
          {elevator.direction === 'DOWN' && <ArrowDown size={12} weight="bold" aria-hidden="true" />}
          <span className="elevator-car__floor-digit">{elevator.currentFloor}</span>
          <span className="sr-only">
            {elevator.id}: floor {elevator.currentFloor}, {elevator.direction}, doors {elevator.doorState}
          </span>
        </div>
      </div>
      {isOpen && (
        <div className="elevator-car__docked-panel">
          <DestinationPanel
            elevatorId={elevator.id}
            currentFloor={elevator.currentFloor}
            floors={floors}
            stopQueue={elevator.stopQueue}
            onCarCall={onCarCall}
          />
          <DoorControls elevatorId={elevator.id} onDoorHold={onDoorHold} onDoorClose={onDoorClose} />
        </div>
      )}
    </div>
  );
}
