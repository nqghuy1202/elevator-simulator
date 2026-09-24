import type { Direction } from './Direction.js';
import type { DoorState } from './DoorState.js';
import type { ElevatorSnapshot } from 'shared/src/index.js';
import { ElevatorState } from './states/ElevatorState.js';
import { IdleState } from './states/IdleState.js';
import { DoorOpenState } from './states/DoorOpenState.js';

/** Dwell duration, in ticks, that `DoorOpenState` holds the door open before deciding what's next. */
export const DOOR_DWELL_TICKS = 3;

export type { ElevatorSnapshot };

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
  /**
   * Tracks, per floor, which Hall Call directions this Elevator has taken
   * responsibility for (Story 2.3) — independent pure bookkeeping alongside
   * `stopQueue`, never consulted by any state-machine logic. Populated by
   * `assignHallCall` and drained by `takeServicedHallCallDirections` once
   * this Elevator actually opens its doors at that floor.
   */
  private hallCallDirections = new Map<number, Set<Exclude<Direction, 'IDLE'>>>();

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
   * Assign a Hall Call at `floor`. The single external entry point Hall
   * Call dispatch (`Dispatcher`) uses; routes through `insertStop` like
   * `assignCarCall` does. Returns whether the floor was actually queued —
   * unchanged by the `direction` tagging below, which is pure additional
   * bookkeeping and never affects `insertStop`/`Dispatcher` routing.
   *
   * `direction` is optional so every existing call site/test calling
   * `assignHallCall(floor)` alone keeps compiling and behaving unchanged.
   * When provided, the floor's direction is tagged in `hallCallDirections`
   * whenever, after `insertStop`, that floor ends up in `stopQueue` for ANY
   * reason (a fresh insert, or already queued for another reason — a Car
   * Call, or a same-direction Hall Call already tagged there) — since this
   * Elevator is still going to open its doors there — or the elevator is
   * already stationary at that exact floor with doors currently `OPEN`
   * (Review Triage Log #1/#2: widened from "fresh insert only", which
   * stranded Hall Calls lit forever in those two cases).
   */
  assignHallCall(floor: number, direction?: Exclude<Direction, 'IDLE'>): boolean {
    const inserted = this.insertStop(floor);
    if (inserted) this.state.onStopAssigned(this);

    const alreadyThere = floor === this.currentFloor && this.doorState === 'OPEN';
    if (direction !== undefined && (this.stopQueue.includes(floor) || alreadyThere)) {
      const directions = this.hallCallDirections.get(floor) ?? new Set();
      directions.add(direction);
      this.hallCallDirections.set(floor, directions);
    }

    return inserted;
  }

  /**
   * Assign a Car Call at `floor` (in-cabin button press). Routes through
   * `insertStop` like `assignHallCall` does. Returns whether the floor was
   * actually queued. Not yet wired to any caller in production code —
   * Epic 2 introduces the in-cabin control surface that will call this.
   */
  assignCarCall(floor: number): boolean {
    const inserted = this.insertStop(floor);
    if (inserted) this.state.onStopAssigned(this);
    return inserted;
  }

  /**
   * Door Hold command (AD-2): resets the dwell timer back to
   * `DOOR_DWELL_TICKS` so the door stays open longer, as if a fresh arrival
   * just happened. A no-op (returns `false`) outside `DoorOpenState` —
   * there is no dwell timer to hold open in any other state.
   */
  openDoor(): boolean {
    if (this.state.name !== 'DOOR_OPEN') {
      return false;
    }
    this.dwellTicksRemaining = DOOR_DWELL_TICKS;
    return true;
  }

  /**
   * Door Close command (AD-2): forces the remaining dwell to 0 so
   * `DoorOpenState.onTick` closes the door on the very next tick, instead
   * of waiting out the rest of the dwell timer. A no-op (returns `false`)
   * outside `DoorOpenState`.
   */
  closeDoor(): boolean {
    if (this.state.name !== 'DOOR_OPEN') {
      return false;
    }
    this.dwellTicksRemaining = 0;
    return true;
  }

  /**
   * Read-and-clear this floor's tagged Hall Call directions (Story 2.3):
   * returns whichever directions were tagged onto this Elevator for `floor`
   * via `assignHallCall`, then removes that floor's entry entirely. Callers
   * (`Building.drainServicedHallCalls`) are expected to call this only while
   * this Elevator's doors are `OPEN` at `floor` — calling it again on a
   * still-open door is a safe no-op since the entry is already gone, so no
   * diffing between ticks is needed. Pure bookkeeping alongside `stopQueue`;
   * never consulted by any state-machine logic.
   */
  takeServicedHallCallDirections(floor: number): ReadonlySet<Exclude<Direction, 'IDLE'>> {
    const directions = this.hallCallDirections.get(floor) ?? new Set<Exclude<Direction, 'IDLE'>>();
    this.hallCallDirections.delete(floor);
    return directions;
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
  // surface; external callers should use assignHallCall()/assignCarCall()/
  // getSnapshot() above.
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

  /**
   * The single insertion path behind `assignHallCall`/`assignCarCall`
   * (AD-6). No-ops (returns `false`) when `floor` is already queued, or
   * when `floor` equals `currentFloor` while the door isn't `CLOSED` (a
   * duplicate of a stop already being serviced). Otherwise inserts `floor`
   * in position consistent with the current `Direction` and returns `true`.
   */
  private insertStop(floor: number): boolean {
    if (this.stopQueue.includes(floor)) {
      return false;
    }
    if (floor === this.currentFloor && this.doorState !== 'CLOSED') {
      return false;
    }

    const insertionIndex = this.findInsertionIndex(floor);
    this.stopQueue.splice(insertionIndex, 0, floor);
    return true;
  }

  /**
   * Position `floor` within `stopQueue` consistent with the current
   * `Direction`: ascending order while moving/idle-toward-UP, descending
   * while moving DOWN. When `Direction` is `IDLE` (empty queue, first
   * insert), any position is equivalent since `IdleState` decides
   * direction fresh from the post-insertion queue — append is simplest.
   */
  private findInsertionIndex(floor: number): number {
    if (this.direction === 'DOWN') {
      const index = this.stopQueue.findIndex((queued) => queued < floor);
      return index === -1 ? this.stopQueue.length : index;
    }

    // UP or IDLE: ascending order.
    const index = this.stopQueue.findIndex((queued) => queued > floor);
    return index === -1 ? this.stopQueue.length : index;
  }

  /**
   * The sole removal path (AD-6): removes `floor` from the queue. Called
   * only from arrival handlers (`MovingState.onArriveFloor`, and the
   * same-floor fast paths in `IdleState`/`DoorOpenState`) — no other
   * method shrinks the queue.
   */
  completeStop(floor: number): void {
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
