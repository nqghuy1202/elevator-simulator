import type { Direction, DoorState, ElevatorStateName } from './types.js';

/**
 * Read-only external view of a single Elevator's state (AD-4). Canonically
 * defined here — `backend/src/domain/Elevator.ts` imports this type rather
 * than declaring it locally.
 */
export interface ElevatorSnapshot {
  readonly id: string;
  readonly currentFloor: number;
  readonly direction: Direction;
  readonly doorState: DoorState;
  readonly stopQueue: readonly number[];
  readonly stateName: ElevatorStateName;
}

/** A pending Hall Call: a floor with the direction the waiting passenger wants to travel. */
export interface PendingHallCall {
  readonly floor: number;
  readonly direction: Exclude<Direction, 'IDLE'>;
}

/**
 * Full snapshot of Building state broadcast to every connected client every
 * tick. `tick` is a monotonic sequence number owned by `server.ts` (a
 * transport concern, not `Building`'s) — it strictly increments across
 * broadcasts so clients (Story 2.2's Redux reducer) can detect and drop
 * stale/out-of-order delivery.
 */
export interface BuildingSnapshot {
  readonly tick: number;
  readonly floors: number;
  readonly elevators: readonly ElevatorSnapshot[];
  readonly pendingHallCalls: readonly PendingHallCall[];
  /**
   * Every Hall Call `{floor, direction}` from press until the elevator that
   * took it opens its doors there (Story 2.3). Independent of
   * `pendingHallCalls` (`Dispatcher`'s unassigned-backlog concept, FR-7):
   * this stays lit through and past assignment, clearing only on actual
   * service, so it drives the FR-2 "lit until serviced" client indicator.
   */
  readonly activeHallCalls: readonly PendingHallCall[];
}
