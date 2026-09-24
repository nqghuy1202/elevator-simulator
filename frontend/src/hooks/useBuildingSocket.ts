import { useCallback, useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  BuildingStateEvent,
  CarCallPayload,
  Direction,
  DoorClosePayload,
  DoorHoldPayload,
  HallCallPayload,
} from 'shared/src/index.js';
import { useAppDispatch } from '../store/index.js';
import { connectionReset, snapshotReceived } from '../store/buildingSlice.js';
import { connectionStatusChanged } from '../store/uiSlice.js';

const DEFAULT_BACKEND_URL = 'http://localhost:3001';

/**
 * `VITE_BACKEND_URL=''` (set at container build time, Story 3.2) resolves
 * to `undefined` here rather than the literal empty string, because
 * `io(undefined)` is what makes socket.io-client default to same-origin —
 * passing `''` itself would not (it only treats null/undefined that way).
 * Same-origin is what lets the containerized deployment's Nginx
 * `/socket.io/` proxy actually carry the traffic instead of the browser
 * bypassing it. Local dev leaves the env var unset, so it keeps using
 * `DEFAULT_BACKEND_URL`.
 */
function resolveBackendUrl(): string | undefined {
  const configured = import.meta.env['VITE_BACKEND_URL'];
  return configured === '' ? undefined : (configured ?? DEFAULT_BACKEND_URL);
}

/** Return type of `useBuildingSocket` — the client emit surface built on top of the held socket ref. */
export interface UseBuildingSocketResult {
  /**
   * Emit a `hallCall` event on the held socket (Story 2.3). A no-op if the
   * socket hasn't connected yet — `socketRef.current` is `null` until the
   * connect effect runs, and optional chaining below makes that safe.
   */
  emitHallCall(floor: number, direction: Exclude<Direction, 'IDLE'>): void;

  /**
   * Emit a `carCall` event on the held socket (Story 2.4), mirroring
   * `emitHallCall`'s no-op-if-not-yet-connected behavior.
   */
  emitCarCall(elevatorId: string, floor: number): void;

  /**
   * Emit a `doorHold` event on the held socket (Story 2.5) — a stateless
   * request that resets the server's door dwell timer (FR-4). No
   * client-derived logic (AD-1): the server alone decides the effect.
   */
  emitDoorHold(elevatorId: string): void;

  /**
   * Emit a `doorClose` event on the held socket (Story 2.5) — a stateless
   * request that cancels the remaining dwell timer so the elevator begins
   * closing next tick (FR-5). No client-derived logic (AD-1).
   */
  emitDoorClose(elevatorId: string): void;
}

/**
 * The only frontend module that touches `socket.io-client` directly (AD-1's
 * "one adapter" discipline, mirrored on the client) — components and other
 * hooks read the Redux store, never the socket. Connects on mount, keeps
 * `uiSlice.connectionStatus` in sync with the socket's lifecycle, and
 * dispatches `snapshotReceived` on every server `buildingState` broadcast.
 *
 * Returns `{ emitHallCall }` (Story 2.3) for client -> server Hall Call
 * requests, `{ emitCarCall }` (Story 2.4) for Car Call requests, and
 * `{ emitDoorHold, emitDoorClose }` (Story 2.5) for door dwell-timer
 * control, all following the same pattern.
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

  const emitCarCall = useCallback((elevatorId: string, floor: number) => {
    const payload: CarCallPayload = { elevatorId, floor };
    socketRef.current?.emit('carCall', payload);
  }, []);

  const emitDoorHold = useCallback((elevatorId: string) => {
    const payload: DoorHoldPayload = { elevatorId };
    socketRef.current?.emit('doorHold', payload);
  }, []);

  const emitDoorClose = useCallback((elevatorId: string) => {
    const payload: DoorClosePayload = { elevatorId };
    socketRef.current?.emit('doorClose', payload);
  }, []);

  return { emitHallCall, emitCarCall, emitDoorHold, emitDoorClose };
}
