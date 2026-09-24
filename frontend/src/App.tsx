import type { CSSProperties } from 'react';
import { BuildingView } from './components/BuildingView.js';
import { ConnectionBadge } from './components/ConnectionBadge.js';
import { ElevatorCar } from './components/ElevatorCar.js';
import { ROW_HEIGHT_PX } from './designTokens.js';
import { useBuildingSocket } from './hooks/useBuildingSocket.js';
import { useAppSelector } from './store/index.js';
import './App.css';

/**
 * Dashboard shell (EXPERIENCE.md Information Architecture): header with the
 * connection badge, then a two-region body — the Hall Call rail
 * (`BuildingView`) on the left and the Shaft View (one `ElevatorCar` column
 * per elevator) on the right, both driven straight from the Redux-held
 * `BuildingSnapshot` with no client-derived state (AD-1).
 */
function App() {
  const { emitHallCall, emitCarCall, emitDoorHold, emitDoorClose } = useBuildingSocket();

  const connectionStatus = useAppSelector((state) => state.ui.connectionStatus);
  const snapshot = useAppSelector((state) => state.building.snapshot);

  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">Elevator Simulator</h1>
        <ConnectionBadge status={connectionStatus} />
      </header>
      {snapshot === null ? (
        <p className="app__loading">Connecting to building…</p>
      ) : (
        <div
          className="app__dashboard"
          style={{ '--row-height': `${ROW_HEIGHT_PX}px` } as CSSProperties}
        >
          <BuildingView snapshot={snapshot} onHallCall={emitHallCall} />
          <div className="app__shaft-view">
            {snapshot.elevators.map((elevator) => (
              <ElevatorCar
                key={elevator.id}
                elevator={elevator}
                floors={snapshot.floors}
                onCarCall={emitCarCall}
                onDoorHold={emitDoorHold}
                onDoorClose={emitDoorClose}
              />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
