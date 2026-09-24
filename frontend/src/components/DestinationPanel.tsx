import './DestinationPanel.css';

export interface DestinationPanelProps {
  readonly elevatorId: string;
  readonly currentFloor: number;
  /** Total floor count — offers a button for every floor `1..floors` (FR-3), current floor included. */
  readonly floors: number;
  /** `snapshot.elevators[i].stopQueue` — a floor already queued renders disabled, not a fresh selection (AD-1). */
  readonly stopQueue: readonly number[];
  readonly onCarCall: (elevatorId: string, floor: number) => void;
}

/**
 * One elevator's Car Call destination selector (Story 2.4, FR-3), rendered
 * inline as the open cabin's own floor-cell content (see ElevatorCar). Every
 * floor `1..floors` gets a button, matching a real elevator car panel's
 * convention of always showing every floor — `currentFloor`'s own button
 * renders lit/disabled rather than being omitted. Driven strictly from
 * Snapshot data — no client-derived state (AD-1). A floor already present
 * in `stopQueue` renders disabled instead of clickable so it isn't offered
 * as a fresh selection twice. Rendered only while the parent `ElevatorCar`
 * finds `doorState === 'OPEN'`.
 */
export function DestinationPanel({
  elevatorId,
  currentFloor,
  floors,
  stopQueue,
  onCarCall,
}: DestinationPanelProps) {
  const floorNumbers = Array.from({ length: floors }, (_, i) => floors - i);

  return (
    <div className="destination-panel">
      {floorNumbers.map((floor) => {
        const isCurrent = floor === currentFloor;
        const alreadyQueued = !isCurrent && stopQueue.includes(floor);
        return (
          <button
            key={floor}
            type="button"
            aria-label={`Car call floor ${floor}`}
            className={`destination-panel__button${isCurrent ? ' destination-panel__button--current' : ''}`}
            disabled={isCurrent || alreadyQueued}
            onClick={() => onCarCall(elevatorId, floor)}
          >
            {floor}
            {alreadyQueued && <span className="sr-only"> (queued)</span>}
          </button>
        );
      })}
    </div>
  );
}
