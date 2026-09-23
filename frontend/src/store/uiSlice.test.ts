import { describe, expect, it } from 'vitest';
import type { BuildingSnapshot } from 'shared/src/index.js';
import { configureStore } from '@reduxjs/toolkit';
import buildingReducer, { snapshotReceived } from './buildingSlice.js';
import uiReducer, { connectionStatusChanged } from './uiSlice.js';

function makeSnapshot(tick: number): BuildingSnapshot {
  return {
    tick,
    floors: 10,
    elevators: [],
    pendingHallCalls: [],
  };
}

describe('uiSlice: initial state', () => {
  it('starts with connectionStatus: "connecting"', () => {
    const state = uiReducer(undefined, { type: '@@INIT' });
    expect(state.connectionStatus).toBe('connecting');
  });
});

describe('uiSlice: connectionStatusChanged', () => {
  it('updates connectionStatus to the dispatched value', () => {
    const state = uiReducer(undefined, connectionStatusChanged('connected'));
    expect(state.connectionStatus).toBe('connected');
  });
});

describe('uiSlice: UI-only state survives a Snapshot replace', () => {
  it('building.snapshotReceived leaves ui.connectionStatus untouched', () => {
    const store = configureStore({
      reducer: { building: buildingReducer, ui: uiReducer },
    });

    store.dispatch(connectionStatusChanged('connected'));
    expect(store.getState().ui.connectionStatus).toBe('connected');

    store.dispatch(snapshotReceived(makeSnapshot(1)));

    expect(store.getState().ui.connectionStatus).toBe('connected');
    expect(store.getState().building.snapshot?.tick).toBe(1);
  });
});
