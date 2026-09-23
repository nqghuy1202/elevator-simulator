/**
 * Headless demo of the elevator domain core (Epic 1's "headless demo path"
 * goal): constructs a default `Building`, drives Hall Calls including the
 * PRD's worked example, ticks the simulation, and logs a readable
 * one-line-per-tick summary of every elevator plus any pending calls.
 *
 * Run with `npm run demo --workspace=backend` -- no build step, no server,
 * no UI. Pure console output demonstrating SCAN/LOOK dispatch end-to-end.
 */
import { Building } from './domain/Building.js';

const TOTAL_TICKS = 26;

function formatSnapshot(snapshot: ReturnType<Building['getElevatorSnapshots']>[number]): string {
  const queue = snapshot.stopQueue.length > 0 ? `[${snapshot.stopQueue.join(',')}]` : '[]';
  return `${snapshot.id} floor=${String(snapshot.currentFloor).padStart(2)} dir=${snapshot.direction.padEnd(4)} door=${snapshot.doorState.padEnd(7)} state=${snapshot.stateName.padEnd(10)} stops=${queue}`;
}

function formatPending(building: Building): string {
  const pending = building.getPendingCalls();
  if (pending.length === 0) return 'pending=[]';
  return `pending=[${pending.map((p) => `${p.floor}${p.direction === 'UP' ? '↑' : '↓'}`).join(', ')}]`;
}

function logTick(label: string, building: Building): void {
  const line = building.getElevatorSnapshots().map(formatSnapshot).join('  |  ');
  console.log(`${label.padEnd(8)} ${line}  ${formatPending(building)}`);
}

// A single elevator for the PRD worked example itself: with only one car,
// a DOWN call at floor 5 genuinely has no eligible elevator while the sole
// car moves UP toward 10 (no other idle elevator can steal it), so the
// Pending path is actually exercised end-to-end -- not just the "assigned
// immediately" happy path.
const building = new Building({ floors: 10, elevatorCount: 1 });

console.log('=== Elevator Simulator -- headless demo ===');
console.log(`Building: ${building.getFloorCount()} floors, ${building.getElevatorSnapshots().length} elevator(s)\n`);
console.log('PRD worked example: an elevator moving 1->10 accepts an UP call at floor 5,');
console.log('but rejects a DOWN call at floor 5 (wrong direction) -- the DOWN call is');
console.log('stored as Pending, not dropped, and is only serviced once the elevator');
console.log('later reverses/idles and reevaluatePending() retries it.\n');

logTick('init', building);

// Send the elevator on its long trip from floor 1 toward floor 10 -- this
// is the PRD's worked example car: "an elevator moving 1->10".
building.handleHallCall(10, 'UP');
logTick('call', building);
console.log('  (Hall Call: floor 10 UP -- the idle elevator takes it, now moving 1->10)\n');

// Run it a couple of ticks so it's mid-flight before the worked-example
// calls are placed, matching the PRD's "currently at floor 3" framing.
for (let i = 0; i < 2; i++) {
  building.tick();
  logTick(`tick ${i + 1}`, building);
}
console.log();

// PRD worked example, part 1: an UP call at floor 5 is still ahead of the
// elevator's current direction of travel -- it is accepted (queued).
building.handleHallCall(5, 'UP');
logTick('call', building);
console.log('  (Hall Call: floor 5 UP -- still ahead of the UP-moving elevator -> accepted, queued)\n');

// PRD worked example, part 2: a DOWN call at floor 5 is NOT accepted by an
// elevator moving UP toward 10 (wrong direction) -- it goes Pending instead
// of being dropped.
building.handleHallCall(5, 'DOWN');
logTick('call', building);
console.log('  (Hall Call: floor 5 DOWN -- rejected by the UP-moving elevator, stored as Pending, not dropped)\n');

// Keep ticking: watch the elevator pick up floor 5 (UP call already queued),
// continue on to 10, go Idle, and then watch the Pending DOWN call at floor
// 5 get retried via reevaluatePending() once the elevator is idle/eligible
// again -- it heads back down to service it.
for (let i = 2; i < TOTAL_TICKS; i++) {
  building.tick();
  logTick(`tick ${i + 1}`, building);
}

console.log('\n=== Demo complete ===');
