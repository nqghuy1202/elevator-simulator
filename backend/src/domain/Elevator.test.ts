import { describe, expect, it } from 'vitest';
import { Elevator } from './Elevator.js';

describe('Elevator state machine', () => {
  it('Idle gets a stop above: tick() transitions to MovingUpState', () => {
    const elevator = new Elevator('E1', 5);
    elevator.assignHallCall(8);

    elevator.tick();

    const snapshot = elevator.getSnapshot();
    expect(snapshot.stateName).toBe('MOVING_UP');
    expect(snapshot.direction).toBe('UP');
  });

  it('Idle gets a stop below: tick() transitions to MovingDownState', () => {
    const elevator = new Elevator('E1', 5);
    elevator.assignHallCall(2);

    elevator.tick();

    const snapshot = elevator.getSnapshot();
    expect(snapshot.stateName).toBe('MOVING_DOWN');
    expect(snapshot.direction).toBe('DOWN');
  });

  it('Arrival at a queued floor, same direction: transitions to DoorOpenState at floor 8; 8 removed from queue', () => {
    const elevator = new Elevator('E1', 7);
    elevator.assignHallCall(8);
    // assignHallCall() triggers IdleState -> MovingUpState transition
    // immediately (onStopAssigned). Advance one more tick to move floor 7 -> 8.
    elevator.tick();

    const snapshot = elevator.getSnapshot();
    expect(snapshot.currentFloor).toBe(8);
    expect(snapshot.stateName).toBe('DOOR_OPEN');
    expect(snapshot.doorState).toBe('OPEN');
    expect(snapshot.stopQueue).not.toContain(8);
  });

  it('Passing a floor not in queue: elevator continues moving, stays MovingUpState', () => {
    const elevator = new Elevator('E1', 6);
    elevator.assignHallCall(10);
    // First tick after assignHallCall moves 6 -> 7 (7 not queued).
    elevator.tick();

    const snapshot = elevator.getSnapshot();
    expect(snapshot.currentFloor).toBe(7);
    expect(snapshot.stateName).toBe('MOVING_UP');
    expect(snapshot.stopQueue).toContain(10);
  });

  it('adding a second stop further ahead while already moving does not disrupt current direction, and both stops are serviced', () => {
    const elevator = new Elevator('E1', 1);
    elevator.assignHallCall(5); // 1 -> Idle picks UP -> MovingUpState
    expect(elevator.getSnapshot().stateName).toBe('MOVING_UP');

    elevator.tick(); // 1 -> 2, still moving up
    elevator.assignHallCall(9); // queue a second, farther stop while moving
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
    elevator.assignHallCall(8);
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
    elevator.assignHallCall(8);
    elevator.assignHallCall(12);
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
    elevator.assignHallCall(8);
    elevator.assignHallCall(2);
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
    elevator.assignHallCall(8);

    const snapshot = elevator.getSnapshot();
    // Mutating the returned array must not affect the elevator's own queue.
    (snapshot.stopQueue as number[]).push(999);

    expect(elevator.getSnapshot().stopQueue).toEqual([8]);
  });
});

describe('Elevator stop-queue insertion contract (AD-6)', () => {
  it('Hall Call and Car Call both route through one insertion path: identical resulting stopQueue/direction/stateName', () => {
    const hallElevator = new Elevator('E1', 5);
    const carElevator = new Elevator('E2', 5);

    const hallResult = hallElevator.assignHallCall(8);
    const carResult = carElevator.assignCarCall(8);

    expect(hallResult).toBe(true);
    expect(carResult).toBe(true);
    const hallSnapshot = hallElevator.getSnapshot();
    const carSnapshot = carElevator.getSnapshot();
    expect(carSnapshot.stopQueue).toEqual(hallSnapshot.stopQueue);
    expect(carSnapshot.direction).toBe(hallSnapshot.direction);
    expect(carSnapshot.stateName).toBe(hallSnapshot.stateName);
  });

  it('Insert into empty queue while Idle: returns true, elevator transitions toward the floor', () => {
    const elevator = new Elevator('E1', 5);

    const result = elevator.assignHallCall(8);

    expect(result).toBe(true);
    expect(elevator.getSnapshot().stopQueue).toContain(8);
    expect(elevator.getSnapshot().stateName).toBe('MOVING_UP');
  });

  it('Insert floor equal to currentFloor, doors closed (genuinely new stop at own floor): returns true, floor queued then immediately serviced', () => {
    const elevator = new Elevator('E1', 5);
    expect(elevator.getSnapshot().doorState).toBe('CLOSED');

    const result = elevator.assignHallCall(5);

    expect(result).toBe(true);
    // IdleState's same-floor fast path services it immediately on assignment.
    expect(elevator.getSnapshot().stateName).toBe('DOOR_OPEN');
    expect(elevator.getSnapshot().stopQueue).not.toContain(5);
  });

  it('Insert floor equal to currentFloor, doors already open (mid-visit duplicate): returns false, stopQueue unchanged', () => {
    const elevator = new Elevator('E1', 5);
    elevator.assignHallCall(5); // services immediately -> DoorOpenState, doors OPEN
    expect(elevator.getSnapshot().stateName).toBe('DOOR_OPEN');
    expect(elevator.getSnapshot().doorState).toBe('OPEN');
    const beforeQueue = elevator.getSnapshot().stopQueue;

    const result = elevator.assignHallCall(5);

    expect(result).toBe(false);
    expect(elevator.getSnapshot().stopQueue).toEqual(beforeQueue);
  });

  it('Insert an already-queued floor: returns false, stopQueue still contains exactly one 8', () => {
    const elevator = new Elevator('E1', 1);
    elevator.assignHallCall(8);

    const result = elevator.assignHallCall(8);

    expect(result).toBe(false);
    expect(elevator.getSnapshot().stopQueue.filter((floor) => floor === 8)).toHaveLength(1);
  });

  it('completeStop is the only removal path: MovingState.onArriveFloor removes the queued stop it arrives at', () => {
    const elevator = new Elevator('E1', 5);
    elevator.assignHallCall(8);

    elevator.tick(); // 5 -> 6
    elevator.tick(); // 6 -> 7
    elevator.tick(); // 7 -> 8, arrives, completeStop(8) removes it

    expect(elevator.getSnapshot().stopQueue).not.toContain(8);
    expect(elevator.getSnapshot().stateName).toBe('DOOR_OPEN');
  });

  it('MovingUpState: multiple stops queued out of order are stored ascending in stopQueue', () => {
    const elevator = new Elevator('E1', 1);
    elevator.assignHallCall(9); // Idle -> MovingUpState
    expect(elevator.getSnapshot().stateName).toBe('MOVING_UP');

    elevator.assignHallCall(6); // inserted out of arrival order, ahead of 9

    expect(elevator.getSnapshot().stopQueue).toEqual([6, 9]);
  });

  it('MovingDownState: multiple stops queued out of order are stored descending in stopQueue', () => {
    const elevator = new Elevator('E1', 9);
    elevator.assignHallCall(1); // Idle -> MovingDownState
    expect(elevator.getSnapshot().stateName).toBe('MOVING_DOWN');

    elevator.assignHallCall(4); // inserted out of arrival order, ahead of 1

    expect(elevator.getSnapshot().stopQueue).toEqual([4, 1]);
  });

  it('MovingUpState: inserting a stop between two already-queued stops places it at the correct mid-queue position', () => {
    const elevator = new Elevator('E1', 1);
    elevator.assignHallCall(10); // Idle -> MovingUpState
    elevator.assignHallCall(4);
    expect(elevator.getSnapshot().stopQueue).toEqual([4, 10]);

    elevator.assignHallCall(7); // lands strictly between 4 and 10

    expect(elevator.getSnapshot().stopQueue).toEqual([4, 7, 10]);
  });
});

describe('Elevator.openDoor() / closeDoor() (Door Hold/Close commands, AD-2)', () => {
  it('openDoor(): in DoorOpenState, resets the dwell timer so the door stays open longer', () => {
    const elevator = new Elevator('E1', 5);
    elevator.assignHallCall(5); // same-floor fast path: opens doors immediately, dwell = 3
    expect(elevator.getSnapshot().stateName).toBe('DOOR_OPEN');

    elevator.tick(); // dwell 3 -> 2
    elevator.tick(); // dwell 2 -> 1

    const result = elevator.openDoor();
    expect(result).toBe(true);

    // Dwell was reset to 3: two more ticks (3 -> 2 -> 1) still leave doors open.
    elevator.tick();
    elevator.tick();
    expect(elevator.getSnapshot().doorState).toBe('OPEN');
    expect(elevator.getSnapshot().stateName).toBe('DOOR_OPEN');
  });

  it('openDoor(): outside DoorOpenState is a no-op returning false', () => {
    const elevator = new Elevator('E1', 5);
    expect(elevator.getSnapshot().stateName).toBe('IDLE');

    const result = elevator.openDoor();

    expect(result).toBe(false);
    expect(elevator.getSnapshot().stateName).toBe('IDLE');
  });

  it('closeDoor(): in DoorOpenState, forces remaining dwell to 0; door begins closing next tick', () => {
    const elevator = new Elevator('E1', 5);
    elevator.assignHallCall(5); // same-floor fast path: opens doors immediately, dwell = 3
    expect(elevator.getSnapshot().stateName).toBe('DOOR_OPEN');
    expect(elevator.getSnapshot().doorState).toBe('OPEN');

    const result = elevator.closeDoor();
    expect(result).toBe(true);
    expect(elevator.getDwellTicksRemaining()).toBe(0);
    // Door itself only actually closes on the next tick -- closeDoor() only forces the timer.
    expect(elevator.getSnapshot().doorState).toBe('OPEN');

    elevator.tick(); // dwell already 0 -> DoorOpenState closes the door and goes Idle (queue empty)

    const snapshot = elevator.getSnapshot();
    expect(snapshot.doorState).toBe('CLOSED');
    expect(snapshot.stateName).toBe('IDLE');
  });

  it('closeDoor(): outside DoorOpenState is a no-op returning false', () => {
    const elevator = new Elevator('E1', 5);
    elevator.assignHallCall(8); // Idle -> MovingUpState, doors closed, not DoorOpenState
    expect(elevator.getSnapshot().stateName).toBe('MOVING_UP');

    const result = elevator.closeDoor();

    expect(result).toBe(false);
    expect(elevator.getSnapshot().doorState).toBe('CLOSED');
  });

  it('openDoor(): still in DoorOpenState with dwell already at 0 (boundary right before closing): resets dwell back up, door stays open past the tick that would have closed it', () => {
    const elevator = new Elevator('E1', 5);
    elevator.assignHallCall(5); // same-floor fast path: opens doors immediately, dwell = 3
    elevator.tick(); // dwell 3 -> 2
    elevator.tick(); // dwell 2 -> 1
    elevator.tick(); // dwell 1 -> 0, door still OPEN (DoorOpenState only closes on the *next* tick after reaching 0)
    expect(elevator.getDwellTicksRemaining()).toBe(0);
    expect(elevator.getSnapshot().stateName).toBe('DOOR_OPEN');

    const result = elevator.openDoor();

    expect(result).toBe(true);
    expect(elevator.getDwellTicksRemaining()).toBe(3);
    // The tick that would have closed the door (dwell already 0) instead sees
    // a freshly-reset dwell, so the door stays open.
    elevator.tick();
    expect(elevator.getSnapshot().doorState).toBe('OPEN');
    expect(elevator.getSnapshot().stateName).toBe('DOOR_OPEN');
  });

  it('closeDoor(): still in DoorOpenState with dwell already at 0 (boundary right before closing): no-ops the timer (already 0), door closes on the very next tick regardless', () => {
    const elevator = new Elevator('E1', 5);
    elevator.assignHallCall(5); // same-floor fast path: opens doors immediately, dwell = 3
    elevator.tick(); // dwell 3 -> 2
    elevator.tick(); // dwell 2 -> 1
    elevator.tick(); // dwell 1 -> 0, door still OPEN
    expect(elevator.getDwellTicksRemaining()).toBe(0);
    expect(elevator.getSnapshot().stateName).toBe('DOOR_OPEN');

    const result = elevator.closeDoor();

    expect(result).toBe(true);
    expect(elevator.getDwellTicksRemaining()).toBe(0);
    expect(elevator.getSnapshot().doorState).toBe('OPEN'); // still open until the next tick actually runs

    elevator.tick(); // dwell already 0 -> closes this tick, queue empty -> Idle

    const snapshot = elevator.getSnapshot();
    expect(snapshot.doorState).toBe('CLOSED');
    expect(snapshot.stateName).toBe('IDLE');
  });
});

describe('Elevator.assignHallCall direction tagging / takeServicedHallCallDirections (Story 2.3)', () => {
  it('assignHallCall(floor) with no direction: compiles and behaves exactly like before, no tag recorded', () => {
    const elevator = new Elevator('E1', 5);

    const result = elevator.assignHallCall(8);

    expect(result).toBe(true);
    expect(elevator.takeServicedHallCallDirections(8).size).toBe(0);
  });

  it('fresh insert with a direction: tags that floor/direction, drained once doors open there', () => {
    const elevator = new Elevator('E1', 5);

    elevator.assignHallCall(8, 'UP');
    elevator.tick(); // 5 -> 6
    elevator.tick(); // 6 -> 7
    elevator.tick(); // 7 -> 8, arrives, doors open

    expect(elevator.getSnapshot().doorState).toBe('OPEN');
    const drained = elevator.takeServicedHallCallDirections(8);
    expect(drained).toEqual(new Set(['UP']));
    // Draining again (still open) is a safe no-op -- entry already gone.
    expect(elevator.takeServicedHallCallDirections(8).size).toBe(0);
  });

  it('piggyback on an already-queued stop (Car Call to the same floor): insertStop no-ops but the direction is still tagged', () => {
    const elevator = new Elevator('E1', 5);
    elevator.assignCarCall(8); // Car Call queues floor 8 first

    const result = elevator.assignHallCall(8, 'UP'); // same floor already queued -> insertStop no-ops

    expect(result).toBe(false);
    elevator.tick(); // 5 -> 6
    elevator.tick(); // 6 -> 7
    elevator.tick(); // 7 -> 8, arrives, doors open

    expect(elevator.getSnapshot().doorState).toBe('OPEN');
    expect(elevator.takeServicedHallCallDirections(8)).toEqual(new Set(['UP']));
  });

  it('piggyback on an already-tagged same-direction Hall Call: both dedupe into one Set entry, drained together', () => {
    const elevator = new Elevator('E1', 1);
    elevator.assignHallCall(9); // Idle -> MovingUpState, queues 9 (no direction tag yet)
    elevator.assignHallCall(9, 'UP'); // dispatcher retry against the same still-eligible elevator, now tags

    elevator.assignHallCall(9, 'UP'); // duplicate tag attempt -- idempotent Set.add

    for (let i = 0; i < 8; i++) elevator.tick(); // 1 -> 9, arrives, doors open
    expect(elevator.getSnapshot().doorState).toBe('OPEN');
    expect(elevator.takeServicedHallCallDirections(9)).toEqual(new Set(['UP']));
  });

  it('press while doors already open here: tags immediately, drains within the same call (no insertStop queuing needed)', () => {
    const elevator = new Elevator('E1', 5);
    elevator.assignHallCall(5, 'UP'); // same-floor fast path: opens doors immediately, tagged
    expect(elevator.getSnapshot().stateName).toBe('DOOR_OPEN');
    expect(elevator.getSnapshot().doorState).toBe('OPEN');

    // A second Hall Call in a compatible direction arrives while still open here.
    const result = elevator.assignHallCall(5, 'UP');

    expect(result).toBe(false); // insertStop no-ops: same floor, doors not CLOSED
    expect(elevator.takeServicedHallCallDirections(5)).toEqual(new Set(['UP']));
  });

  it('opposite direction independence: tagging UP for a floor never drains a separately-tracked DOWN tag at the same floor', () => {
    const elevator = new Elevator('E1', 5);
    elevator.assignHallCall(8, 'UP');
    elevator.assignHallCall(8, 'DOWN'); // hypothetically tagged on the same elevator/floor (dedupe by direction, not floor)

    elevator.tick(); // 5 -> 6
    elevator.tick(); // 6 -> 7
    elevator.tick(); // 7 -> 8, arrives, doors open

    const drained = elevator.takeServicedHallCallDirections(8);
    expect(drained).toEqual(new Set(['UP', 'DOWN']));
  });

  it('takeServicedHallCallDirections on a floor with no tags returns an empty Set, never throws', () => {
    const elevator = new Elevator('E1', 5);

    expect(elevator.takeServicedHallCallDirections(3).size).toBe(0);
  });
});
