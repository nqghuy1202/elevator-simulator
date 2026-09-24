import { useEffect, useRef, useState } from 'react';
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
 * One elevator, rendered as its own shaft column (EXPERIENCE.md Shaft View).
 * The cabin's vertical position is a CSS `transform: translateY()` computed
 * from `currentFloor`, transitioning at 480ms — just under the ~500ms tick,
 * so a position always fully settles before the next tick can move it again
 * (see ElevatorCar.css). Fill color cuts (no transition) from `primary` to
 * `open` the instant `doorState` becomes `'OPEN'`.
 *
 * While doors are open, the cabin box is hidden and that exact floor's own
 * floor-cell — same in-flow element, same `--row-height`, never taller —
 * becomes the `DestinationPanel`'s row of floor buttons instead (memlog
 * 2026-09-24 decision: no separate docked/overlay panel). `DoorControls` is
 * always mounted in the column header (`.col-head`) and only interactive
 * while doors are open, so the header's height never changes on open/close.
 */
export function ElevatorCar({ elevator, floors, onCarCall, onDoorHold, onDoorClose }: ElevatorCarProps) {
  const isOpen = elevator.doorState === 'OPEN';
  const isResting = elevator.stateName === 'IDLE';
  const rowFromTop = floors - elevator.currentFloor;

  // Climbing trail: briefly light up the floor-cell a car just stepped onto
  // while genuinely in transit. Purely a visual echo of the Snapshot's own
  // currentFloor changing (the domain model moves exactly one floor per
  // tick — see Elevator.moveOneFloor), not derived business state (AD-1).
  const [passingFloor, setPassingFloor] = useState<number | null>(null);
  const prevFloorRef = useRef(elevator.currentFloor);

  useEffect(() => {
    const prevFloor = prevFloorRef.current;
    prevFloorRef.current = elevator.currentFloor;
    if (prevFloor === elevator.currentFloor || isOpen) return undefined;

    setPassingFloor(elevator.currentFloor);
    const timer = setTimeout(() => setPassingFloor(null), 420);
    return () => clearTimeout(timer);
  }, [elevator.currentFloor, isOpen]);

  const chipText =
    elevator.doorState === 'OPEN'
      ? `Doors Open · Fl ${elevator.currentFloor}`
      : elevator.direction === 'UP'
        ? `↑ Fl ${elevator.currentFloor}`
        : elevator.direction === 'DOWN'
          ? `↓ Fl ${elevator.currentFloor}`
          : `Idle · Fl ${elevator.currentFloor}`;
  const chipModifier = elevator.doorState === 'OPEN' ? ' chip--open' : elevator.direction !== 'IDLE' ? ' chip--transit' : '';

  const floorNumbers = Array.from({ length: floors }, (_, i) => floors - i);

  return (
    <div className="elevator-car">
      <span className="sr-only">
        {elevator.id}: floor {elevator.currentFloor}, {elevator.direction}, doors {elevator.doorState}
      </span>
      <div className="col-head">
        <span className="col-title">{elevator.id}</span>
        <span className={`chip${chipModifier}`}>{chipText}</span>
        <DoorControls elevatorId={elevator.id} isOpen={isOpen} onDoorHold={onDoorHold} onDoorClose={onDoorClose} />
      </div>
      <div className="elevator-car__shaft" style={{ height: floors * ROW_HEIGHT_PX }}>
        {floorNumbers.map((floor) =>
          isOpen && floor === elevator.currentFloor ? (
            <div key={floor} className="elevator-car__floor-cell elevator-car__floor-cell--panel">
              <DestinationPanel
                elevatorId={elevator.id}
                currentFloor={elevator.currentFloor}
                floors={floors}
                stopQueue={elevator.stopQueue}
                onCarCall={onCarCall}
              />
            </div>
          ) : (
            <div
              key={floor}
              className={`elevator-car__floor-cell${passingFloor === floor ? ' elevator-car__floor-cell--pass' : ''}${
                isResting && floor === elevator.currentFloor ? ' elevator-car__floor-cell--here' : ''
              }`}
              aria-hidden="true"
            >
              <span className="elevator-car__floor-num">{floor}</span>
            </div>
          ),
        )}
        {!isOpen && (
          <div
            className={`elevator-car__cabin${isResting ? ' elevator-car__cabin--here' : ''}`}
            style={{ transform: `translateY(${rowFromTop * ROW_HEIGHT_PX}px)` }}
            aria-hidden="true"
          >
            {elevator.direction === 'UP' && <ArrowUp size={12} weight="bold" aria-hidden="true" />}
            {elevator.direction === 'DOWN' && <ArrowDown size={12} weight="bold" aria-hidden="true" />}
            <span className="elevator-car__floor-digit">{elevator.currentFloor}</span>
          </div>
        )}
      </div>
    </div>
  );
}
