import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DoorControls } from './DoorControls.js';

afterEach(() => cleanup());

describe('DoorControls: Hold/Close click-to-emit', () => {
  it('renders a Hold button and a Close button', () => {
    render(<DoorControls elevatorId="E1" onDoorHold={vi.fn()} onDoorClose={vi.fn()} />);

    expect(screen.getByLabelText('Hold doors')).toBeInTheDocument();
    expect(screen.getByLabelText('Close doors')).toBeInTheDocument();
  });

  it('calls onDoorHold with the elevatorId when Hold is clicked', () => {
    const onDoorHold = vi.fn();
    render(<DoorControls elevatorId="E1" onDoorHold={onDoorHold} onDoorClose={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Hold doors'));

    expect(onDoorHold).toHaveBeenCalledWith('E1');
  });

  it('calls onDoorClose with the elevatorId when Close is clicked', () => {
    const onDoorClose = vi.fn();
    render(<DoorControls elevatorId="E1" onDoorHold={vi.fn()} onDoorClose={onDoorClose} />);

    fireEvent.click(screen.getByLabelText('Close doors'));

    expect(onDoorClose).toHaveBeenCalledWith('E1');
  });

  it('wires the correct elevatorId for a different elevator', () => {
    const onDoorHold = vi.fn();
    const onDoorClose = vi.fn();
    render(<DoorControls elevatorId="E2" onDoorHold={onDoorHold} onDoorClose={onDoorClose} />);

    fireEvent.click(screen.getByLabelText('Hold doors'));
    fireEvent.click(screen.getByLabelText('Close doors'));

    expect(onDoorHold).toHaveBeenCalledWith('E2');
    expect(onDoorClose).toHaveBeenCalledWith('E2');
  });
});
