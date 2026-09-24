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
        onDoorHold={vi.fn()}
        onDoorClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/E2: floor 3, UP, doors CLOSED/)).toBeInTheDocument();
  });
});

describe('ElevatorCar: DestinationPanel visibility toggles strictly on doorState (Story 2.4)', () => {
  it('renders no DestinationPanel buttons when doorState is CLOSED', () => {
    render(
      <ElevatorCar
        elevator={makeElevator({ doorState: 'CLOSED' })}
        floors={10}
        onCarCall={vi.fn()}
        onDoorHold={vi.fn()}
        onDoorClose={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText(/Car call floor/)).not.toBeInTheDocument();
  });

  it('renders no DestinationPanel buttons when doorState is OPENING', () => {
    render(
      <ElevatorCar
        elevator={makeElevator({ doorState: 'OPENING' })}
        floors={10}
        onCarCall={vi.fn()}
        onDoorHold={vi.fn()}
        onDoorClose={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText(/Car call floor/)).not.toBeInTheDocument();
  });

  it('renders no DestinationPanel buttons when doorState is CLOSING', () => {
    render(
      <ElevatorCar
        elevator={makeElevator({ doorState: 'CLOSING' })}
        floors={10}
        onCarCall={vi.fn()}
        onDoorHold={vi.fn()}
        onDoorClose={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText(/Car call floor/)).not.toBeInTheDocument();
  });

  it('renders the DestinationPanel when doorState is OPEN, with the current floor lit/disabled not omitted', () => {
    render(
      <ElevatorCar
        elevator={makeElevator({ doorState: 'OPEN', currentFloor: 5 })}
        floors={10}
        onCarCall={vi.fn()}
        onDoorHold={vi.fn()}
        onDoorClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Car call floor 8')).toBeInTheDocument();
    expect(screen.getByLabelText('Car call floor 5')).toBeInTheDocument();
    expect(screen.getByLabelText('Car call floor 5')).toBeDisabled();
  });

  it('panel disappears purely by re-rendering off doorState, with no memory of "was it open"', () => {
    const { rerender } = render(
      <ElevatorCar
        elevator={makeElevator({ doorState: 'OPEN' })}
        floors={10}
        onCarCall={vi.fn()}
        onDoorHold={vi.fn()}
        onDoorClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Car call floor 8')).toBeInTheDocument();

    rerender(
      <ElevatorCar
        elevator={makeElevator({ doorState: 'CLOSED' })}
        floors={10}
        onCarCall={vi.fn()}
        onDoorHold={vi.fn()}
        onDoorClose={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Car call floor 8')).not.toBeInTheDocument();
  });

  it('wires onCarCall through to the DestinationPanel with the elevator id', () => {
    const onCarCall = vi.fn();
    render(
      <ElevatorCar
        elevator={makeElevator({ id: 'E1', doorState: 'OPEN', currentFloor: 5 })}
        floors={10}
        onCarCall={onCarCall}
        onDoorHold={vi.fn()}
        onDoorClose={vi.fn()}
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
        onDoorHold={vi.fn()}
        onDoorClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Car call floor 8')).toBeDisabled();
  });
});

describe('ElevatorCar: DoorControls visibility toggles strictly on doorState (Story 2.5)', () => {
  it('renders DoorControls disabled when doorState is CLOSED (always mounted in col-head, never display-toggled)', () => {
    render(
      <ElevatorCar
        elevator={makeElevator({ doorState: 'CLOSED' })}
        floors={10}
        onCarCall={vi.fn()}
        onDoorHold={vi.fn()}
        onDoorClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Hold doors')).toBeDisabled();
    expect(screen.getByLabelText('Close doors')).toBeDisabled();
  });

  it('renders DoorControls disabled when doorState is OPENING', () => {
    render(
      <ElevatorCar
        elevator={makeElevator({ doorState: 'OPENING' })}
        floors={10}
        onCarCall={vi.fn()}
        onDoorHold={vi.fn()}
        onDoorClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Hold doors')).toBeDisabled();
    expect(screen.getByLabelText('Close doors')).toBeDisabled();
  });

  it('renders DoorControls disabled when doorState is CLOSING', () => {
    render(
      <ElevatorCar
        elevator={makeElevator({ doorState: 'CLOSING' })}
        floors={10}
        onCarCall={vi.fn()}
        onDoorHold={vi.fn()}
        onDoorClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Hold doors')).toBeDisabled();
    expect(screen.getByLabelText('Close doors')).toBeDisabled();
  });

  it('renders the DoorControls enabled when doorState is OPEN', () => {
    render(
      <ElevatorCar
        elevator={makeElevator({ doorState: 'OPEN' })}
        floors={10}
        onCarCall={vi.fn()}
        onDoorHold={vi.fn()}
        onDoorClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Hold doors')).toBeInTheDocument();
    expect(screen.getByLabelText('Hold doors')).not.toBeDisabled();
    expect(screen.getByLabelText('Close doors')).not.toBeDisabled();
  });

  it('controls become disabled purely by re-rendering off doorState, with no memory of "was it open"', () => {
    const { rerender } = render(
      <ElevatorCar
        elevator={makeElevator({ doorState: 'OPEN' })}
        floors={10}
        onCarCall={vi.fn()}
        onDoorHold={vi.fn()}
        onDoorClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Hold doors')).not.toBeDisabled();

    rerender(
      <ElevatorCar
        elevator={makeElevator({ doorState: 'CLOSED' })}
        floors={10}
        onCarCall={vi.fn()}
        onDoorHold={vi.fn()}
        onDoorClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Hold doors')).toBeDisabled();
  });

  it('wires onDoorHold and onDoorClose through to DoorControls with the elevator id', () => {
    const onDoorHold = vi.fn();
    const onDoorClose = vi.fn();
    render(
      <ElevatorCar
        elevator={makeElevator({ id: 'E1', doorState: 'OPEN' })}
        floors={10}
        onCarCall={vi.fn()}
        onDoorHold={onDoorHold}
        onDoorClose={onDoorClose}
      />,
    );

    fireEvent.click(screen.getByLabelText('Hold doors'));
    fireEvent.click(screen.getByLabelText('Close doors'));

    expect(onDoorHold).toHaveBeenCalledWith('E1');
    expect(onDoorClose).toHaveBeenCalledWith('E1');
  });

  it('independent per elevator: only the OPEN elevator has enabled DoorControls', () => {
    const { rerender } = render(
      <ElevatorCar
        elevator={makeElevator({ id: 'E1', doorState: 'OPEN' })}
        floors={10}
        onCarCall={vi.fn()}
        onDoorHold={vi.fn()}
        onDoorClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Hold doors')).not.toBeDisabled();

    rerender(
      <ElevatorCar
        elevator={makeElevator({ id: 'E2', doorState: 'CLOSED' })}
        floors={10}
        onCarCall={vi.fn()}
        onDoorHold={vi.fn()}
        onDoorClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Hold doors')).toBeDisabled();
  });
});
