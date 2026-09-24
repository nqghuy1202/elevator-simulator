import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DestinationPanel } from './DestinationPanel.js';

afterEach(() => cleanup());

describe('DestinationPanel: FR-3 floor offering', () => {
  it('offers every floor 1..floors except currentFloor', () => {
    render(
      <DestinationPanel
        elevatorId="E1"
        currentFloor={5}
        floors={10}
        stopQueue={[]}
        onCarCall={vi.fn()}
      />,
    );

    for (let floor = 1; floor <= 10; floor++) {
      if (floor === 5) continue;
      expect(screen.getByLabelText(`Car call floor ${floor}`)).toBeInTheDocument();
    }
  });

  it('excludes the elevator current floor from the offered buttons', () => {
    render(
      <DestinationPanel
        elevatorId="E1"
        currentFloor={5}
        floors={10}
        stopQueue={[]}
        onCarCall={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Car call floor 5')).not.toBeInTheDocument();
  });
});

describe('DestinationPanel: click emits carCall', () => {
  it('selecting a floor calls onCarCall(elevatorId, floor)', () => {
    const onCarCall = vi.fn();
    render(
      <DestinationPanel
        elevatorId="E1"
        currentFloor={5}
        floors={10}
        stopQueue={[]}
        onCarCall={onCarCall}
      />,
    );

    fireEvent.click(screen.getByLabelText('Car call floor 8'));

    expect(onCarCall).toHaveBeenCalledWith('E1', 8);
  });

  it('multiple selections in one visit each emit independently', () => {
    const onCarCall = vi.fn();
    render(
      <DestinationPanel
        elevatorId="E1"
        currentFloor={5}
        floors={10}
        stopQueue={[]}
        onCarCall={onCarCall}
      />,
    );

    fireEvent.click(screen.getByLabelText('Car call floor 3'));
    fireEvent.click(screen.getByLabelText('Car call floor 8'));

    expect(onCarCall).toHaveBeenCalledTimes(2);
    expect(onCarCall).toHaveBeenNthCalledWith(1, 'E1', 3);
    expect(onCarCall).toHaveBeenNthCalledWith(2, 'E1', 8);
  });
});

describe('DestinationPanel: already-queued floor renders disabled, not a fresh selection (AD-1)', () => {
  it('a floor present in stopQueue renders disabled', () => {
    render(
      <DestinationPanel
        elevatorId="E1"
        currentFloor={5}
        floors={10}
        stopQueue={[8]}
        onCarCall={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Car call floor 8')).toBeDisabled();
  });

  it('clicking a disabled already-queued floor does not emit onCarCall', () => {
    const onCarCall = vi.fn();
    render(
      <DestinationPanel
        elevatorId="E1"
        currentFloor={5}
        floors={10}
        stopQueue={[8]}
        onCarCall={onCarCall}
      />,
    );

    fireEvent.click(screen.getByLabelText('Car call floor 8'));

    expect(onCarCall).not.toHaveBeenCalled();
  });

  it('a floor not in stopQueue remains enabled', () => {
    render(
      <DestinationPanel
        elevatorId="E1"
        currentFloor={5}
        floors={10}
        stopQueue={[8]}
        onCarCall={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Car call floor 3')).not.toBeDisabled();
  });
});
