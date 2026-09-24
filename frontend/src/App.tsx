import { BuildingView } from './components/BuildingView.js';
import { useBuildingSocket } from './hooks/useBuildingSocket.js';
import { useAppSelector } from './store/index.js';

/**
 * Minimal, unstyled walking-skeleton view (PRD NFR-7) proving the pipeline
 * works end-to-end: connect over WS, receive a `BuildingSnapshot`, render
 * it from the Redux store. Story 2.3 adds `BuildingView` (Hall Call UI)
 * alongside the existing snapshot summary; Stories 2.4/2.5 build Car Call /
 * Door Hold-Close on top of this.
 */
function App() {
  const { emitHallCall } = useBuildingSocket();

  const connectionStatus = useAppSelector((state) => state.ui.connectionStatus);
  const snapshot = useAppSelector((state) => state.building.snapshot);

  return (
    <main>
      <h1>Elevator Simulator</h1>
      <p>Connection status: {connectionStatus}</p>
      {snapshot === null ? (
        <p>Connecting to building…</p>
      ) : (
        <div>
          <p>Tick: {snapshot.tick}</p>
          <p>Floors: {snapshot.floors}</p>
          <p>Elevators: {snapshot.elevators.length}</p>
          <ul>
            {snapshot.elevators.map((elevator) => (
              <li key={elevator.id}>
                {elevator.id}: floor {elevator.currentFloor}, {elevator.direction}, doors{' '}
                {elevator.doorState}
              </li>
            ))}
          </ul>
          <BuildingView snapshot={snapshot} onHallCall={emitHallCall} />
        </div>
      )}
    </main>
  );
}

export default App;
