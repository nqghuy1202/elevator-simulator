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
