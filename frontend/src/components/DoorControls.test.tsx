import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DoorControls } from './DoorControls.js';

afterEach(() => cleanup());

describe('DoorControls: Hold/Close click-to-emit', () => {
  it('renders a Hold button and a Close button', () => {
    render(<DoorControls elevatorId="E1" isOpen onDoorHold={vi.fn()} onDoorClose={vi.fn()} />);

    expect(screen.getByLabelText('Hold doors')).toBeInTheDocument();
    expect(screen.getByLabelText('Close doors')).toBeInTheDocument();
  });

  it('calls onDoorHold with the elevatorId when Hold is clicked', () => {
    const onDoorHold = vi.fn();
    render(<DoorControls elevatorId="E1" isOpen onDoorHold={onDoorHold} onDoorClose={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Hold doors'));

    expect(onDoorHold).toHaveBeenCalledWith('E1');
  });

  it('calls onDoorClose with the elevatorId when Close is clicked', () => {
    const onDoorClose = vi.fn();
    render(<DoorControls elevatorId="E1" isOpen onDoorHold={vi.fn()} onDoorClose={onDoorClose} />);

    fireEvent.click(screen.getByLabelText('Close doors'));

    expect(onDoorClose).toHaveBeenCalledWith('E1');
  });

  it('wires the correct elevatorId for a different elevator', () => {
    const onDoorHold = vi.fn();
    const onDoorClose = vi.fn();
    render(<DoorControls elevatorId="E2" isOpen onDoorHold={onDoorHold} onDoorClose={onDoorClose} />);

    fireEvent.click(screen.getByLabelText('Hold doors'));
    fireEvent.click(screen.getByLabelText('Close doors'));

    expect(onDoorHold).toHaveBeenCalledWith('E2');
    expect(onDoorClose).toHaveBeenCalledWith('E2');
  });
});

describe('DoorControls: always mounted, toggled via disabled/visibility not display (no header reflow)', () => {
  it('renders both buttons, disabled, when isOpen is false', () => {
    render(<DoorControls elevatorId="E1" isOpen={false} onDoorHold={vi.fn()} onDoorClose={vi.fn()} />);

    expect(screen.getByLabelText('Hold doors')).toBeInTheDocument();
    expect(screen.getByLabelText('Hold doors')).toBeDisabled();
    expect(screen.getByLabelText('Close doors')).toBeInTheDocument();
    expect(screen.getByLabelText('Close doors')).toBeDisabled();
  });

  it('does not emit onDoorHold/onDoorClose when disabled (isOpen false)', () => {
    const onDoorHold = vi.fn();
    const onDoorClose = vi.fn();
    render(<DoorControls elevatorId="E1" isOpen={false} onDoorHold={onDoorHold} onDoorClose={onDoorClose} />);

    fireEvent.click(screen.getByLabelText('Hold doors'));
    fireEvent.click(screen.getByLabelText('Close doors'));

    expect(onDoorHold).not.toHaveBeenCalled();
    expect(onDoorClose).not.toHaveBeenCalled();
  });

  it('buttons become enabled purely by re-rendering isOpen true, with no memory of prior state', () => {
    const { rerender } = render(
      <DoorControls elevatorId="E1" isOpen={false} onDoorHold={vi.fn()} onDoorClose={vi.fn()} />,
    );
    expect(screen.getByLabelText('Hold doors')).toBeDisabled();

    rerender(<DoorControls elevatorId="E1" isOpen onDoorHold={vi.fn()} onDoorClose={vi.fn()} />);

    expect(screen.getByLabelText('Hold doors')).not.toBeDisabled();
  });
});
