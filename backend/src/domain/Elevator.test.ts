import { describe, expect, it } from 'vitest';
import { Elevator } from './Elevator.js';

describe('Elevator state machine', () => {
  it('Idle gets a stop above: tick() transitions to MovingUpState', () => {
    const elevator = new Elevator('E1', 5);
    elevator.addStop(8);

    elevator.tick();

    const snapshot = elevator.getSnapshot();
    expect(snapshot.stateName).toBe('MOVING_UP');
    expect(snapshot.direction).toBe('UP');
  });

  it('Idle gets a stop below: tick() transitions to MovingDownState', () => {
    const elevator = new Elevator('E1', 5);
    elevator.addStop(2);

    elevator.tick();

    const snapshot = elevator.getSnapshot();
    expect(snapshot.stateName).toBe('MOVING_DOWN');
    expect(snapshot.direction).toBe('DOWN');
  });

  it('Arrival at a queued floor, same direction: transitions to DoorOpenState at floor 8; 8 removed from queue', () => {
    const elevator = new Elevator('E1', 7);
    elevator.addStop(8);
    // addStop() triggers IdleState -> MovingUpState transition immediately
    // (onHallAssigned). Advance one more tick to move floor 7 -> 8.
    elevator.tick();

    const snapshot = elevator.getSnapshot();
    expect(snapshot.currentFloor).toBe(8);
    expect(snapshot.stateName).toBe('DOOR_OPEN');
    expect(snapshot.doorState).toBe('OPEN');
    expect(snapshot.stopQueue).not.toContain(8);
  });

  it('Passing a floor not in queue: elevator continues moving, stays MovingUpState', () => {
    const elevator = new Elevator('E1', 6);
    elevator.addStop(10);
    // First tick after addStop moves 6 -> 7 (7 not queued).
    elevator.tick();

    const snapshot = elevator.getSnapshot();
    expect(snapshot.currentFloor).toBe(7);
    expect(snapshot.stateName).toBe('MOVING_UP');
    expect(snapshot.stopQueue).toContain(10);
  });

  it('adding a second stop further ahead while already moving does not disrupt current direction, and both stops are serviced', () => {
    const elevator = new Elevator('E1', 1);
    elevator.addStop(5); // 1 -> Idle picks UP -> MovingUpState
    expect(elevator.getSnapshot().stateName).toBe('MOVING_UP');

    elevator.tick(); // 1 -> 2, still moving up
    elevator.addStop(9); // queue a second, farther stop while moving
    expect(elevator.getSnapshot().stateName).toBe('MOVING_UP');
    expect(elevator.getSnapshot().direction).toBe('UP');

    elevator.tick(); // 2 -> 3
    elevator.tick(); // 3 -> 4
    elevator.tick(); // 4 -> 5, arrives at first stop
    let snapshot = elevator.getSnapshot();
    expect(snapshot.currentFloor).toBe(5);
    expect(snapshot.stateName).toBe('DOOR_OPEN');
    expect(snapshot.stopQueue).toEqual([9]);

    elevator.tick(); // dwell 3 -> 2
    elevator.tick(); // dwell 2 -> 1
    elevator.tick(); // dwell 1 -> 0
    elevator.tick(); // dwell expired, 9 still queued above -> MovingUp again
    expect(elevator.getSnapshot().stateName).toBe('MOVING_UP');

    elevator.tick(); // 5 -> 6
    elevator.tick(); // 6 -> 7
    elevator.tick(); // 7 -> 8
    elevator.tick(); // 8 -> 9, arrives at second stop
    snapshot = elevator.getSnapshot();
    expect(snapshot.currentFloor).toBe(9);
    expect(snapshot.stateName).toBe('DOOR_OPEN');
    expect(snapshot.stopQueue).toEqual([]);
  });

  it('Door open, queue empty above and below: transitions to IdleState after closing', () => {
    const elevator = new Elevator('E1', 5);
    elevator.addStop(8);
    elevator.tick(); // 5 -> 6
    elevator.tick(); // 6 -> 7
    elevator.tick(); // 7 -> 8, arrives, DoorOpenState, dwell = 3

    expect(elevator.getSnapshot().stateName).toBe('DOOR_OPEN');

    elevator.tick(); // dwell 3 -> 2
    elevator.tick(); // dwell 2 -> 1
    elevator.tick(); // dwell 1 -> 0
    expect(elevator.getSnapshot().stateName).toBe('DOOR_OPEN');

    elevator.tick(); // dwell expired, queue empty -> Idle

    const snapshot = elevator.getSnapshot();
    expect(snapshot.stateName).toBe('IDLE');
    expect(snapshot.doorState).toBe('CLOSED');
    expect(snapshot.direction).toBe('IDLE');
  });

  it('Door open, more stops above: transitions to MovingUpState after closing', () => {
    const elevator = new Elevator('E1', 5);
    elevator.addStop(8);
    elevator.addStop(12);
    elevator.tick(); // 5 -> 6
    elevator.tick(); // 6 -> 7
    elevator.tick(); // 7 -> 8, arrives, DoorOpenState

    expect(elevator.getSnapshot().stateName).toBe('DOOR_OPEN');

    elevator.tick(); // dwell 3 -> 2
    elevator.tick(); // dwell 2 -> 1
    elevator.tick(); // dwell 1 -> 0
    elevator.tick(); // dwell expired -> should move to MovingUp (12 still queued)

    const snapshot = elevator.getSnapshot();
    expect(snapshot.stateName).toBe('MOVING_UP');
    expect(snapshot.direction).toBe('UP');
    expect(snapshot.stopQueue).toContain(12);
  });

  it('Door open, only stops below (reversal): transitions to MovingDownState after closing', () => {
    const elevator = new Elevator('E1', 5);
    elevator.addStop(8);
    elevator.addStop(2);
    elevator.tick(); // 5 -> 6
    elevator.tick(); // 6 -> 7
    elevator.tick(); // 7 -> 8, arrives, DoorOpenState

    expect(elevator.getSnapshot().stateName).toBe('DOOR_OPEN');

    elevator.tick(); // dwell 3 -> 2
    elevator.tick(); // dwell 2 -> 1
    elevator.tick(); // dwell 1 -> 0
    elevator.tick(); // dwell expired -> only 2 remains (below) -> MovingDown

    const snapshot = elevator.getSnapshot();
    expect(snapshot.stateName).toBe('MOVING_DOWN');
    expect(snapshot.direction).toBe('DOWN');
    expect(snapshot.stopQueue).toContain(2);
  });

  it('Tick with nothing to do: IdleState, empty stopQueue, tick() is a no-op, stays IdleState', () => {
    const elevator = new Elevator('E1', 5);

    elevator.tick();

    const snapshot = elevator.getSnapshot();
    expect(snapshot.stateName).toBe('IDLE');
    expect(snapshot.currentFloor).toBe(5);
    expect(snapshot.direction).toBe('IDLE');
    expect(snapshot.doorState).toBe('CLOSED');
    expect(snapshot.stopQueue).toEqual([]);
  });

  it('getSnapshot() returns an independent copy, not a live reference to internal state', () => {
    const elevator = new Elevator('E1', 5);
    elevator.addStop(8);

    const snapshot = elevator.getSnapshot();
    // Mutating the returned array must not affect the elevator's own queue.
    (snapshot.stopQueue as number[]).push(999);

    expect(elevator.getSnapshot().stopQueue).toEqual([8]);
  });
});
