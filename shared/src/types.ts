/**
 * Canonical wire-contract primitives (AD-4). This is the single source of
 * truth for `Direction`/`DoorState` — `backend/src/domain/{Direction,DoorState}.ts`
 * re-export from here so `domain/` import paths stay stable, and the
 * frontend (Story 2.2+) imports these same types directly.
 */
export type Direction = 'UP' | 'DOWN' | 'IDLE';

export type DoorState = 'OPEN' | 'OPENING' | 'CLOSING' | 'CLOSED';

/**
 * Identifier for each concrete `ElevatorState` (domain state-pattern
 * hierarchy). Lives here rather than `backend/src/domain/states/ElevatorState.ts`
 * because it's also part of the wire contract (`ElevatorSnapshot.stateName`);
 * `domain/` imports it back from `shared` the same way it does `Direction`/`DoorState`.
 */
export type ElevatorStateName = 'IDLE' | 'MOVING_UP' | 'MOVING_DOWN' | 'DOOR_OPEN';
