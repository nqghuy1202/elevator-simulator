/**
 * Single source of truth for the shaft/hall-call row height, shared between
 * JS position math (`ElevatorCar`'s cabin `translateY`) and CSS (`App`
 * injects it as the `--row-height` custom property so every row-height
 * consumer derives from this one number instead of two independently
 * maintained values).
 */
export const ROW_HEIGHT_PX = 48;
