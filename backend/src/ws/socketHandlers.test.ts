import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { Server, type Socket } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { Building } from '../domain/Building.js';
import { broadcastBuildingState, buildSnapshot, registerSocketHandlers } from './socketHandlers.js';

/**
 * Minimal fake of the Socket.IO `Socket` surface `registerSocketHandlers`
 * actually uses (`on`/`emit`), per this story's "test suite's direct
 * handler invocation" acceptance path — no real network transport needed
 * to exercise the adapter's routing logic.
 */
function createFakeSocket() {
  const handlers = new Map<string, (payload: unknown) => void>();
  const emitted: Array<{ event: string; payload: unknown }> = [];

  const socket = {
    on: (event: string, handler: (payload: unknown) => void) => {
      handlers.set(event, handler);
      return socket;
    },
    emit: (event: string, payload: unknown) => {
      emitted.push({ event, payload });
      return true;
    },
  } as unknown as Socket;

  return {
    socket,
    emitted,
    trigger: (event: string, payload: unknown) => handlers.get(event)?.(payload),
  };
}

function createFakeIoServer() {
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const io = {
    emit: (event: string, payload: unknown) => {
      emitted.push({ event, payload });
      return true;
    },
  } as unknown as Server;
  return { io, emitted };
}

describe('registerSocketHandlers: connect emits an immediate full snapshot', () => {
  it('emits buildingState to the connecting client without waiting for a tick', () => {
    const building = new Building({ floors: 10, elevatorCount: 3 });
    const { socket, emitted } = createFakeSocket();

    registerSocketHandlers(socket, building, () => 0);

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.event).toBe('buildingState');
    const snapshot = emitted[0]?.payload as ReturnType<typeof buildSnapshot>;
    expect(snapshot.tick).toBe(0);
    expect(snapshot.floors).toBe(10);
    expect(snapshot.elevators).toHaveLength(3);
    expect(snapshot.pendingHallCalls).toEqual([]);
  });
});

describe('registerSocketHandlers: hallCall', () => {
  it('hallCall {floor:5, direction:"UP"} runs Building.handleHallCall(5,"UP")', () => {
    const building = new Building({ floors: 10, elevatorCount: 3 });
    const { socket, trigger } = createFakeSocket();
    registerSocketHandlers(socket, building, () => 0);

    trigger('hallCall', { floor: 5, direction: 'UP' });

    const assigned = building
      .getElevatorSnapshots()
      .find((s) => s.stopQueue.includes(5) || s.currentFloor === 5);
    expect(assigned).toBeDefined();
  });
});

describe('registerSocketHandlers: carCall', () => {
  it('carCall {elevatorId:"E1", floor:7} runs assignCarCall(7) on E1 while its doors are open', () => {
    const building = new Building({ floors: 10, elevatorCount: 1 });
    building.handleHallCall(1, 'UP'); // same-floor fast path: E1 opens its doors at floor 1 immediately
    expect(building.getElevatorSnapshots()[0]?.doorState).toBe('OPEN');

    const { socket, trigger } = createFakeSocket();
    registerSocketHandlers(socket, building, () => 0);

    trigger('carCall', { elevatorId: 'E1', floor: 7 });

    expect(building.getElevatorSnapshots()[0]?.stopQueue).toContain(7);
  });
});

describe('registerSocketHandlers: doorHold', () => {
  it('doorHold {elevatorId:"E1"} resets the dwell timer while E1 is in DoorOpenState', () => {
    const building = new Building({ floors: 10, elevatorCount: 1 });
    building.handleHallCall(1, 'UP'); // opens doors immediately, dwell = 3
    building.tick(); // dwell 3 -> 2
    building.tick(); // dwell 2 -> 1
    expect(building.getElevatorSnapshots()[0]?.doorState).toBe('OPEN');

    const { socket, trigger } = createFakeSocket();
    registerSocketHandlers(socket, building, () => 0);
    trigger('doorHold', { elevatorId: 'E1' });

    // Dwell was reset to 3: two more ticks (3 -> 2 -> 1) still leave doors open.
    building.tick();
    building.tick();
    expect(building.getElevatorSnapshots()[0]?.doorState).toBe('OPEN');
  });
});

describe('registerSocketHandlers: doorClose', () => {
  it('doorClose {elevatorId:"E1"} forces dwell to 0; door begins closing next tick', () => {
    const building = new Building({ floors: 10, elevatorCount: 1 });
    building.handleHallCall(1, 'UP'); // opens doors immediately, dwell = 3
    expect(building.getElevatorSnapshots()[0]?.doorState).toBe('OPEN');

    const { socket, trigger } = createFakeSocket();
    registerSocketHandlers(socket, building, () => 0);
    trigger('doorClose', { elevatorId: 'E1' });

    building.tick(); // dwell already 0 -> DoorOpenState closes the door this tick
    expect(building.getElevatorSnapshots()[0]?.doorState).toBe('CLOSED');
  });
});

describe('registerSocketHandlers: unknown elevatorId is a silent no-op', () => {
  it('carCall/doorHold/doorClose with elevatorId "GHOST" changes no elevator state and throws/emits nothing', () => {
    const building = new Building({ floors: 10, elevatorCount: 3 });
    const before = building.getElevatorSnapshots();

    const { socket, trigger, emitted } = createFakeSocket();
    registerSocketHandlers(socket, building, () => 0);
    const emittedBeforeTriggers = emitted.length;

    expect(() => trigger('carCall', { elevatorId: 'GHOST', floor: 3 })).not.toThrow();
    expect(() => trigger('doorHold', { elevatorId: 'GHOST' })).not.toThrow();
    expect(() => trigger('doorClose', { elevatorId: 'GHOST' })).not.toThrow();

    expect(building.getElevatorSnapshots()).toEqual(before);
    // No extra emit (e.g. an error envelope) was sent back to the client.
    expect(emitted).toHaveLength(emittedBeforeTriggers);
  });
});

describe('broadcastBuildingState', () => {
  it('emits a buildingState snapshot with a strictly-incremented tick to all connected clients', () => {
    const building = new Building({ floors: 10, elevatorCount: 3 });
    const { io, emitted } = createFakeIoServer();

    building.tick();
    broadcastBuildingState(io, building, 1);
    building.tick();
    broadcastBuildingState(io, building, 2);

    expect(emitted).toHaveLength(2);
    expect(emitted[0]?.event).toBe('buildingState');
    expect((emitted[0]?.payload as ReturnType<typeof buildSnapshot>).tick).toBe(1);
    expect((emitted[1]?.payload as ReturnType<typeof buildSnapshot>).tick).toBe(2);
  });
});

describe('buildSnapshot', () => {
  it('assembles floors, elevators, pendingHallCalls, and the given tick from Building state', () => {
    const building = new Building({ floors: 10, elevatorCount: 1 });
    building.handleHallCall(9, 'UP'); // sole elevator takes this, heading UP
    building.handleHallCall(5, 'DOWN'); // wrong-direction -> pending

    const snapshot = buildSnapshot(building, 7);

    expect(snapshot.tick).toBe(7);
    expect(snapshot.floors).toBe(10);
    expect(snapshot.elevators).toHaveLength(1);
    expect(snapshot.pendingHallCalls).toEqual([{ floor: 5, direction: 'DOWN' }]);
  });
});

/**
 * Real network integration coverage: an actual `http.Server` + Socket.IO
 * `Server` on an ephemeral port, with `registerSocketHandlers` wired via
 * `io.on('connection', ...)` against a real `Building`, and a real
 * `socket.io-client` connecting over the loopback interface. The fake-socket
 * tests above cover handler routing logic in isolation; this suite instead
 * verifies the actual wire transport (serialization, connect timing,
 * broadcast delivery) works end-to-end.
 */
describe('socketHandlers: real Socket.IO server + client integration', () => {
  let httpServer: ReturnType<typeof createServer> | undefined;
  let ioServer: Server | undefined;
  let client: ClientSocket | undefined;

  afterEach(async () => {
    client?.close();
    client = undefined;
    if (ioServer) {
      await new Promise<void>((resolve) => ioServer?.close(() => resolve()));
      ioServer = undefined;
    }
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer?.close(() => resolve()));
      httpServer = undefined;
    }
  });

  function startServer(building: Building, getTick: () => number): Promise<number> {
    httpServer = createServer();
    ioServer = new Server(httpServer, { cors: { origin: '*' } });
    ioServer.on('connection', (socket: Socket) => {
      registerSocketHandlers(socket, building, getTick);
    });
    return new Promise((resolve) => {
      httpServer?.listen(0, () => {
        const address = httpServer?.address() as AddressInfo;
        resolve(address.port);
      });
    });
  }

  it('a connecting client receives an immediate buildingState snapshot', async () => {
    const building = new Building({ floors: 10, elevatorCount: 3 });
    const port = await startServer(building, () => 0);

    const snapshot = await new Promise<ReturnType<typeof buildSnapshot>>((resolve) => {
      client = ioClient(`http://localhost:${port}`);
      client.on('buildingState', (payload: ReturnType<typeof buildSnapshot>) => resolve(payload));
    });

    expect(snapshot.tick).toBe(0);
    expect(snapshot.floors).toBe(10);
    expect(snapshot.elevators).toHaveLength(3);
    expect(snapshot.pendingHallCalls).toEqual([]);
  });

  it('emitting hallCall produces a domain effect reflected in the next buildingState broadcast', async () => {
    const building = new Building({ floors: 10, elevatorCount: 3 });
    let tick = 0;
    const port = await startServer(building, () => tick);

    await new Promise<void>((resolve) => {
      client = ioClient(`http://localhost:${port}`);
      client.once('buildingState', () => resolve()); // wait for the immediate connect snapshot first
    });

    client?.emit('hallCall', { floor: 5, direction: 'UP' });

    // Give the server a moment to process the emitted event before the next
    // broadcast, then drive a tick + broadcast exactly like server.ts's
    // interval driver would.
    await new Promise((resolve) => setTimeout(resolve, 50));
    building.tick();
    tick += 1;
    if (ioServer) broadcastBuildingState(ioServer, building, tick);

    const snapshot = await new Promise<ReturnType<typeof buildSnapshot>>((resolve) => {
      client?.once('buildingState', (payload: ReturnType<typeof buildSnapshot>) => resolve(payload));
    });

    expect(snapshot.tick).toBe(1);
    const assigned = snapshot.elevators.find((e) => e.stopQueue.includes(5) || e.currentFloor === 5);
    expect(assigned).toBeDefined();
  });
});

