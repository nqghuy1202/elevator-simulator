import type { BuildingSnapshot } from 'shared/src/index.js';
import { FloorHallPanel } from './FloorHallPanel.js';
import './BuildingView.css';

export interface BuildingViewProps {
  readonly snapshot: BuildingSnapshot;
  readonly onHallCall: (floor: number, direction: 'UP' | 'DOWN') => void;
}

/**
 * Renders a `FloorHallPanel` for each floor `1..snapshot.floors` (Story 2.3),
 * wiring `snapshot.activeHallCalls` and `onHallCall` straight through — no
 * client-side derived state of its own (AD-1). Shares the `.col-head`
 * header used by every shaft column so a floor's rail row and its cell in
 * every shaft line up at the same Y (EXPERIENCE.md Information Architecture).
 */
export function BuildingView({ snapshot, onHallCall }: BuildingViewProps) {
  const floorNumbers = Array.from({ length: snapshot.floors }, (_, i) => snapshot.floors - i);

  return (
    <section className="building-view" aria-label="Hall calls">
      <div className="col-head">
        <span className="col-title">Hall Calls</span>
      </div>
      <div className="rail">
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
    </section>
  );
}
