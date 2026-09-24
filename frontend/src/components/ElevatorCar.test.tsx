import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ElevatorSnapshot } from 'shared/src/index.js';
import { ElevatorCar } from './ElevatorCar.js';

afterEach(() => cleanup());

function makeElevator(overrides: Partial<ElevatorSnapshot> = {}): ElevatorSnapshot {
  return {
    id: 'E1',
    currentFloor: 5,
    direction: 'IDLE',
    doorState: 'CLOSED',
    stopQueue: [],
    stateName: 'IDLE',
    ...overrides,
  };
}

describe('ElevatorCar: renders the elevator summary line', () => {
  it('shows id, floor, direction, and doorState', () => {
    render(
      <ElevatorCar
        elevator={makeElevator({ id: 'E2', currentFloor: 3, direction: 'UP', doorState: 'CLOSED' })}
        floors={10}
        onCarCall={vi.fn()}
      />,
    );

    expect(screen.getByText(/E2: floor 3, UP, doors CLOSED/)).toBeInTheDocument();
  });
});

describe('ElevatorCar: DestinationPanel visibility toggles strictly on doorState (Story 2.4)', () => {
  it('renders no DestinationPanel buttons when doorState is CLOSED', () => {
    render(<ElevatorCar elevator={makeElevator({ doorState: 'CLOSED' })} floors={10} onCarCall={vi.fn()} />);

    expect(screen.queryByLabelText(/Car call floor/)).not.toBeInTheDocument();
  });

  it('renders no DestinationPanel buttons when doorState is OPENING', () => {
    render(<ElevatorCar elevator={makeElevator({ doorState: 'OPENING' })} floors={10} onCarCall={vi.fn()} />);

    expect(screen.queryByLabelText(/Car call floor/)).not.toBeInTheDocument();
  });

  it('renders no DestinationPanel buttons when doorState is CLOSING', () => {
    render(<ElevatorCar elevator={makeElevator({ doorState: 'CLOSING' })} floors={10} onCarCall={vi.fn()} />);

    expect(screen.queryByLabelText(/Car call floor/)).not.toBeInTheDocument();
  });

  it('renders the DestinationPanel when doorState is OPEN', () => {
    render(
      <ElevatorCar
        elevator={makeElevator({ doorState: 'OPEN', currentFloor: 5 })}
        floors={10}
        onCarCall={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Car call floor 8')).toBeInTheDocument();
    expect(screen.queryByLabelText('Car call floor 5')).not.toBeInTheDocument();
  });

  it('panel disappears purely by re-rendering off doorState, with no memory of "was it open"', () => {
    const { rerender } = render(
      <ElevatorCar elevator={makeElevator({ doorState: 'OPEN' })} floors={10} onCarCall={vi.fn()} />,
    );
    expect(screen.getByLabelText('Car call floor 8')).toBeInTheDocument();

    rerender(<ElevatorCar elevator={makeElevator({ doorState: 'CLOSED' })} floors={10} onCarCall={vi.fn()} />);

    expect(screen.queryByLabelText('Car call floor 8')).not.toBeInTheDocument();
  });

  it('wires onCarCall through to the DestinationPanel with the elevator id', () => {
    const onCarCall = vi.fn();
    render(
      <ElevatorCar
        elevator={makeElevator({ id: 'E1', doorState: 'OPEN', currentFloor: 5 })}
        floors={10}
        onCarCall={onCarCall}
      />,
    );

    fireEvent.click(screen.getByLabelText('Car call floor 8'));

    expect(onCarCall).toHaveBeenCalledWith('E1', 8);
  });

  it('already-queued floors from stopQueue render disabled inside the panel', () => {
    render(
      <ElevatorCar
        elevator={makeElevator({ doorState: 'OPEN', currentFloor: 5, stopQueue: [8] })}
        floors={10}
        onCarCall={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Car call floor 8')).toBeDisabled();
  });
});
