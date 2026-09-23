import type { ElevatorSnapshot } from '../Elevator.js';
import type { HallCallRequest, SchedulingStrategy } from './SchedulingStrategy.js';

/**
 * SCAN/LOOK Nearest-Car strategy: an elevator is eligible for a Hall Call
 * when it is idle, or already moving toward the call's floor in the call's
 * requested direction. Among eligible elevators, the nearest (by absolute
 * floor distance) is selected.
 */
export class NearestCarStrategy implements SchedulingStrategy {
  selectElevator(elevators: ElevatorSnapshot[], request: HallCallRequest): ElevatorSnapshot | null {
    const eligible = elevators.filter((elevator) => this.isEligible(elevator, request));

    if (eligible.length === 0) {
      return null;
    }

    return eligible.reduce((nearest, candidate) =>
      this.distance(candidate, request) < this.distance(nearest, request) ? candidate : nearest,
    );
  }

  private isEligible(elevator: ElevatorSnapshot, request: HallCallRequest): boolean {
    if (elevator.direction === 'IDLE') {
      return true;
    }

    if (elevator.direction !== request.direction) {
      return false;
    }

    return request.direction === 'UP'
      ? request.floor > elevator.currentFloor
      : request.floor < elevator.currentFloor;
  }

  private distance(elevator: ElevatorSnapshot, request: HallCallRequest): number {
    return Math.abs(elevator.currentFloor - request.floor);
  }
}
