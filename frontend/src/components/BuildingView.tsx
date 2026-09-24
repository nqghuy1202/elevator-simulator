import type { BuildingSnapshot } from 'shared/src/index.js';
import { FloorHallPanel } from './FloorHallPanel.js';

export interface BuildingViewProps {
  readonly snapshot: BuildingSnapshot;
  readonly onHallCall: (floor: number, direction: 'UP' | 'DOWN') => void;
}

/**
 * Renders a `FloorHallPanel` for each floor `1..snapshot.floors` (Story 2.3),
 * wiring `snapshot.activeHallCalls` and `onHallCall` straight through — no
 * client-side derived state of its own (AD-1).
 */
export function BuildingView({ snapshot, onHallCall }: BuildingViewProps) {
  const floorNumbers = Array.from({ length: snapshot.floors }, (_, i) => snapshot.floors - i);

  return (
    <div>
      {floorNumbers.map((floor) => (
        <FloorHallPanel
          key={floor}
          floor={floor}
          floors={snapshot.floors}
          activeHallCalls={snapshot.activeHallCalls}
          onHallCall={onHallCall}
        />
      ))}
    </div>
  );
}
