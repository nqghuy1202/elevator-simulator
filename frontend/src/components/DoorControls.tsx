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
    <div>
      <button type="button" aria-label="Hold doors" onClick={() => onDoorHold(elevatorId)}>
        ◁▷ Hold
      </button>
      <button type="button" aria-label="Close doors" onClick={() => onDoorClose(elevatorId)}>
        ▷◁ Close
      </button>
    </div>
  );
}
