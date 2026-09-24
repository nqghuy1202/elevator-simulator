import type { PendingHallCall } from 'shared/src/index.js';

export interface FloorHallPanelProps {
  readonly floor: number;
  /** Total floor count (AD-1: only used to decide whether ↑/↓ are hidden per FR-1, e.g. floor === floors hides ↑). */
  readonly floors: number;
  /** `snapshot.activeHallCalls` — the panel renders its indicators strictly from this, no derived client state (AD-1). */
  readonly activeHallCalls: readonly PendingHallCall[];
  readonly onHallCall: (floor: number, direction: 'UP' | 'DOWN') => void;
}

/**
 * One floor's Hall Call controls (Story 2.3, FR-1/FR-2): ↑ hidden at the top
 * floor, ↓ hidden at floor 1, each with an independent pending indicator lit
 * purely from whether `{floor, direction}` is present in `activeHallCalls` —
 * no client-side optimistic/derived bookkeeping of presses (AD-1). Re-pressing
 * an already-active direction re-emits `hallCall` but changes no client state
 * (already lit; server already dedupes).
 */
export function FloorHallPanel({ floor, floors, activeHallCalls, onHallCall }: FloorHallPanelProps) {
  const isActive = (direction: 'UP' | 'DOWN') =>
    activeHallCalls.some((call) => call.floor === floor && call.direction === direction);

  const showUp = floor < floors;
  const showDown = floor > 1;

  return (
    <div>
      <span>Floor {floor}</span>
      {showUp && (
        <button type="button" aria-label={`Hall call up floor ${floor}`} onClick={() => onHallCall(floor, 'UP')}>
          UP{isActive('UP') ? ' (pending)' : ''}
        </button>
      )}
      {showDown && (
        <button type="button" aria-label={`Hall call down floor ${floor}`} onClick={() => onHallCall(floor, 'DOWN')}>
          DOWN{isActive('DOWN') ? ' (pending)' : ''}
        </button>
      )}
    </div>
  );
}
