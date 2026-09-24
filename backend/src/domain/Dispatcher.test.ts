import { describe, expect, it, vi } from 'vitest';
import { Dispatcher } from './Dispatcher.js';
import { DOOR_DWELL_TICKS, Elevator } from './Elevator.js';
import { NearestCarStrategy } from './scheduling/NearestCarStrategy.js';
import type { SchedulingStrategy } from './scheduling/SchedulingStrategy.js';

/** Ticks an elevator through its full dwell countdown plus the tick that acts on expiry. */
function tickThroughDoorClose(elevator: Elevator): void {
  for (let i = 0; i < DOOR_DWELL_TICKS + 1; i++) elevator.tick();
}

describe('Dispatcher.handleHallCall', () => {
  it('calls strategy.selectElevator exactly once, without inspecting its concrete type', () => {
    const elevator = new Elevator('E1', 1);
    const strategy: SchedulingStrategy = {
      selectElevator: vi.fn().mockReturnValue(elevator.getSnapshot()),
    };
    const dispatcher = new Dispatcher([elevator], strategy);

    dispatcher.handleHallCall(7, 'UP');

    expect(strategy.selectElevator).toHaveBeenCalledTimes(1);
  });

  it('assigns the Hall Call to the eligible/selected elevator via assignHallCall', () => {
    const elevator = new Elevator('E1', 1);
    const dispatcher = new Dispatcher([elevator], new NearestCarStrategy());

    dispatcher.handleHallCall(7, 'UP');

    expect(elevator.getSnapshot().stopQueue).toContain(7);
  });

  it('threads the request direction into assignHallCall (Story 2.3 tagging)', () => {
    const elevator = new Elevator('E1', 1);
    const dispatcher = new Dispatcher([elevator], new NearestCarStrategy());

    dispatcher.handleHallCall(7, 'UP');

    // assignHallCall tagged 'UP' on E1 for floor 7 -- observable once E1 arrives and opens its doors.
    for (let i = 0; i < 6; i++) elevator.tick(); // 1 -> 7
    expect(elevator.getSnapshot().doorState).toBe('OPEN');
    expect(elevator.takeServicedHallCallDirections(7)).toEqual(new Set(['UP']));
  });

  it('picks the nearer of two idle elevators', () => {
    const far = new Elevator('E1', 2);
    const near = new Elevator('E2', 8);
    const dispatcher = new Dispatcher([far, near], new NearestCarStrategy());

    dispatcher.handleHallCall(7, 'UP');

    expect(near.getSnapshot().stopQueue).toContain(7);
    expect(far.getSnapshot().stopQueue).not.toContain(7);
  });

  it('PRD worked example: elevator moving 1->10, currently at floor 3, accepts an UP call at 5', () => {
    const elevator = new Elevator('E1', 1);
    elevator.assignHallCall(10); // Idle -> MovingUpState
    elevator.tick(); // 1 -> 2
    elevator.tick(); // 2 -> 3
    expect(elevator.getSnapshot().currentFloor).toBe(3);
    expect(elevator.getSnapshot().direction).toBe('UP');

    const dispatcher = new Dispatcher([elevator], new NearestCarStrategy());
    dispatcher.handleHallCall(5, 'UP');

    expect(elevator.getSnapshot().stopQueue).toContain(5);
  });

  it('PRD worked example: elevator moving 1->10, currently at floor 3, rejects a DOWN call at 5', () => {
    const elevator = new Elevator('E1', 1);
    elevator.assignHallCall(10); // Idle -> MovingUpState
    elevator.tick(); // 1 -> 2
    elevator.tick(); // 2 -> 3
    expect(elevator.getSnapshot().currentFloor).toBe(3);
    expect(elevator.getSnapshot().direction).toBe('UP');

    const dispatcher = new Dispatcher([elevator], new NearestCarStrategy());
    dispatcher.handleHallCall(5, 'DOWN');

    expect(elevator.getSnapshot().stopQueue).not.toContain(5);
  });

  it('when no elevator is eligible, no stopQueue changes and nothing throws', () => {
    const movingAway = new Elevator('E1', 9);
    movingAway.assignHallCall(1); // Idle -> MovingDownState, heading away from floor 5 UP call
    expect(movingAway.getSnapshot().direction).toBe('DOWN');

    const dispatcher = new Dispatcher([movingAway], new NearestCarStrategy());

    expect(() => dispatcher.handleHallCall(5, 'UP')).not.toThrow();
    expect(movingAway.getSnapshot().stopQueue).toEqual([1]);
  });

  it('throws a clear error if the strategy selects an elevator id with no matching live Elevator', () => {
    const elevator = new Elevator('E1', 1);
    const misbehavingStrategy: SchedulingStrategy = {
      selectElevator: vi.fn().mockReturnValue({
        id: 'UNKNOWN',
        currentFloor: 1,
        direction: 'IDLE',
        doorState: 'CLOSED',
        stopQueue: [],
        stateName: 'IDLE',
      }),
    };
    const dispatcher = new Dispatcher([elevator], misbehavingStrategy);

    expect(() => dispatcher.handleHallCall(7, 'UP')).toThrow(/UNKNOWN/);
  });
});

describe('Dispatcher Pending Call re-evaluation', () => {
  it('stores an unassignable Hall Call as pending instead of dropping it (no eligible elevator at request time)', () => {
    const movingAway = new Elevator('E1', 9);
    movingAway.assignHallCall(1); // Idle -> MovingDownState, heading away from a floor 5 UP call
    expect(movingAway.getSnapshot().direction).toBe('DOWN');

    const dispatcher = new Dispatcher([movingAway], new NearestCarStrategy());
    dispatcher.handleHallCall(5, 'UP');

    expect(dispatcher.getPendingCalls()).toEqual([{ floor: 5, direction: 'UP' }]);
    expect(movingAway.getSnapshot().stopQueue).toEqual([1]);
  });

  it('re-evaluate with still no eligible elevator: call remains pending, not dropped, not duplicated', () => {
    const movingAway = new Elevator('E1', 9);
    movingAway.assignHallCall(1); // Idle -> MovingDownState
    const dispatcher = new Dispatcher([movingAway], new NearestCarStrategy());
    dispatcher.handleHallCall(5, 'UP');

    dispatcher.reevaluatePending();

    expect(dispatcher.getPendingCalls()).toEqual([{ floor: 5, direction: 'UP' }]);
  });

  it('re-evaluate after an elevator becomes eligible: call is assigned and removed from pending', () => {
    const elevator = new Elevator('E1', 9);
    elevator.assignHallCall(1); // Idle -> MovingDownState, heading toward floor 1
    const dispatcher = new Dispatcher([elevator], new NearestCarStrategy());
    dispatcher.handleHallCall(5, 'UP'); // not eligible while moving DOWN
    expect(dispatcher.getPendingCalls()).toHaveLength(1);

    // Ride the elevator down to floor 1: it arrives, dwells, then has no
    // further stops queued and goes Idle -- now eligible for any call.
    elevator.tick(); // 9 -> 8
    elevator.tick(); // 8 -> 7
    elevator.tick(); // 7 -> 6
    elevator.tick(); // 6 -> 5
    elevator.tick(); // 5 -> 4
    elevator.tick(); // 4 -> 3
    elevator.tick(); // 3 -> 2
    elevator.tick(); // 2 -> 1, arrives, door opens
    expect(elevator.getSnapshot().doorState).toBe('OPEN');
    tickThroughDoorClose(elevator); // dwell counts down, then door closes, queue empty -> Idle
    expect(elevator.getSnapshot().stateName).toBe('IDLE');
    expect(elevator.getSnapshot().direction).toBe('IDLE');

    dispatcher.reevaluatePending();

    expect(dispatcher.getPendingCalls()).toEqual([]);
    expect(elevator.getSnapshot().stopQueue).toContain(5);
  });

  it('a Hall Call already pending for the same (floor, direction) is not added a second time', () => {
    const movingAway = new Elevator('E1', 9);
    movingAway.assignHallCall(1); // Idle -> MovingDownState
    const dispatcher = new Dispatcher([movingAway], new NearestCarStrategy());

    dispatcher.handleHallCall(5, 'UP');
    dispatcher.handleHallCall(5, 'UP');

    expect(dispatcher.getPendingCalls()).toEqual([{ floor: 5, direction: 'UP' }]);
  });

  it('multiple pending calls, one elevator becomes eligible for only one of them: first (FIFO) is assigned and removed, second remains pending', () => {
    // Sole elevator: will become Idle and pick up the UP call at floor 3
    // first, which puts it into MovingUpState -- ineligible for a DOWN call.
    const elevator = new Elevator('E1', 9);
    elevator.assignHallCall(1); // Idle -> MovingDownState, heading toward floor 1
    const dispatcher = new Dispatcher([elevator], new NearestCarStrategy());

    // Both calls are ineligible while the elevator moves DOWN from floor 9 toward 1:
    // the UP call is the wrong direction, and the DOWN call at floor 12 is behind
    // (above) the elevator's current position, so it can never be reached going DOWN.
    dispatcher.handleHallCall(3, 'UP');
    dispatcher.handleHallCall(12, 'DOWN');
    expect(dispatcher.getPendingCalls()).toEqual([
      { floor: 3, direction: 'UP' },
      { floor: 12, direction: 'DOWN' },
    ]);

    // Ride down to floor 1: arrives, dwells, queue empties -> Idle (eligible for anything).
    for (let i = 0; i < 8; i++) elevator.tick(); // 9 -> 1, arrives, door opens
    tickThroughDoorClose(elevator); // dwell counts down, then door closes, queue empty -> Idle
    expect(elevator.getSnapshot().stateName).toBe('IDLE');

    dispatcher.reevaluatePending();

    // First pending call (floor 3, UP) is serviced by the now-idle elevator, which
    // becomes MovingUpState heading to 3 -- ineligible for the DOWN call at floor 12
    // (wrong direction), so the second call remains pending.
    expect(dispatcher.getPendingCalls()).toEqual([{ floor: 12, direction: 'DOWN' }]);
    expect(elevator.getSnapshot().stopQueue).toContain(3);
    expect(elevator.getSnapshot().direction).toBe('UP');
  });

  it('assignment within a pass affects a later call in the same pass (both pending calls serviced by a now-idle elevator)', () => {
    const idling = new Elevator('E1', 5);
    idling.assignHallCall(9); // Idle -> MovingUpState, will empty its queue at floor 9 and go Idle
    const dispatcher = new Dispatcher([idling], new NearestCarStrategy());

    // While E1 is busy moving toward 9 (DOWN calls are behind it / wrong
    // direction), two DOWN calls at different floors are both ineligible
    // and go pending.
    dispatcher.handleHallCall(3, 'DOWN');
    dispatcher.handleHallCall(7, 'DOWN');
    expect(dispatcher.getPendingCalls()).toEqual([
      { floor: 3, direction: 'DOWN' },
      { floor: 7, direction: 'DOWN' },
    ]);

    // Ride E1 up to floor 9: arrives, dwells out, queue empty -> Idle.
    for (let i = 0; i < 4; i++) idling.tick(); // 5 -> 9, arrives, door opens
    tickThroughDoorClose(idling); // dwell counts down, then door closes, queue empty -> Idle
    expect(idling.getSnapshot().stateName).toBe('IDLE');

    dispatcher.reevaluatePending();

    // Both calls are serviceable by the same now-idle elevator within a
    // single pass: the first call's assignHallCall (onStopAssigned) moves E1 out
    // of Idle into MovingDownState before the second call is evaluated,
    // and the second call's eligibility reflects that new state (moving
    // DOWN, floor 3 still ahead) rather than a stale Idle snapshot.
    expect(dispatcher.getPendingCalls()).toEqual([]);
    expect(idling.getSnapshot().stopQueue).toEqual(expect.arrayContaining([3, 7]));
  });

  it('reevaluatePending is pull-based: ticking elevators alone never auto-assigns or drops a pending call', () => {
    const elevator = new Elevator('E1', 9);
    elevator.assignHallCall(1); // Idle -> MovingDownState
    const dispatcher = new Dispatcher([elevator], new NearestCarStrategy());
    dispatcher.handleHallCall(5, 'UP');
    expect(dispatcher.getPendingCalls()).toHaveLength(1);

    // Tick the elevator all the way to Idle without ever calling reevaluatePending.
    for (let i = 0; i < 8; i++) elevator.tick(); // 9 -> 1, arrives, door opens
    tickThroughDoorClose(elevator); // dwell counts down, then door closes, queue empty -> Idle
    expect(elevator.getSnapshot().stateName).toBe('IDLE');

    expect(dispatcher.getPendingCalls()).toEqual([{ floor: 5, direction: 'UP' }]);
    expect(elevator.getSnapshot().stopQueue).not.toContain(5);
  });

  it('reevaluatePending with zero pending calls does nothing and does not throw', () => {
    const elevator = new Elevator('E1', 1);
    const dispatcher = new Dispatcher([elevator], new NearestCarStrategy());
    expect(dispatcher.getPendingCalls()).toEqual([]);

    expect(() => dispatcher.reevaluatePending()).not.toThrow();

    expect(dispatcher.getPendingCalls()).toEqual([]);
    expect(elevator.getSnapshot().stopQueue).toEqual([]);
  });

  it('deferred Story 1.3 edge case: idle elevator at floor 5, two opposite-direction pending calls both reach reevaluatePending() in one pass -- first is genuinely assigned, second is re-pended instead of silently dropped', () => {
    // Elevator starts moving toward floor 5 as its own destination (not via
    // Dispatcher), so it is busy/ineligible while both Hall Calls for floor
    // 5 are requested, and ends up idle exactly at floor 5 with doors
    // closed once it arrives, dwells, and the door-close cycle completes.
    const elevator = new Elevator('E1', 1);
    elevator.assignCarCall(5); // Idle -> MovingUpState, heading toward floor 5
    const dispatcher = new Dispatcher([elevator], new NearestCarStrategy());

    dispatcher.handleHallCall(5, 'UP');
    dispatcher.handleHallCall(5, 'DOWN');
    expect(dispatcher.getPendingCalls()).toEqual([
      { floor: 5, direction: 'UP' },
      { floor: 5, direction: 'DOWN' },
    ]);

    // Ride up to floor 5: arrives, dwells, queue empties -> Idle at floor 5.
    for (let i = 0; i < 4; i++) elevator.tick(); // 1 -> 5, arrives, door opens
    tickThroughDoorClose(elevator); // dwell counts down, then door closes, queue empty -> Idle
    expect(elevator.getSnapshot().stateName).toBe('IDLE');
    expect(elevator.getSnapshot().currentFloor).toBe(5);
    expect(elevator.getSnapshot().doorState).toBe('CLOSED');

    dispatcher.reevaluatePending();

    // Both pending calls are re-evaluated in one pass, FIFO. The first
    // (5, UP) finds the idle elevator eligible and assignHallCall(5)
    // genuinely inserts (doors closed) -- serviced immediately by
    // IdleState's same-floor fast path, which leaves doors OPEN. The
    // second (5, DOWN) also finds the elevator eligible (direction reads
    // IDLE going into this pass's snapshot -- taken fresh per call), but
    // its assignHallCall(5) is a same-floor/doors-open no-op by the time
    // it runs, so Dispatcher correctly treats it as unassigned and
    // re-pends it instead of silently dropping it.
    expect(dispatcher.getPendingCalls()).toEqual([{ floor: 5, direction: 'DOWN' }]);
    expect(elevator.getSnapshot().stopQueue).toEqual([]);
    expect(elevator.getSnapshot().stateName).toBe('DOOR_OPEN');
  });
});
