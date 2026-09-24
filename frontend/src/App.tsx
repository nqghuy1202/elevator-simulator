import type { CSSProperties } from 'react';
import { BuildingView } from './components/BuildingView.js';
import { ConnectionBadge } from './components/ConnectionBadge.js';
import { ElevatorCar } from './components/ElevatorCar.js';
import { ROW_HEIGHT_PX } from './designTokens.js';
import { useBuildingSocket } from './hooks/useBuildingSocket.js';
import { useAppSelector } from './store/index.js';
import './App.css';

/**
 * Dashboard shell (EXPERIENCE.md Information Architecture): a centered page
 * with a header (title, Building stat strip, connection badge) above a
 * two-region board — the Hall Call rail (`BuildingView`) and the Shaft View
 * (one `ElevatorCar` column per elevator), both driven straight from the
 * Redux-held `BuildingSnapshot` with no client-derived state (AD-1).
 */
function App() {
  const { emitHallCall, emitCarCall, emitDoorHold, emitDoorClose } = useBuildingSocket();

  const connectionStatus = useAppSelector((state) => state.ui.connectionStatus);
  const snapshot = useAppSelector((state) => state.building.snapshot);

  return (
    <main className="page" style={{ '--row-height': `${ROW_HEIGHT_PX}px` } as CSSProperties}>
      <header className="header">
        <div className="header__identity">
          <h1>Elevator Simulator</h1>
          <p>Building &ldquo;Ascent Tower&rdquo; &middot; real-time control</p>
        </div>
        <div className="header__right">
          {snapshot !== null && (
            <div className="stat-strip" role="group" aria-label="Building overview">
              <div className="stat">
                <span className="stat__value">{snapshot.floors}</span>
                <span className="stat__label">Floors</span>
              </div>
              <div className="stat">
                <span className="stat__value">{snapshot.elevators.length}</span>
                <span className="stat__label">Elevators</span>
              </div>
              <div className="stat">
                <span className="stat__value stat__value--pending">{snapshot.activeHallCalls.length}</span>
                <span className="stat__label">Pending</span>
              </div>
            </div>
          )}
          <ConnectionBadge status={connectionStatus} />
        </div>
      </header>
      {snapshot === null ? (
        <p className="app__loading">Connecting to building…</p>
      ) : (
        <div className="board">
          <BuildingView snapshot={snapshot} onHallCall={emitHallCall} />
          <section className="shafts" aria-label="Elevator shafts">
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
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
