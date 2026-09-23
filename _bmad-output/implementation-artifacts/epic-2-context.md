# Epic 2 Context: Real-time Web App

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

An occupant can use the real web app end-to-end: place Hall Calls and Car Calls, hold or close elevator doors, and watch 3 elevators move in real time across 10 floors, backed by Redux-managed client state. This epic wires Epic 1's already-correct domain core (Elevator/Dispatcher/Building) to a browser client over WebSocket, without letting any simulation logic leak into the transport or UI layers. It builds directly on Epic 1 — the state machine and dispatch engine are assumed complete and correct going into this epic.

## Stories

- Story 2.1: Backend WebSocket Adapter & Shared Wire Contract
- Story 2.2: Frontend Scaffold + Redux Snapshot Store
- Story 2.3: Hall Call & Pending Indicator UI
- Story 2.4: Car Call UI
- Story 2.5: Door Hold/Close UI

## Requirements & Constraints

- Occupants place Hall Calls (↑ at floors 1-9, ↓ at floors 2-10; button absent where not applicable) and see a pending indicator per floor/direction that persists until an elevator opens its doors there for that direction. Repeat presses on an already-pending direction must not duplicate the request or change its assignment order. ↑ and ↓ indicators on the same floor are independent.
- Occupants place Car Calls only while inside an elevator with doors open, selecting any floor 1-10 except the current one; multiple Car Calls in one visit queue in current-direction order. The Car Call UI must appear only while that elevator's `doorState` is open, per the Snapshot.
- Hold resets the door dwell timer (doors never auto-close while held); Close cancels the remaining dwell timer and the elevator begins closing next tick. Both controls are visible only while doors are open.
- The server is the sole source of simulation truth: the client must never compute Elevator/Building state itself, only store and render the latest Snapshot. Two browser tabs open at once must never disagree about elevator position or door state.
- Clients receive Building updates in real time, at or faster than the ~500ms simulation tick, with no manual refresh/polling.
- On WS `connect`, the server immediately emits a full `buildingState` Snapshot so a joining/reconnecting client is never blank until the next tick.
- An invalid client action (e.g. Car Call to the elevator's current floor) is a silent server-side no-op — never a thrown or emitted error; there is no WS error envelope.
- All Snapshot and UI-interaction state lives in Redux (Redux Toolkit), not ad hoc component state passed through props.
- Success is judged primarily on SCAN/LOOK correctness and OOP legibility (Epic 1's domain), but this epic's UI/UX must expose that correctness faithfully — no dropped requests, no UI state drifting from server truth. UI is intentionally minimal/unstyled; do not spend time on visual polish.

## Technical Decisions

- **Boundary:** `domain/` (Epic 1) has zero dependency on `ws/`, `server.ts`, React, or Redux. `ws/socketHandlers.ts` is the one adapter wrapping `Building`/`Dispatcher` for Socket.IO 4.8.3, and it imports only from `domain/` and `shared/` — never the reverse.
- **Wire contract:** the `shared` npm workspace package (backend-owned) is the *only* place `ElevatorSnapshot`, `BuildingSnapshot`, and WS event payload types are defined; both `backend` and `frontend` import from it, never redefine locally. A `shared/` type change must land in the same commit as its backend call-site change. `BuildingSnapshot` carries a monotonic `tick` sequence number.
  - `ElevatorSnapshot`: `id`, `currentFloor`, `direction`, `doorState`, `destinations[]`.
  - `BuildingSnapshot`: `floors`, `elevators[]`, `pendingHallCalls[]`.
- **WS events** — client→server: `hallCall`, `carCall`, `doorHold`, `doorClose`, mapping 1:1 to `Elevator`/`Dispatcher` public commands. Server→client: `buildingState` (full snapshot broadcast every tick, ~500ms).
- **Redux (AD-3):** every `buildingState` event fully replaces the `buildingSlice` — never merges. The reducer drops any incoming Snapshot whose `tick` isn't strictly greater than the one currently stored (guards stale/out-of-order delivery, e.g. on reconnect). UI-only state (panel expansion, etc.) lives in a separate slice/component state that a Snapshot replace never touches.
- **Client rendering rule (AD-1):** client-side interpolation/tweening of a Snapshot value for smoother rendering (e.g. easing a car's pixel position between ticks) is permitted, but must never be written back to Redux or read by application logic — it reverts to the authoritative value on the next Snapshot.
- **Structural seed (file locations):**
  - `shared/src/snapshot.ts`, `shared/src/events.ts`
  - `backend/src/ws/socketHandlers.ts`, `backend/src/server.ts` (tick driver, owns the `setInterval`)
  - `frontend/src/store/` (Redux Toolkit slices), `frontend/src/hooks/useBuildingSocket.ts`
  - `frontend/src/components/`: `BuildingView.tsx`, `FloorHallPanel.tsx`, `ElevatorShaft.tsx`, `ElevatorCar.tsx`, `DestinationPanel.tsx`
- **Stack/versions:** React 19.3.0, Vite 8.3.0 (`npm create vite@latest -- --template react-ts`), TypeScript ^5.9, Redux Toolkit 2.12.0, react-redux 9.3.0, Socket.IO (server+client) 4.8.3, Vitest 5.0.1.
- **Data conventions:** floors are 1-indexed integers 1-10; `Direction`: `'UP' | 'DOWN' | 'IDLE'`; `DoorState`: `'OPEN' | 'OPENING' | 'CLOSING' | 'CLOSED'`.
- No auth/session layer, no persistence (process memory only; restart resets the Building) — both are explicit non-goals, not gaps to fill in this epic.

## UX & Interaction Patterns

- No formal UX design contract exists for this project (solo take-home test, single "building occupant" persona); minimal/unstyled UI is explicitly acceptable and preferred over time spent on polish.
- `FloorHallPanel` (one per floor 1-10): ↑ button hidden at floor 10, ↓ button hidden at floor 1; a pending indicator per direction lights up on press and clears only when that floor/direction is serviced (per Snapshot), independent of the other direction.
- `DestinationPanel`/car call UI appears only while the relevant elevator's `doorState` is `OPEN` (or open-ish per Snapshot), offering all floors 1-10 except the current one; supports multiple selections in one visit.
- Door Hold (◁▷) and Door Close (▷◁) controls are visible only while that elevator's doors are open.

## Cross-Story Dependencies

- Story 2.1 (backend WS adapter + shared contract) is the prerequisite for all of 2.2-2.5 — the frontend has nothing to connect to until the shared types and socket handlers exist.
- Story 2.2 (Redux snapshot store + `useBuildingSocket`) is the prerequisite for 2.3, 2.4, 2.5 — each UI story renders off the Snapshot in the store rather than talking to the socket directly.
- This epic depends entirely on Epic 1's domain core (`Elevator`, `Dispatcher`, `Building`) being correct and stable; Epic 2 does not modify domain logic, only wraps and exposes it.
- Epic 3 (containerization) builds on this epic's frontend/backend as-is — Epic 2's WS behavior (`proxy_pass http://backend:<port>` via Compose DNS) must work identically once containerized, so avoid hardcoding host/port assumptions that would break under Nginx proxying.
