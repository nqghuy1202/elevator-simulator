import { describe, expect, it, vi } from 'vitest';
import { Dispatcher } from './Dispatcher.js';
import { Elevator } from './Elevator.js';
import { NearestCarStrategy } from './scheduling/NearestCarStrategy.js';
import type { SchedulingStrategy } from './scheduling/SchedulingStrategy.js';

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

  it('assigns the Hall Call to the eligible/selected elevator via addStop', () => {
    const elevator = new Elevator('E1', 1);
    const dispatcher = new Dispatcher([elevator], new NearestCarStrategy());

    dispatcher.handleHallCall(7, 'UP');

    expect(elevator.getSnapshot().stopQueue).toContain(7);
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
    elevator.addStop(10); // Idle -> MovingUpState
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
    elevator.addStop(10); // Idle -> MovingUpState
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
    movingAway.addStop(1); // Idle -> MovingDownState, heading away from floor 5 UP call
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
    movingAway.addStop(1); // Idle -> MovingDownState, heading away from a floor 5 UP call
    expect(movingAway.getSnapshot().direction).toBe('DOWN');

    const dispatcher = new Dispatcher([movingAway], new NearestCarStrategy());
    dispatcher.handleHallCall(5, 'UP');

    expect(dispatcher.getPendingCalls()).toEqual([{ floor: 5, direction: 'UP' }]);
    expect(movingAway.getSnapshot().stopQueue).toEqual([1]);
  });

  it('re-evaluate with still no eligible elevator: call remains pending, not dropped, not duplicated', () => {
    const movingAway = new Elevator('E1', 9);
    movingAway.addStop(1); // Idle -> MovingDownState
    const dispatcher = new Dispatcher([movingAway], new NearestCarStrategy());
    dispatcher.handleHallCall(5, 'UP');

    dispatcher.reevaluatePending();

    expect(dispatcher.getPendingCalls()).toEqual([{ floor: 5, direction: 'UP' }]);
  });

  it('re-evaluate after an elevator becomes eligible: call is assigned and removed from pending', () => {
    const elevator = new Elevator('E1', 9);
    elevator.addStop(1); // Idle -> MovingDownState, heading toward floor 1
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
    elevator.tick(); // dwell 1 (3 -> 2 remaining)
    elevator.tick(); // dwell 2 (2 -> 1 remaining)
    elevator.tick(); // dwell 3 (1 -> 0 remaining)
    elevator.tick(); // remaining is 0 -> door closes, queue empty -> Idle
    expect(elevator.getSnapshot().stateName).toBe('IDLE');
    expect(elevator.getSnapshot().direction).toBe('IDLE');

    dispatcher.reevaluatePending();

    expect(dispatcher.getPendingCalls()).toEqual([]);
    expect(elevator.getSnapshot().stopQueue).toContain(5);
  });

  it('a Hall Call already pending for the same (floor, direction) is not added a second time', () => {
    const movingAway = new Elevator('E1', 9);
    movingAway.addStop(1); // Idle -> MovingDownState
    const dispatcher = new Dispatcher([movingAway], new NearestCarStrategy());

    dispatcher.handleHallCall(5, 'UP');
    dispatcher.handleHallCall(5, 'UP');

    expect(dispatcher.getPendingCalls()).toEqual([{ floor: 5, direction: 'UP' }]);
  });

  it('multiple pending calls, one elevator becomes eligible for only one of them: first (FIFO) is assigned and removed, second remains pending', () => {
    // Sole elevator: will become Idle and pick up the UP call at floor 3
    // first, which puts it into MovingUpState -- ineligible for a DOWN call.
    const elevator = new Elevator('E1', 9);
    elevator.addStop(1); // Idle -> MovingDownState, heading toward floor 1
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
    for (let i = 0; i < 4; i++) elevator.tick(); // dwell (3 ticks) + 1 more -> door closes, queue empty -> Idle
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
    idling.addStop(9); // Idle -> MovingUpState, will empty its queue at floor 9 and go Idle
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
    for (let i = 0; i < 4; i++) idling.tick(); // dwell (3 ticks) + 1 more -> door closes, queue empty -> Idle
    expect(idling.getSnapshot().stateName).toBe('IDLE');

    dispatcher.reevaluatePending();

    // Both calls are serviceable by the same now-idle elevator within a
    // single pass: the first call's addStop (onHallAssigned) moves E1 out
    // of Idle into MovingDownState before the second call is evaluated,
    // and the second call's eligibility reflects that new state (moving
    // DOWN, floor 3 still ahead) rather than a stale Idle snapshot.
    expect(dispatcher.getPendingCalls()).toEqual([]);
    expect(idling.getSnapshot().stopQueue).toEqual(expect.arrayContaining([3, 7]));
  });

  it('reevaluatePending is pull-based: ticking elevators alone never auto-assigns or drops a pending call', () => {
    const elevator = new Elevator('E1', 9);
    elevator.addStop(1); // Idle -> MovingDownState
    const dispatcher = new Dispatcher([elevator], new NearestCarStrategy());
    dispatcher.handleHallCall(5, 'UP');
    expect(dispatcher.getPendingCalls()).toHaveLength(1);

    // Tick the elevator all the way to Idle without ever calling reevaluatePending.
    for (let i = 0; i < 8; i++) elevator.tick(); // 9 -> 1, arrives, door opens
    for (let i = 0; i < 4; i++) elevator.tick(); // dwell (3 ticks) + 1 more -> door closes, queue empty -> Idle
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
});
