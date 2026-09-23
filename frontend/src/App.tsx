import { useBuildingSocket } from './hooks/useBuildingSocket.js';
import { useAppSelector } from './store/index.js';

/**
 * Minimal, unstyled walking-skeleton view (PRD NFR-7) proving the pipeline
 * works end-to-end: connect over WS, receive a `BuildingSnapshot`, render
 * it from the Redux store. Not the real UI — Stories 2.3-2.5 build Hall
 * Call / Car Call / Door Hold-Close on top of this.
 */
function App() {
  useBuildingSocket();

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
        </div>
      )}
    </main>
  );
}

export default App;
