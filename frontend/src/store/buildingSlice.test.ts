import { describe, expect, it } from 'vitest';
import type { BuildingSnapshot } from 'shared/src/index.js';
import buildingReducer, { connectionReset, snapshotReceived, type BuildingState } from './buildingSlice.js';

function makeSnapshot(tick: number): BuildingSnapshot {
  return {
    tick,
    floors: 10,
    elevators: [
      {
        id: 'E1',
        currentFloor: 1,
        direction: 'IDLE',
        doorState: 'CLOSED',
        stopQueue: [],
        stateName: 'IDLE',
      },
    ],
    pendingHallCalls: [],
  };
}

describe('buildingSlice: initial state', () => {
  it('starts with snapshot: null before any buildingState arrives', () => {
    const state = buildingReducer(undefined, { type: '@@INIT' });
    expect(state.snapshot).toBeNull();
  });
});

describe('buildingSlice: fresh Snapshot replaces the store', () => {
  it('a tick-6 Snapshot fully replaces a stored tick-5 Snapshot, no merged fields', () => {
    const tick5 = makeSnapshot(5);
    const initial: BuildingState = { snapshot: tick5 };
    const tick6 = makeSnapshot(6);

    const next = buildingReducer(initial, snapshotReceived(tick6));

    expect(next.snapshot).toBe(tick6);
    expect(next.snapshot).not.toBe(tick5);
  });
});

describe('buildingSlice: stale/duplicate Snapshot is dropped', () => {
  it('a tick-6 (duplicate) Snapshot arriving while tick 6 is stored is a no-op', () => {
    const tick6 = makeSnapshot(6);
    const initial: BuildingState = { snapshot: tick6 };

    const next = buildingReducer(initial, snapshotReceived(makeSnapshot(6)));

    expect(next.snapshot).toBe(tick6);
  });

  it('a tick-5 (stale) Snapshot arriving while tick 6 is stored is a no-op', () => {
    const tick6 = makeSnapshot(6);
    const initial: BuildingState = { snapshot: tick6 };

    const next = buildingReducer(initial, snapshotReceived(makeSnapshot(5)));

    expect(next.snapshot).toBe(tick6);
  });
});

describe('buildingSlice: connectionReset unblocks a post-restart low-tick Snapshot', () => {
  it('after a reconnect clears the stored high-tick Snapshot, a lower-tick Snapshot is accepted', () => {
    const highTick = makeSnapshot(50);
    const afterFirstConnection: BuildingState = { snapshot: highTick };

    // Simulates the useBuildingSocket 'connect' handler firing on reconnect.
    const afterReset = buildingReducer(afterFirstConnection, connectionReset());
    expect(afterReset.snapshot).toBeNull();

    // The restarted server's tick counter starts low again.
    const postRestart = makeSnapshot(1);
    const next = buildingReducer(afterReset, snapshotReceived(postRestart));

    expect(next.snapshot).toBe(postRestart);
  });
});
