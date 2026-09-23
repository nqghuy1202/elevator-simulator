/**
 * Tick driver and process entrypoint (`npm run start --workspace=backend`,
 * via `tsx` — no build step yet, per this story's Design Notes). Creates
 * the single `Building`, an HTTP + Socket.IO server (permissive CORS, no
 * auth — explicit PRD Non-Goals), and the `setInterval` that ticks the
 * simulation and broadcasts a fresh `BuildingSnapshot` roughly every
 * 500ms. Owns the monotonic `tick` sequence counter (AD-4): a transport
 * concern, not `Building`'s.
 */
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { Building } from './domain/Building.js';
import { broadcastBuildingState, registerSocketHandlers } from './ws/socketHandlers.js';

const DEFAULT_PORT = 3001;

function resolvePort(): number {
  const raw = process.env['PORT'];
  if (raw === undefined) {
    return DEFAULT_PORT;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.warn(`Invalid PORT env var "${raw}" (must be a positive integer) — falling back to ${DEFAULT_PORT}`);
    return DEFAULT_PORT;
  }
  return parsed;
}

const PORT = resolvePort();
const TICK_INTERVAL_MS = 500;

const building = new Building({ floors: 10, elevatorCount: 3 });

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

let tick = 0;
let tickInFlight = false;

io.on('connection', (socket) => {
  registerSocketHandlers(socket, building, () => tick);
});

setInterval(() => {
  // Ticks are synchronous today, so re-entrancy can't actually happen yet —
  // this guard is future-proofing against a later async tick body racing
  // the `tick` counter or double-broadcasting.
  if (tickInFlight) {
    return;
  }
  tickInFlight = true;
  try {
    building.tick();
    tick += 1;
    broadcastBuildingState(io, building, tick);
  } catch (error) {
    console.error('Error during simulation tick:', error);
  } finally {
    tickInFlight = false;
  }
}, TICK_INTERVAL_MS);

httpServer.on('error', (error) => {
  console.error('HTTP server error:', error);
  process.exit(1);
});

httpServer.listen(PORT, () => {
  console.log(`Elevator simulator backend listening on port ${PORT}`);
});
