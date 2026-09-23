import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { BuildingStateEvent } from 'shared/src/index.js';
import { useAppDispatch } from '../store/index.js';
import { connectionReset, snapshotReceived } from '../store/buildingSlice.js';
import { connectionStatusChanged } from '../store/uiSlice.js';

const DEFAULT_BACKEND_URL = 'http://localhost:3001';

function resolveBackendUrl(): string {
  return import.meta.env['VITE_BACKEND_URL'] ?? DEFAULT_BACKEND_URL;
}

/**
 * The only frontend module that touches `socket.io-client` directly (AD-1's
 * "one adapter" discipline, mirrored on the client) — components and other
 * hooks read the Redux store, never the socket. Connects on mount, keeps
 * `uiSlice.connectionStatus` in sync with the socket's lifecycle, and
 * dispatches `snapshotReceived` on every server `buildingState` broadcast.
 *
 * Only reads/dispatches today; nothing yet calls `socket.emit` for
 * hallCall/carCall/doorHold/doorClose — Stories 2.3-2.5 build those on top
 * of this hook.
 */
export function useBuildingSocket(): void {
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
}
