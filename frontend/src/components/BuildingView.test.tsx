import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { BuildingSnapshot } from 'shared/src/index.js';
import { BuildingView } from './BuildingView.js';

afterEach(() => cleanup());

function makeSnapshot(overrides: Partial<BuildingSnapshot> = {}): BuildingSnapshot {
  return {
    tick: 1,
    floors: 10,
    elevators: [],
    pendingHallCalls: [],
    activeHallCalls: [],
    ...overrides,
  };
}

describe('BuildingView: renders one FloorHallPanel per floor 1..snapshot.floors', () => {
  it('renders all floor labels for a 10-floor snapshot', () => {
    render(<BuildingView snapshot={makeSnapshot({ floors: 10 })} onHallCall={vi.fn()} />);

    for (let floor = 1; floor <= 10; floor++) {
      expect(screen.getByText(`Floor ${floor}`)).toBeInTheDocument();
    }
  });

  it('respects FR-1 at the boundary floors: no UP button at floor 10, no DOWN button at floor 1', () => {
    render(<BuildingView snapshot={makeSnapshot({ floors: 10 })} onHallCall={vi.fn()} />);

    expect(screen.queryByLabelText('Hall call up floor 10')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Hall call down floor 10')).toBeInTheDocument();
    expect(screen.queryByLabelText('Hall call down floor 1')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Hall call up floor 1')).toBeInTheDocument();
  });
});

describe('BuildingView: wires snapshot.activeHallCalls and onHallCall straight through', () => {
  it('lights the indicator for a floor/direction present in activeHallCalls', () => {
    const snapshot = makeSnapshot({ activeHallCalls: [{ floor: 5, direction: 'UP' }] });
    render(<BuildingView snapshot={snapshot} onHallCall={vi.fn()} />);

    expect(screen.getByLabelText('Hall call up floor 5')).toHaveTextContent('pending');
    expect(screen.getByLabelText('Hall call down floor 5')).not.toHaveTextContent('pending');
  });

  it('pressing a button on a given floor calls onHallCall with that floor and direction', () => {
    const onHallCall = vi.fn();
    render(<BuildingView snapshot={makeSnapshot()} onHallCall={onHallCall} />);

    fireEvent.click(screen.getByLabelText('Hall call down floor 7'));

    expect(onHallCall).toHaveBeenCalledWith(7, 'DOWN');
  });
});
