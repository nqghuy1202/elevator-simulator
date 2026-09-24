import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { PendingHallCall } from 'shared/src/index.js';
import { FloorHallPanel } from './FloorHallPanel.js';

afterEach(() => cleanup());

describe('FloorHallPanel: FR-1 button visibility', () => {
  it('hides the UP button at the top floor', () => {
    render(<FloorHallPanel floor={10} floors={10} activeHallCalls={[]} onHallCall={vi.fn()} />);

    expect(screen.queryByLabelText('Hall call up floor 10')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Hall call down floor 10')).toBeInTheDocument();
  });

  it('hides the DOWN button at floor 1', () => {
    render(<FloorHallPanel floor={1} floors={10} activeHallCalls={[]} onHallCall={vi.fn()} />);

    expect(screen.queryByLabelText('Hall call down floor 1')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Hall call up floor 1')).toBeInTheDocument();
  });

  it('shows both UP and DOWN on a middle floor', () => {
    render(<FloorHallPanel floor={5} floors={10} activeHallCalls={[]} onHallCall={vi.fn()} />);

    expect(screen.getByLabelText('Hall call up floor 5')).toBeInTheDocument();
    expect(screen.getByLabelText('Hall call down floor 5')).toBeInTheDocument();
  });
});

describe('FloorHallPanel: press emits hallCall', () => {
  it('pressing UP calls onHallCall(floor, "UP")', () => {
    const onHallCall = vi.fn();
    render(<FloorHallPanel floor={5} floors={10} activeHallCalls={[]} onHallCall={onHallCall} />);

    fireEvent.click(screen.getByLabelText('Hall call up floor 5'));

    expect(onHallCall).toHaveBeenCalledWith(5, 'UP');
  });

  it('repeat press on an already-active direction still re-emits hallCall', () => {
    const onHallCall = vi.fn();
    const activeHallCalls: PendingHallCall[] = [{ floor: 5, direction: 'UP' }];
    render(<FloorHallPanel floor={5} floors={10} activeHallCalls={activeHallCalls} onHallCall={onHallCall} />);

    fireEvent.click(screen.getByLabelText('Hall call up floor 5'));

    expect(onHallCall).toHaveBeenCalledTimes(1);
    expect(onHallCall).toHaveBeenCalledWith(5, 'UP');
  });
});

describe('FloorHallPanel: indicator driven strictly from activeHallCalls (AD-1)', () => {
  it('lights the UP indicator when {floor, UP} is in activeHallCalls', () => {
    const activeHallCalls: PendingHallCall[] = [{ floor: 5, direction: 'UP' }];
    render(<FloorHallPanel floor={5} floors={10} activeHallCalls={activeHallCalls} onHallCall={vi.fn()} />);

    expect(screen.getByLabelText('Hall call up floor 5')).toHaveTextContent('pending');
  });

  it('opposite direction independence: UP active does not light the DOWN indicator on the same floor', () => {
    const activeHallCalls: PendingHallCall[] = [{ floor: 5, direction: 'UP' }];
    render(<FloorHallPanel floor={5} floors={10} activeHallCalls={activeHallCalls} onHallCall={vi.fn()} />);

    expect(screen.getByLabelText('Hall call down floor 5')).not.toHaveTextContent('pending');
  });

  it('neither indicator lights when activeHallCalls is empty', () => {
    render(<FloorHallPanel floor={5} floors={10} activeHallCalls={[]} onHallCall={vi.fn()} />);

    expect(screen.getByLabelText('Hall call up floor 5')).not.toHaveTextContent('pending');
    expect(screen.getByLabelText('Hall call down floor 5')).not.toHaveTextContent('pending');
  });

  it('indicator clears once the floor/direction is no longer in activeHallCalls (re-render simulating a fresh Snapshot)', () => {
    const { rerender } = render(
      <FloorHallPanel floor={5} floors={10} activeHallCalls={[{ floor: 5, direction: 'UP' }]} onHallCall={vi.fn()} />,
    );
    expect(screen.getByLabelText('Hall call up floor 5')).toHaveTextContent('pending');

    rerender(<FloorHallPanel floor={5} floors={10} activeHallCalls={[]} onHallCall={vi.fn()} />);

    expect(screen.getByLabelText('Hall call up floor 5')).not.toHaveTextContent('pending');
  });
});
