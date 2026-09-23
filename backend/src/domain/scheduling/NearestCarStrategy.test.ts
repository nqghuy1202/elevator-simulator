import { describe, expect, it } from 'vitest';
import type { ElevatorSnapshot } from '../Elevator.js';
import { NearestCarStrategy } from './NearestCarStrategy.js';

/** Build a minimal ElevatorSnapshot literal for a test, overriding only what matters. */
function snapshot(overrides: Partial<ElevatorSnapshot> & { id: string; currentFloor: number }): ElevatorSnapshot {
  return {
    direction: 'IDLE',
    doorState: 'CLOSED',
    stopQueue: [],
    stateName: 'IDLE',
    ...overrides,
  };
}

describe('NearestCarStrategy', () => {
  const strategy = new NearestCarStrategy();

  it('selects a single idle elevator', () => {
    const idle = snapshot({ id: 'E1', currentFloor: 3, direction: 'IDLE' });

    const result = strategy.selectElevator([idle], { floor: 7, direction: 'UP' });

    expect(result?.id).toBe('E1');
  });

  it('selects the nearer of two idle elevators at different distances', () => {
    const far = snapshot({ id: 'E1', currentFloor: 2, direction: 'IDLE' });
    const near = snapshot({ id: 'E2', currentFloor: 8, direction: 'IDLE' });

    const result = strategy.selectElevator([far, near], { floor: 7, direction: 'UP' });

    expect(result?.id).toBe('E2');
  });

  it('PRD worked example (accept): moving UP, currentFloor 3, Hall Call floor 5 UP is eligible', () => {
    const elevator = snapshot({ id: 'E1', currentFloor: 3, direction: 'UP' });

    const result = strategy.selectElevator([elevator], { floor: 5, direction: 'UP' });

    expect(result?.id).toBe('E1');
  });

  it('moving same direction but floor already behind: not eligible', () => {
    const elevator = snapshot({ id: 'E1', currentFloor: 6, direction: 'UP' });

    const result = strategy.selectElevator([elevator], { floor: 5, direction: 'UP' });

    expect(result).toBeNull();
  });

  it('PRD worked example (reject): moving UP, currentFloor 3, Hall Call floor 5 DOWN is not eligible', () => {
    const elevator = snapshot({ id: 'E1', currentFloor: 3, direction: 'UP' });

    const result = strategy.selectElevator([elevator], { floor: 5, direction: 'DOWN' });

    expect(result).toBeNull();
  });

  it('mixed pool: nearest wins regardless of idle/moving status', () => {
    const idleFar = snapshot({ id: 'E1', currentFloor: 20, direction: 'IDLE' });
    const movingClose = snapshot({ id: 'E2', currentFloor: 4, direction: 'UP' });

    const result = strategy.selectElevator([idleFar, movingClose], { floor: 5, direction: 'UP' });

    expect(result?.id).toBe('E2');
  });

  it('returns null when no elevator is eligible', () => {
    const oppositeDirection = snapshot({ id: 'E1', currentFloor: 3, direction: 'DOWN' });
    const floorBehind = snapshot({ id: 'E2', currentFloor: 9, direction: 'UP' });

    const result = strategy.selectElevator([oppositeDirection, floorBehind], { floor: 5, direction: 'UP' });

    expect(result).toBeNull();
  });

  it('DOWN eligibility mirrors UP: moving DOWN with floor ahead (below) is eligible', () => {
    const elevator = snapshot({ id: 'E1', currentFloor: 8, direction: 'DOWN' });

    const result = strategy.selectElevator([elevator], { floor: 5, direction: 'DOWN' });

    expect(result?.id).toBe('E1');
  });

  it('tie-break: two eligible elevators equidistant from the floor keeps the first/leftmost candidate', () => {
    const first = snapshot({ id: 'E1', currentFloor: 4, direction: 'IDLE' });
    const second = snapshot({ id: 'E2', currentFloor: 6, direction: 'IDLE' });

    const result = strategy.selectElevator([first, second], { floor: 5, direction: 'UP' });

    expect(result?.id).toBe('E1');
  });

  it('moving elevator at floor === currentFloor is not eligible (floor must be strictly ahead)', () => {
    const elevator = snapshot({ id: 'E1', currentFloor: 5, direction: 'UP' });

    const result = strategy.selectElevator([elevator], { floor: 5, direction: 'UP' });

    expect(result).toBeNull();
  });

  it('two moving eligible elevators at different distances: the nearer one is selected', () => {
    const far = snapshot({ id: 'E1', currentFloor: 1, direction: 'UP' });
    const near = snapshot({ id: 'E2', currentFloor: 4, direction: 'UP' });

    const result = strategy.selectElevator([far, near], { floor: 5, direction: 'UP' });

    expect(result?.id).toBe('E2');
  });
});
