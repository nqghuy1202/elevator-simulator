import type { Direction } from '../Direction.js';
import { MovingState } from './MovingState.js';

/** Elevator is moving upward one floor per tick. */
export class MovingUpState extends MovingState {
  override readonly name = 'MOVING_UP';
  protected override readonly direction: Direction = 'UP';
  protected override readonly floorDelta = 1 as const;
}
