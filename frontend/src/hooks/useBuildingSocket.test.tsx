import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import type { BuildingSnapshot } from 'shared/src/index.js';
import buildingReducer from '../store/buildingSlice.js';
import uiReducer from '../store/uiSlice.js';
import { useBuildingSocket } from './useBuildingSocket.js';

/**
 * Minimal fake of the `socket.io-client` Socket surface `useBuildingSocket`
 * actually uses (`on`/`close`) — mirrors the backend's
 * `socketHandlers.test.ts` fake-socket approach, just on the client side.
 */
const handlers = new Map<string, (payload: unknown) => void>();
const fakeSocket = {
  on: vi.fn((event: string, handler: (payload: unknown) => void) => {
    handlers.set(event, handler);
    return fakeSocket;
  }),
  close: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => fakeSocket),
}));

function makeSnapshot(tick: number): BuildingSnapshot {
  return {
    tick,
    floors: 10,
    elevators: [],
    pendingHallCalls: [],
  };
}

function TestHarness() {
  useBuildingSocket();
  return null;
}

function renderWithStore() {
  const store = configureStore({
    reducer: { building: buildingReducer, ui: uiReducer },
  });
  render(
    <Provider store={store}>
      <TestHarness />
    </Provider>,
  );
  return store;
}

beforeEach(() => {
  handlers.clear();
  fakeSocket.on.mockClear();
  fakeSocket.close.mockClear();
  cleanup();
});

describe('useBuildingSocket: dispatches on real socket event', () => {
  it('dispatches snapshotReceived with the buildingState payload the mocked socket emits', () => {
    const store = renderWithStore();

    const snapshot = makeSnapshot(3);
    handlers.get('buildingState')?.(snapshot);

    expect(store.getState().building.snapshot).toEqual(snapshot);
  });

  it('sets connectionStatus to "connected" on the socket connect event', () => {
    const store = renderWithStore();

    handlers.get('connect')?.(undefined);

    expect(store.getState().ui.connectionStatus).toBe('connected');
  });

  it('sets connectionStatus to "disconnected" on the socket disconnect event', () => {
    const store = renderWithStore();

    handlers.get('connect')?.(undefined);
    handlers.get('disconnect')?.(undefined);

    expect(store.getState().ui.connectionStatus).toBe('disconnected');
  });

  it('sets connectionStatus to "disconnected" on the socket connect_error event', () => {
    const store = renderWithStore();

    handlers.get('connect')?.(undefined);
    handlers.get('connect_error')?.(undefined);

    expect(store.getState().ui.connectionStatus).toBe('disconnected');
  });
});

describe('useBuildingSocket: reconnect unblocks a post-restart low-tick Snapshot', () => {
  it('a connect event (reconnect) followed by a lower-tick buildingState replaces the stored high-tick snapshot', () => {
    const store = renderWithStore();

    handlers.get('buildingState')?.(makeSnapshot(50));
    expect(store.getState().building.snapshot?.tick).toBe(50);

    // Simulates a reconnect after a backend restart (tick counter resets low).
    handlers.get('connect')?.(undefined);
    const postRestart = makeSnapshot(1);
    handlers.get('buildingState')?.(postRestart);

    expect(store.getState().building.snapshot).toEqual(postRestart);
  });
});
