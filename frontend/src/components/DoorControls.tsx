import { ArrowsOutLineHorizontal, ArrowsInLineHorizontal } from '@phosphor-icons/react';
import './DoorControls.css';

export interface DoorControlsProps {
  readonly elevatorId: string;
  /**
   * Whether this elevator's doors are open (FR-4/FR-5). `DoorControls` is
   * always mounted in the shaft column's `.col-head`, never conditionally
   * rendered — its box is toggled via `disabled` + CSS `visibility`, never
   * `display`, so the header's height never changes when a door opens or
   * closes (matches the fixed-box rule used everywhere else in this layout).
   */
  readonly isOpen: boolean;
  readonly onDoorHold: (elevatorId: string) => void;
  readonly onDoorClose: (elevatorId: string) => void;
}

/**
 * One elevator's Door Hold/Close controls (Story 2.5, FR-4/FR-5): a Hold
 * button and a Close button, each a simple, stateless emit with no
 * client-derived logic (AD-1) — the server alone decides the dwell-timer
 * effect. Interactive only while `isOpen`; both buttons are `disabled`
 * otherwise, which also makes them inert to clicks with no extra guard logic.
 */
export function DoorControls({ elevatorId, isOpen, onDoorHold, onDoorClose }: DoorControlsProps) {
  return (
    <div className={`door-controls${isOpen ? ' door-controls--active' : ''}`}>
      <button
        type="button"
        aria-label="Hold doors"
        className="door-controls__button"
        disabled={!isOpen}
        onClick={() => onDoorHold(elevatorId)}
      >
        <ArrowsOutLineHorizontal size={11} weight="bold" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Close doors"
        className="door-controls__button"
        disabled={!isOpen}
        onClick={() => onDoorClose(elevatorId)}
      >
        <ArrowsInLineHorizontal size={11} weight="bold" aria-hidden="true" />
      </button>
    </div>
  );
}
