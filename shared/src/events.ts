import type { Direction } from './types.js';
import type { BuildingSnapshot } from './snapshot.js';

/**
 * WS client -> server event payloads (AD-4). Each maps 1:1 to a domain
 * command on `Building`:
 *   hallCall  -> Building.handleHallCall(floor, direction)
 *   carCall   -> Building.handleCarCall(elevatorId, floor)
 *   doorHold  -> Building.handleDoorHold(elevatorId)
 *   doorClose -> Building.handleDoorClose(elevatorId)
 */
export interface HallCallPayload {
  readonly floor: number;
  readonly direction: Exclude<Direction, 'IDLE'>;
}

export interface CarCallPayload {
  readonly elevatorId: string;
  readonly floor: number;
}

export interface DoorHoldPayload {
  readonly elevatorId: string;
}

export interface DoorClosePayload {
  readonly elevatorId: string;
}

/**
 * WS server -> client event payload: the full `BuildingSnapshot`, broadcast
 * every tick (~500ms) and immediately on a client's `connect`.
 */
export type BuildingStateEvent = BuildingSnapshot;
