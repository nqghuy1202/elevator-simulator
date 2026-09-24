import { BuildingView } from './components/BuildingView.js';
import { ElevatorCar } from './components/ElevatorCar.js';
import { useBuildingSocket } from './hooks/useBuildingSocket.js';
import { useAppSelector } from './store/index.js';

/**
 * Minimal, unstyled walking-skeleton view (PRD NFR-7) proving the pipeline
 * works end-to-end: connect over WS, receive a `BuildingSnapshot`, render
 * it from the Redux store. Story 2.3 adds `BuildingView` (Hall Call UI);
 * Story 2.4 adds `ElevatorCar`/`DestinationPanel` (Car Call UI) in place of
 * the raw elevator `<li>` list; Story 2.5 builds Door Hold/Close on top of
 * this.
 */
function App() {
  const { emitHallCall, emitCarCall } = useBuildingSocket();

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
              <ElevatorCar
                key={elevator.id}
                elevator={elevator}
                floors={snapshot.floors}
                onCarCall={emitCarCall}
              />
            ))}
          </ul>
          <BuildingView snapshot={snapshot} onHallCall={emitHallCall} />
        </div>
      )}
    </main>
  );
}

export default App;
