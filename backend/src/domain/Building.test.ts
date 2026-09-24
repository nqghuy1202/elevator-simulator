import { describe, expect, it } from 'vitest';
import { Building } from './Building.js';

describe('Building construction', () => {
  it('default construction: 3 Elevators created, all Idle at floor 1; getElevatorSnapshots() returns 3 entries', () => {
    const building = new Building({ floors: 10, elevatorCount: 3 });

    const snapshots = building.getElevatorSnapshots();

    expect(snapshots).toHaveLength(3);
    expect(snapshots.map((s) => s.id)).toEqual(['E1', 'E2', 'E3']);
    for (const snapshot of snapshots) {
      expect(snapshot.currentFloor).toBe(1);
      expect(snapshot.stateName).toBe('IDLE');
      expect(snapshot.direction).toBe('IDLE');
      expect(snapshot.doorState).toBe('CLOSED');
      expect(snapshot.stopQueue).toEqual([]);
    }
  });
});

describe('Building.handleHallCall end-to-end routing', () => {
  it('routes a Hall Call through Building to the nearest elevator, which arrives and opens its doors', () => {
    const building = new Building({ floors: 10, elevatorCount: 3 });

    building.handleHallCall(5, 'UP');

    // Idle -> MovingUpState happens synchronously on assignment (onStopAssigned).
    let assigned = building.getElevatorSnapshots().find((s) => s.stopQueue.includes(5) || s.currentFloor === 5);
    expect(assigned).toBeDefined();

    // Ride ticks until some elevator reaches floor 5 with doors open.
    for (let i = 0; i < 10; i++) {
      building.tick();
      const arrived = building
        .getElevatorSnapshots()
        .find((s) => s.currentFloor === 5 && s.doorState === 'OPEN');
      if (arrived) {
        assigned = arrived;
        break;
      }
    }

    expect(assigned?.currentFloor).toBe(5);
    expect(assigned?.doorState).toBe('OPEN');
  });
});

describe('Building.tick() reevaluatePending ordering (AD-7)', () => {
  it('a pending call resolved by an elevator freed up in the same tick is assigned within that same tick() call', () => {
    const building = new Building({ floors: 10, elevatorCount: 1 });

    // Send the sole elevator on a one-tick trip to floor 2, arriving with
    // doors opened and a DOOR_DWELL_TICKS-tick (3) dwell countdown. We need
    // a pending call that can't be served until the elevator later goes
    // Idle, and we assert it's served in the very same tick() call the
    // elevator empties its queue and goes Idle.
    building.handleHallCall(2, 'UP'); // idle elevator -> MovingUpState toward 2
    expect(building.getElevatorSnapshots()[0]?.direction).toBe('UP');

    // A DOWN call at floor 2 can't be served while moving UP toward 2
    // (wrong direction) -> goes pending.
    building.handleHallCall(2, 'DOWN');
    expect(building.getPendingCalls()).toEqual([{ floor: 2, direction: 'DOWN' }]);

    building.tick(); // 1 -> 2, arrives, door opens (dwell = 3)
    expect(building.getElevatorSnapshots()[0]?.doorState).toBe('OPEN');

    // Three ticks decrement the dwell counter 3 -> 2 -> 1 -> 0 (door still OPEN).
    building.tick();
    building.tick();
    building.tick();

    // The 4th dwell-phase tick is the one where DoorOpenState sees dwell
    // already at 0: it closes the door, finds the queue empty, and
    // transitions to Idle -- all inside Elevator.tick(), which Building.tick()
    // calls before its single end-of-tick reevaluatePending(). That same
    // reevaluatePending() call must immediately assign the pending
    // (2, DOWN) call to the now-idle elevator (IdleState's same-floor fast
    // path re-opens the door), all within this one Building.tick() call.
    building.tick();

    expect(building.getPendingCalls()).toEqual([]);
    const snapshot = building.getElevatorSnapshots()[0];
    expect(snapshot?.currentFloor).toBe(2);
    expect(snapshot?.doorState).toBe('OPEN');
  });
});

describe('Building coordinates multiple independent elevators', () => {
  it('two elevators ticked via one building.tick() progress independently without cross-contamination', () => {
    const building = new Building({ floors: 20, elevatorCount: 2 });
    const [e1Before, e2Before] = building.getElevatorSnapshots();
    expect(e1Before?.id).toBe('E1');
    expect(e2Before?.id).toBe('E2');

    building.handleHallCall(20, 'UP'); // nearest idle elevator (E1, first in array) takes it; far enough it won't arrive during setup below
    expect(building.getElevatorSnapshots()[0]?.direction).toBe('UP');
    expect(building.getElevatorSnapshots()[0]?.stopQueue).toContain(20);
    expect(building.getElevatorSnapshots()[1]?.direction).toBe('IDLE');

    // Advance E1 a few floors so it's past floor 3, making it ineligible for
    // a floor-3 UP call (already behind it), leaving idle E2 as the only candidate.
    for (let i = 0; i < 4; i++) building.tick(); // E1: 1 -> 5, passing 3 on the way to 20
    expect(building.getElevatorSnapshots()[0]?.currentFloor).toBe(5);

    // Get E2 up to floor 3 and idle there (via its own Hall Call, ridden to
    // completion) so it has room below it to head DOWN -- floor 1 itself
    // would hit the same-floor fast path instead of a MOVING_DOWN transition.
    building.handleHallCall(3, 'UP'); // only idle E2 is eligible now (E1 already passed floor 3, heading further up)
    expect(building.getElevatorSnapshots()[1]?.direction).toBe('UP');
    expect(building.getElevatorSnapshots()[1]?.stopQueue).toContain(3);
    for (let i = 0; i < 10; i++) {
      building.tick();
      if (building.getElevatorSnapshots()[1]?.stateName === 'IDLE') break;
    }
    expect(building.getElevatorSnapshots()[1]).toMatchObject({ currentFloor: 3, stateName: 'IDLE' });

    building.handleHallCall(1, 'DOWN'); // E2 (idle at 3) is eligible; E1 (still en route to 20) is not
    expect(building.getElevatorSnapshots()[1]?.direction).toBe('DOWN');
    expect(building.getElevatorSnapshots()[1]?.stopQueue).toContain(1);

    // E1's own destination (20) is still pending and untouched throughout --
    // this is the cross-contamination check: E1 never reacted to E2's
    // Hall Calls, arrivals, or door cycles above, and vice versa.
    const e1BeforeSecondTick = building.getElevatorSnapshots()[0];
    expect(e1BeforeSecondTick?.stopQueue).toContain(20);
    expect(e1BeforeSecondTick?.direction).toBe('UP');
    const e1FloorBeforeSecondTick = e1BeforeSecondTick?.currentFloor;
    const e2FloorBeforeSecondTick = building.getElevatorSnapshots()[1]?.currentFloor;

    building.tick(); // both tick in the same call: E1 continues toward 20, E2 continues DOWN

    const [e1After, e2After] = building.getElevatorSnapshots();
    expect(e1After?.currentFloor).toBe((e1FloorBeforeSecondTick ?? 0) + 1);
    expect(e1After?.direction).toBe('UP');
    expect(e2After?.currentFloor).toBe((e2FloorBeforeSecondTick ?? 0) - 1);
    expect(e2After?.direction).toBe('DOWN');

    // Neither elevator's stopQueue was affected by the other's movement.
    expect(e1After?.stopQueue).toContain(20);
    expect(e1After?.stopQueue).not.toContain(1);
    expect(e2After?.stopQueue).toContain(1);
    expect(e2After?.stopQueue).not.toContain(20);
  });
});

describe('Building.tick() resolves multiple simultaneously-eligible pending calls in one pass', () => {
  it('two elevators that both go idle in the same tick each pick up a different pending call within that one tick() call', () => {
    const building = new Building({ floors: 10, elevatorCount: 2 });

    // Send E1 (idle, nearest) to floor 3.
    building.handleHallCall(3, 'UP');
    expect(building.getElevatorSnapshots()[0]?.stopQueue).toContain(3);
    expect(building.getElevatorSnapshots()[1]?.direction).toBe('IDLE');

    // Send E2 (now the only idle elevator) to floor 3 as well, so both
    // elevators travel the same distance and arrive/dwell/idle in lockstep.
    building.handleHallCall(3, 'DOWN'); // idle E2 is eligible for any direction; heads to 3 too
    expect(building.getElevatorSnapshots()[1]?.stopQueue).toContain(3);
    expect(building.getElevatorSnapshots()[1]?.direction).toBe('UP');

    // While both elevators are busy moving UP toward 3, two different
    // pending Hall Calls going DOWN are ineligible for either -> both pending.
    building.handleHallCall(2, 'DOWN');
    building.handleHallCall(9, 'DOWN');
    expect(building.getPendingCalls()).toEqual([
      { floor: 2, direction: 'DOWN' },
      { floor: 9, direction: 'DOWN' },
    ]);

    building.tick(); // 1 -> 2 for both, arrive? no (target 3) -- both still MOVING_UP
    building.tick(); // 2 -> 3 for both: both arrive, doors open, dwell = 3
    expect(building.getElevatorSnapshots().every((s) => s.currentFloor === 3 && s.doorState === 'OPEN')).toBe(true);

    // Three dwell ticks bring both to dwell = 0 (still OPEN); the 4th
    // dwell-phase tick is the one where each elevator's DoorOpenState
    // closes the door, finds its own queue empty, and goes Idle -- both
    // in the same Building.tick() call, since Building ticks every
    // elevator (fixed order) before its single end-of-tick reevaluatePending().
    building.tick();
    building.tick();
    building.tick();
    building.tick();

    expect(building.getPendingCalls()).toEqual([]);
    const [e1, e2] = building.getElevatorSnapshots();
    // Both pending calls (2, DOWN) and (9, DOWN) are resolved: one elevator
    // picks up each, in the same tick() call neither was assigned before.
    expect([e1?.stopQueue, e2?.stopQueue]).toContainEqual(expect.arrayContaining([2]));
    expect([e1?.stopQueue, e2?.stopQueue]).toContainEqual(expect.arrayContaining([9]));
  });
});

describe('Building configurable floor/elevator count', () => {
  it('a 5-floor/2-elevator Building resolves a Hall Call to completion identically in shape to the 10-floor/3-elevator default', () => {
    const building = new Building({ floors: 5, elevatorCount: 2 });

    expect(building.getFloorCount()).toBe(5);
    expect(building.getElevatorSnapshots()).toHaveLength(2);

    building.handleHallCall(4, 'UP');

    let arrived = false;
    for (let i = 0; i < 10 && !arrived; i++) {
      building.tick();
      arrived = building
        .getElevatorSnapshots()
        .some((s) => s.currentFloor === 4 && s.doorState === 'OPEN');
    }

    expect(arrived).toBe(true);
    expect(building.getPendingCalls()).toEqual([]);
  });
});

describe('Building introspection never exposes a live Elevator', () => {
  it('getElevatorSnapshots() returns plain ElevatorSnapshot data, not Elevator instances', () => {
    const building = new Building({ floors: 10, elevatorCount: 3 });

    const snapshots = building.getElevatorSnapshots();

    for (const snapshot of snapshots) {
      expect(snapshot).not.toHaveProperty('tick');
      expect(snapshot).not.toHaveProperty('assignHallCall');
      expect(snapshot).not.toHaveProperty('setState');
      expect(typeof snapshot).toBe('object');
    }

    // Mutating the returned array/objects must not affect Building's
    // internal state -- getSnapshot() and the map() here both copy.
    const mutated = building.getElevatorSnapshots();
    mutated.push({
      id: 'ROGUE',
      currentFloor: 99,
      direction: 'IDLE',
      doorState: 'CLOSED',
      stopQueue: [],
      stateName: 'IDLE',
    });
    expect(building.getElevatorSnapshots()).toHaveLength(3);
  });

  it('getPendingCalls() returns a plain readonly array of HallCallRequest data', () => {
    const building = new Building({ floors: 10, elevatorCount: 1 });
    building.handleHallCall(9, 'UP'); // idle elevator at floor 1 takes this, heading UP toward 9
    expect(building.getElevatorSnapshots()[0]?.direction).toBe('UP');

    // A DOWN call at floor 5 can't be served while the sole elevator moves
    // UP toward 9 (wrong direction) -> goes pending instead of being dropped.
    building.handleHallCall(5, 'DOWN');

    const pending = building.getPendingCalls();

    expect(pending).toEqual([{ floor: 5, direction: 'DOWN' }]);
  });
});

describe('Building.getActiveHallCalls (Story 2.3, FR-2)', () => {
  it('press UP, no prior call: activeHallCalls includes it immediately after handleHallCall', () => {
    const building = new Building({ floors: 10, elevatorCount: 3 });

    building.handleHallCall(5, 'UP');

    expect(building.getActiveHallCalls()).toEqual([{ floor: 5, direction: 'UP' }]);
  });

  it('repeat press on an already-active direction: no duplicate entry, order unchanged', () => {
    const building = new Building({ floors: 10, elevatorCount: 3 });
    building.handleHallCall(5, 'UP');

    building.handleHallCall(5, 'UP');

    expect(building.getActiveHallCalls()).toEqual([{ floor: 5, direction: 'UP' }]);
  });

  it('elevator services the call: activeHallCalls drops it once that elevator opens its doors there', () => {
    const building = new Building({ floors: 10, elevatorCount: 3 });
    building.handleHallCall(5, 'UP');
    expect(building.getActiveHallCalls()).toEqual([{ floor: 5, direction: 'UP' }]);

    for (let i = 0; i < 10; i++) {
      building.tick();
      const arrived = building
        .getElevatorSnapshots()
        .some((s) => s.currentFloor === 5 && s.doorState === 'OPEN');
      if (arrived) break;
    }

    expect(building.getActiveHallCalls()).toEqual([]);
  });

  it('opposite direction independence: servicing UP at floor 5 leaves DOWN at floor 5 still active', () => {
    // Sole elevator moving UP from 1 toward 10 is eligible for the UP call at
    // 5 but not the DOWN call at 5 (wrong direction) -- so DOWN goes pending
    // and stays untouched by E1 servicing its own UP assignment at floor 5.
    const building = new Building({ floors: 10, elevatorCount: 1 });
    building.handleHallCall(10, 'UP'); // idle E1 -> MovingUpState toward 10
    expect(building.getElevatorSnapshots()[0]?.direction).toBe('UP');

    building.handleHallCall(5, 'UP'); // eligible (same direction, ahead) -> queued + tagged on E1
    building.handleHallCall(5, 'DOWN'); // ineligible (wrong direction) -> pending, never tagged on E1
    expect(building.getActiveHallCalls()).toEqual(
      expect.arrayContaining([
        { floor: 5, direction: 'UP' },
        { floor: 5, direction: 'DOWN' },
      ]),
    );

    for (let i = 0; i < 4; i++) building.tick(); // 1 -> 5, arrives, doors open (drains UP only)

    expect(building.getElevatorSnapshots()[0]).toMatchObject({ currentFloor: 5, doorState: 'OPEN' });
    expect(building.getActiveHallCalls()).not.toContainEqual({ floor: 5, direction: 'UP' });
    expect(building.getActiveHallCalls()).toContainEqual({ floor: 5, direction: 'DOWN' });
  });

  it('immediate same-floor service: idle elevator already at floor 5, hall call for floor 5 drains synchronously within handleHallCall', () => {
    const building = new Building({ floors: 10, elevatorCount: 1 });
    // E1 starts at floor 1; move it to floor 5 and let it settle Idle there.
    building.handleHallCall(5, 'UP');
    for (let i = 0; i < 10; i++) {
      building.tick();
      if (building.getElevatorSnapshots()[0]?.stateName === 'IDLE') break;
    }
    expect(building.getElevatorSnapshots()[0]).toMatchObject({ currentFloor: 5, stateName: 'IDLE' });
    expect(building.getActiveHallCalls()).toEqual([]);

    building.handleHallCall(5, 'DOWN'); // idle elevator already at floor 5 -> same-floor fast path, synchronous

    expect(building.getElevatorSnapshots()[0]?.doorState).toBe('OPEN');
    expect(building.getActiveHallCalls()).toEqual([]);
  });

  it('piggyback on an already-queued stop: a same-direction Hall Call for a floor already queued via a Car Call still drains on arrival', () => {
    const building = new Building({ floors: 10, elevatorCount: 1 });
    building.handleHallCall(1, 'UP'); // same-floor fast path: E1 opens doors at floor 1 immediately
    expect(building.getElevatorSnapshots()[0]?.doorState).toBe('OPEN');
    building.handleCarCall('E1', 8); // Car Call queues floor 8 while doors are open at 1
    // Let the door-close cycle complete so E1 starts moving toward 8.
    for (let i = 0; i < 5; i++) {
      building.tick();
      if (building.getElevatorSnapshots()[0]?.stateName === 'MOVING_UP') break;
    }
    expect(building.getElevatorSnapshots()[0]?.stopQueue).toContain(8);

    building.handleHallCall(8, 'UP'); // same direction, same elevator already eligible and en route -> insertStop no-ops, but tagged
    expect(building.getActiveHallCalls()).toEqual([{ floor: 8, direction: 'UP' }]);

    for (let i = 0; i < 10; i++) {
      building.tick();
      const arrived = building
        .getElevatorSnapshots()
        .some((s) => s.currentFloor === 8 && s.doorState === 'OPEN');
      if (arrived) break;
    }

    expect(building.getElevatorSnapshots()[0]).toMatchObject({ currentFloor: 8, doorState: 'OPEN' });
    expect(building.getActiveHallCalls()).toEqual([]);
  });

  it('press while doors already open here: tags and drains within the same handleHallCall call', () => {
    const building = new Building({ floors: 10, elevatorCount: 1 });
    building.handleHallCall(1, 'UP'); // same-floor fast path: E1 opens doors at floor 1 immediately (mid-dwell)
    expect(building.getElevatorSnapshots()[0]?.doorState).toBe('OPEN');
    expect(building.getActiveHallCalls()).toEqual([]);

    building.handleHallCall(1, 'DOWN'); // arrives while E1's doors are already OPEN at floor 1

    expect(building.getActiveHallCalls()).toEqual([]);
    expect(building.getElevatorSnapshots()[0]?.doorState).toBe('OPEN');
  });
});

describe('Building.handleCarCall routing (FR-4)', () => {
  it('routes a Car Call to the named elevator, queuing the floor via assignCarCall', () => {
    const building = new Building({ floors: 10, elevatorCount: 3 });
    building.handleHallCall(1, 'UP'); // E1 (idle, at floor 1) opens its doors immediately (same-floor fast path)
    expect(building.getElevatorSnapshots()[0]?.doorState).toBe('OPEN');

    building.handleCarCall('E1', 7);

    expect(building.getElevatorSnapshots()[0]?.stopQueue).toContain(7);
  });

  it('unknown elevatorId is a silent no-op: no elevator state changes, nothing thrown', () => {
    const building = new Building({ floors: 10, elevatorCount: 3 });
    const before = building.getElevatorSnapshots();

    expect(() => building.handleCarCall('GHOST', 3)).not.toThrow();

    expect(building.getElevatorSnapshots()).toEqual(before);
  });
});

describe('Building.handleDoorHold routing (FR-5)', () => {
  it('resets the named elevator dwell timer while its doors are open', () => {
    const building = new Building({ floors: 10, elevatorCount: 1 });
    building.handleHallCall(1, 'UP'); // opens doors immediately, dwell = 3
    building.tick(); // dwell 3 -> 2
    building.tick(); // dwell 2 -> 1
    expect(building.getElevatorSnapshots()[0]?.doorState).toBe('OPEN');

    building.handleDoorHold('E1');

    building.tick(); // dwell reset to 3, now 3 -> 2
    building.tick(); // 2 -> 1
    expect(building.getElevatorSnapshots()[0]?.doorState).toBe('OPEN');
  });

  it('unknown elevatorId is a silent no-op: no elevator state changes, nothing thrown', () => {
    const building = new Building({ floors: 10, elevatorCount: 3 });
    const before = building.getElevatorSnapshots();

    expect(() => building.handleDoorHold('GHOST')).not.toThrow();

    expect(building.getElevatorSnapshots()).toEqual(before);
  });
});

describe('Building.handleDoorClose routing (FR-5)', () => {
  it('forces the named elevator dwell to 0; door begins closing next tick', () => {
    const building = new Building({ floors: 10, elevatorCount: 1 });
    building.handleHallCall(1, 'UP'); // opens doors immediately, dwell = 3
    expect(building.getElevatorSnapshots()[0]?.doorState).toBe('OPEN');

    building.handleDoorClose('E1');
    building.tick(); // dwell already 0 -> door closes this tick

    expect(building.getElevatorSnapshots()[0]?.doorState).toBe('CLOSED');
  });

  it('unknown elevatorId is a silent no-op: no elevator state changes, nothing thrown', () => {
    const building = new Building({ floors: 10, elevatorCount: 3 });
    const before = building.getElevatorSnapshots();

    expect(() => building.handleDoorClose('GHOST')).not.toThrow();

    expect(building.getElevatorSnapshots()).toEqual(before);
  });
});
