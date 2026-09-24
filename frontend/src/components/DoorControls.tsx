import { ArrowsOutLineHorizontal, ArrowsInLineHorizontal } from '@phosphor-icons/react';
import './DoorControls.css';

export interface DoorControlsProps {
  readonly elevatorId: string;
  readonly onDoorHold: (elevatorId: string) => void;
  readonly onDoorClose: (elevatorId: string) => void;
}

/**
 * One elevator's Door Hold/Close controls (Story 2.5, FR-4/FR-5): a Hold
 * (◁▷) button and a Close (▷◁) button, each a simple, stateless emit with
 * no client-derived logic (AD-1) — the server alone decides the dwell-timer
 * effect. No visibility logic of its own; the parent `ElevatorCar` gates
 * rendering on `doorState === 'OPEN'`, same division of responsibility as
 * `DestinationPanel`.
 */
export function DoorControls({ elevatorId, onDoorHold, onDoorClose }: DoorControlsProps) {
  return (
    <div className="door-controls">
      <button type="button" aria-label="Hold doors" className="door-controls__button" onClick={() => onDoorHold(elevatorId)}>
        <ArrowsOutLineHorizontal size={16} weight="bold" aria-hidden="true" />
        Hold
      </button>
      <button type="button" aria-label="Close doors" className="door-controls__button" onClick={() => onDoorClose(elevatorId)}>
        <ArrowsInLineHorizontal size={16} weight="bold" aria-hidden="true" />
        Close
      </button>
    </div>
  );
}
