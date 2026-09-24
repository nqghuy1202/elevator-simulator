import type { Server, Socket } from 'socket.io';
import type { Building } from '../domain/Building.js';
import type {
  BuildingSnapshot,
  BuildingStateEvent,
  CarCallPayload,
  DoorClosePayload,
  DoorHoldPayload,
  HallCallPayload,
} from 'shared/src/index.js';

/**
 * The one module allowed to import both `domain/` and Socket.IO (AD-1).
 * Registers the 4 client->server event handlers per connection, each
 * mapping 1:1 to a `Building` domain command, and assembles the
 * `BuildingSnapshot` broadcast to clients. Contains no simulation logic of
 * its own — every handler is a thin routing call into `Building`.
 */

/**
 * Assemble a full `BuildingSnapshot` from the current `Building` state plus
 * the transport-owned `tick` sequence number. `tick` is not part of
 * `Building`'s own state (AD-4 design note: it's a transport concern), so
 * it's threaded in here by the caller (`server.ts`'s interval driver).
 */
export function buildSnapshot(building: Building, tick: number): BuildingSnapshot {
  return {
    tick,
    floors: building.getFloorCount(),
    elevators: building.getElevatorSnapshots(),
    pendingHallCalls: building.getPendingCalls(),
    activeHallCalls: building.getActiveHallCalls(),
  };
}

/**
 * Broadcast a fresh `BuildingSnapshot` (server -> client `buildingState`
 * event) to every currently-connected client.
 */
export function broadcastBuildingState(io: Server, building: Building, tick: number): void {
  const snapshot: BuildingStateEvent = buildSnapshot(building, tick);
  io.emit('buildingState', snapshot);
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** Runtime shape guard for `HallCallPayload` — malformed input is a silent no-op, never a throw/emit. */
function isValidHallCallPayload(payload: unknown): payload is HallCallPayload {
  if (typeof payload !== 'object' || payload === null) return false;
  const { floor, direction } = payload as Partial<HallCallPayload>;
  return isFiniteInteger(floor) && (direction === 'UP' || direction === 'DOWN');
}

/** Runtime shape guard for `CarCallPayload`. */
function isValidCarCallPayload(payload: unknown): payload is CarCallPayload {
  if (typeof payload !== 'object' || payload === null) return false;
  const { elevatorId, floor } = payload as Partial<CarCallPayload>;
  return isNonEmptyString(elevatorId) && isFiniteInteger(floor);
}

/** Runtime shape guard shared by `DoorHoldPayload`/`DoorClosePayload` (both just `{ elevatorId }`). */
function isValidElevatorIdPayload(payload: unknown): payload is DoorHoldPayload | DoorClosePayload {
  if (typeof payload !== 'object' || payload === null) return false;
  const { elevatorId } = payload as Partial<DoorHoldPayload>;
  return isNonEmptyString(elevatorId);
}

/**
 * Register the 4 client->server handlers for a single connected `socket`,
 * and immediately emit that client a full `buildingState` snapshot without
 * waiting for the next tick (so a joining/reconnecting client is never
 * blank). `getTick` reads the current tick sequence number owned by
 * `server.ts`'s interval driver — read fresh on each connect rather than
 * captured once, so a late-joining client sees the latest count.
 *
 * Every handler below validates the incoming payload shape at runtime (the
 * TypeScript payload types only guard compile-time callers, not untrusted
 * wire data) and maps 1:1 to a `Building` command. A malformed payload, an
 * unknown `elevatorId`, or any other invalid client action is a silent
 * no-op — never a thrown or emitted error — per the PRD's client-input
 * boundary (distinct from `Dispatcher.tryAssign`'s internal-consistency
 * throw on a bug in its own `SchedulingStrategy`).
 */
export function registerSocketHandlers(socket: Socket, building: Building, getTick: () => number): void {
  socket.emit('buildingState', buildSnapshot(building, getTick()));

  socket.on('hallCall', (payload: unknown) => {
    if (!isValidHallCallPayload(payload)) return;
    building.handleHallCall(payload.floor, payload.direction);
  });

  socket.on('carCall', (payload: unknown) => {
    if (!isValidCarCallPayload(payload)) return;
    building.handleCarCall(payload.elevatorId, payload.floor);
  });

  socket.on('doorHold', (payload: unknown) => {
    if (!isValidElevatorIdPayload(payload)) return;
    building.handleDoorHold(payload.elevatorId);
  });

  socket.on('doorClose', (payload: unknown) => {
    if (!isValidElevatorIdPayload(payload)) return;
    building.handleDoorClose(payload.elevatorId);
  });
}
