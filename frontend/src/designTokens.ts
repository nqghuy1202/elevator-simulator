/**
 * Single source of truth for the shaft/hall-call row height, shared between
 * JS position math (`ElevatorCar`'s cabin `translateY`) and CSS (`App`
 * injects it as the `--row-height` custom property so every row-height
 * consumer derives from this one number instead of two independently
 * maintained values). Bumped from 48 to 58 per the Ascent redesign so the
 * resting-position cue on a floor-cell has enough room to read clearly
 * (memlog decision 2026-09-24).
 */
export const ROW_HEIGHT_PX = 58;
