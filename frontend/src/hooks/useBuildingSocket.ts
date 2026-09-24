import { useCallback, useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { BuildingStateEvent, Direction, HallCallPayload } from 'shared/src/index.js';
import { useAppDispatch } from '../store/index.js';
import { connectionReset, snapshotReceived } from '../store/buildingSlice.js';
import { connectionStatusChanged } from '../store/uiSlice.js';

const DEFAULT_BACKEND_URL = 'http://localhost:3001';

function resolveBackendUrl(): string {
  return import.meta.env['VITE_BACKEND_URL'] ?? DEFAULT_BACKEND_URL;
}

/** Return type of `useBuildingSocket` — the client emit surface built on top of the held socket ref. */
export interface UseBuildingSocketResult {
  /**
   * Emit a `hallCall` event on the held socket (Story 2.3). A no-op if the
   * socket hasn't connected yet — `socketRef.current` is `null` until the
   * connect effect runs, and optional chaining below makes that safe.
   */
  emitHallCall(floor: number, direction: Exclude<Direction, 'IDLE'>): void;
}

/**
 * The only frontend module that touches `socket.io-client` directly (AD-1's
 * "one adapter" discipline, mirrored on the client) — components and other
 * hooks read the Redux store, never the socket. Connects on mount, keeps
 * `uiSlice.connectionStatus` in sync with the socket's lifecycle, and
 * dispatches `snapshotReceived` on every server `buildingState` broadcast.
 *
 * Returns `{ emitHallCall }` (Story 2.3) for client -> server Hall Call
 * requests; carCall/doorHold/doorClose follow the same pattern in Stories
 * 2.4/2.5.
 */
export function useBuildingSocket(): UseBuildingSocketResult {
  const dispatch = useAppDispatch();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(resolveBackendUrl());
    socketRef.current = socket;

    socket.on('connect', () => {
      // Fires on both the initial connect and any reconnect. Clear the
      // stored Snapshot first so a post-restart server's low tick isn't
      // permanently rejected by the tick-guard — the server always sends a
      // fresh Snapshot immediately on connect (Story 2.1), so this doesn't
      // introduce any prolonged blank state.
      dispatch(connectionReset());
      dispatch(connectionStatusChanged('connected'));
    });

    socket.on('disconnect', () => {
      dispatch(connectionStatusChanged('disconnected'));
    });

    socket.on('connect_error', () => {
      dispatch(connectionStatusChanged('disconnected'));
    });

    socket.on('buildingState', (payload: BuildingStateEvent) => {
      dispatch(snapshotReceived(payload));
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [dispatch]);

  const emitHallCall = useCallback((floor: number, direction: Exclude<Direction, 'IDLE'>) => {
    const payload: HallCallPayload = { floor, direction };
    socketRef.current?.emit('hallCall', payload);
  }, []);

  return { emitHallCall };
}
