import type { Direction } from './Direction.js';
import type { DoorState } from './DoorState.js';
import { ElevatorState, type ElevatorStateName } from './states/ElevatorState.js';
import { IdleState } from './states/IdleState.js';
import { DoorOpenState } from './states/DoorOpenState.js';

/** Dwell duration, in ticks, that `DoorOpenState` holds the door open before deciding what's next. */
export const DOOR_DWELL_TICKS = 3;

/** Read-only external view of an Elevator's internal state. */
export interface ElevatorSnapshot {
  readonly id: string;
  readonly currentFloor: number;
  readonly direction: Direction;
  readonly doorState: DoorState;
  readonly stopQueue: readonly number[];
  readonly stateName: ElevatorStateName;
}

/**
 * Encapsulated elevator domain object. All mutable fields are private;
 * external callers may only observe via `getSnapshot()` or mutate via the
 * public command surface. Behavior for movement/doors is delegated to the
 * current `ElevatorState` (state pattern) — `tick()` contains no
 * switch/if-chain on state name.
 */
export class Elevator {
  readonly id: string;

  private currentFloor: number;
  private direction: Direction = 'IDLE';
  private doorState: DoorState = 'CLOSED';
  private stopQueue: number[] = [];
  private state: ElevatorState = new IdleState();
  private dwellTicksRemaining = 0;

  constructor(id: string, startFloor: number) {
    if (!Number.isInteger(startFloor)) {
      throw new Error(`Elevator startFloor must be a finite integer, got ${startFloor}`);
    }
    this.id = id;
    this.currentFloor = startFloor;
  }

  /** Advance the simulation by one tick, delegating to the current state. */
  tick(): void {
    this.state.onTick(this);
  }

  /**
   * Queue a stop at `floor` (Hall/Car Call insertion in later stories).
   * Story 1.1 only needs a minimal internal queue good enough to drive
   * correct state transitions; a single insertStop/completeStop contract
   * is formalized in Story 1.4. Mutation stays private to `Elevator` so
   * that refactor stays contained here.
   */
  addStop(floor: number): void {
    if (this.stopQueue.includes(floor)) {
      return;
    }
    this.stopQueue.push(floor);
    this.state.onHallAssigned(this);
  }

  /** Read-only external view of this elevator's state. */
  getSnapshot(): ElevatorSnapshot {
    return {
      id: this.id,
      currentFloor: this.currentFloor,
      direction: this.direction,
      doorState: this.doorState,
      stopQueue: [...this.stopQueue],
      stateName: this.state.name,
    };
  }

  // ---------------------------------------------------------------------
  // Internal API — intended for use only by ElevatorState handlers, which
  // receive `this` Elevator as an argument. Not part of the public command
  // surface; external callers should use addStop()/getSnapshot() above.
  // ---------------------------------------------------------------------

  /** Transition to a new state. Called only by state handlers. */
  setState(state: ElevatorState): void {
    this.state = state;
  }

  getCurrentFloor(): number {
    return this.currentFloor;
  }

  moveOneFloor(delta: 1 | -1): void {
    this.currentFloor += delta;
  }

  getDirection(): Direction {
    return this.direction;
  }

  setDirection(direction: Direction): void {
    this.direction = direction;
  }

  getDoorState(): DoorState {
    return this.doorState;
  }

  setDoorState(doorState: DoorState): void {
    this.doorState = doorState;
  }

  hasStop(floor: number): boolean {
    return this.stopQueue.includes(floor);
  }

  isStopQueueEmpty(): boolean {
    return this.stopQueue.length === 0;
  }

  /** Remove `floor` from the queue (called on arrival at a queued stop). */
  removeStop(floor: number): void {
    const index = this.stopQueue.indexOf(floor);
    if (index !== -1) {
      this.stopQueue.splice(index, 1);
    }
  }

  /**
   * Open the doors and transition to DoorOpenState after a moving state
   * detects arrival at a queued floor. Owned by Elevator (rather than
   * MovingState importing DoorOpenState directly) to keep the state
   * modules free of a MovingState -> DoorOpenState -> MovingUpState/
   * MovingDownState -> MovingState import cycle.
   */
  openDoorForArrival(): void {
    this.doorState = 'OPEN';
    this.dwellTicksRemaining = DOOR_DWELL_TICKS;
    this.state = new DoorOpenState();
  }

  /** True if any queued stop is strictly above the current floor. */
  hasStopAbove(): boolean {
    return this.stopQueue.some((floor) => floor > this.currentFloor);
  }

  /** True if any queued stop is strictly below the current floor. */
  hasStopBelow(): boolean {
    return this.stopQueue.some((floor) => floor < this.currentFloor);
  }

  getDwellTicksRemaining(): number {
    return this.dwellTicksRemaining;
  }

  decrementDwellTicks(): void {
    this.dwellTicksRemaining = Math.max(0, this.dwellTicksRemaining - 1);
  }
}
