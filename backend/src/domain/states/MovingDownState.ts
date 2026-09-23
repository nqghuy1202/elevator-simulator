import type { Direction } from '../Direction.js';
import { MovingState } from './MovingState.js';

/** Elevator is moving downward one floor per tick. */
export class MovingDownState extends MovingState {
  override readonly name = 'MOVING_DOWN';
  protected override readonly direction: Direction = 'DOWN';
  protected override readonly floorDelta = -1 as const;
}
