export interface DestinationPanelProps {
  readonly elevatorId: string;
  readonly currentFloor: number;
  /** Total floor count — offers every floor `1..floors` except `currentFloor` (FR-3). */
  readonly floors: number;
  /** `snapshot.elevators[i].stopQueue` — a floor already queued renders disabled, not a fresh selection (AD-1). */
  readonly stopQueue: readonly number[];
  readonly onCarCall: (elevatorId: string, floor: number) => void;
}

/**
 * One elevator's Car Call destination selector (Story 2.4, FR-3): offers a
 * button for every floor `1..floors` except the elevator's own
 * `currentFloor`, driven strictly from Snapshot data — no client-derived
 * state (AD-1). A floor already present in `stopQueue` renders disabled
 * instead of clickable so it isn't offered as a fresh selection twice.
 * Rendered only while the parent `ElevatorCar` finds `doorState === 'OPEN'`.
 */
export function DestinationPanel({
  elevatorId,
  currentFloor,
  floors,
  stopQueue,
  onCarCall,
}: DestinationPanelProps) {
  const floorNumbers = Array.from({ length: floors }, (_, i) => i + 1).filter(
    (floor) => floor !== currentFloor,
  );

  return (
    <div>
      {floorNumbers.map((floor) => {
        const alreadyQueued = stopQueue.includes(floor);
        return (
          <button
            key={floor}
            type="button"
            aria-label={`Car call floor ${floor}`}
            disabled={alreadyQueued}
            onClick={() => onCarCall(elevatorId, floor)}
          >
            {floor}
            {alreadyQueued ? ' (queued)' : ''}
          </button>
        );
      })}
    </div>
  );
}
