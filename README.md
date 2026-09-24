# Elevator Simulator

A real-time, multi-elevator building simulator built as a Node.js/React take-home test. The backend is a server-authoritative simulation (3 elevators, 10 floors) implementing the industry-standard **SCAN/LOOK** dispatch rule; the frontend renders the live state over WebSocket for Hall Call, Car Call, and Door Hold/Close controls. Two browser tabs open at once never disagree — the client never computes elevator state itself, it only renders the server's latest snapshot.

## Highlights

- **Correct SCAN/LOOK dispatch** — a moving elevator only stops for a Hall Call that shares its direction and lies ahead of it; unservable calls become Pending and are retried every tick, never dropped.
- **Real object-oriented design** — elevator behavior is a State pattern (`IdleState` → `MovingState` → `MovingUpState`/`MovingDownState`, `DoorOpenState`), not a switch/if-chain; elevator selection is a Strategy pattern (`SchedulingStrategy` / `NearestCarStrategy`) the `Dispatcher` never branches on.
- **Hexagonal backend** — the domain core (`backend/src/domain`) has zero transport/UI dependency, enforced by a static import-graph test (`domainPurity.test.ts`), not just convention.
- **Server-authoritative real-time sync** — one `Building.tick()` per ~500ms broadcasts a full `BuildingSnapshot`; the client (Redux) only ever replaces its store with the latest snapshot, guarded by a monotonic `tick` counter.
- **154 automated tests** (94 backend + 60 frontend) covering domain logic, dispatch edge cases, the WebSocket adapter, and UI behavior.

## Project structure

```text
elevator-simulator/
  shared/            # wire contract: Direction, DoorState, ElevatorSnapshot, BuildingSnapshot, WS events
  backend/
    src/
      domain/          # Elevator, Dispatcher, Building, ElevatorState hierarchy, SchedulingStrategy
      ws/              # the one adapter allowed to import both domain/ and socket.io
      server.ts        # tick driver + process entrypoint
  frontend/
    src/
      components/      # BuildingView, ElevatorCar, FloorHallPanel, DestinationPanel, DoorControls, ...
      store/           # Redux Toolkit: buildingSlice (Snapshot cache), uiSlice (connection status)
      hooks/           # useBuildingSocket — the one adapter touching socket.io-client
  docker-compose.yml           # local/demo stack
  docker-compose.prod.yml      # VPS stack with Caddy (automatic HTTPS)
  _bmad-output/                # PRD, architecture spine, and UX design docs this build follows
```

## Tech stack

| | |
|---|---|
| Backend | Node.js 24, TypeScript, Socket.IO |
| Frontend | React 19, Redux Toolkit, Vite |
| Testing | Vitest + Testing Library |
| Containers | Docker, Nginx (frontend), Caddy (production TLS) |

## Running with Docker (recommended)

Requires Docker with the `docker compose` CLI plugin. From the repo root:

```sh
docker compose up --build
```

Then open **http://localhost:8080** in a browser. The frontend is served by Nginx, which also reverse-proxies Socket.IO traffic to the backend — no other ports need to be open.

Stop the stack with `docker compose down`.

## Deploying publicly (VPS + domain)

See [`DEPLOY.md`](./DEPLOY.md) — `docker-compose.prod.yml` adds Caddy in front of the same containers for automatic HTTPS.

## Running locally without Docker

Requires Node.js 24+.

```sh
npm install
npm start --workspace=backend    # backend on http://localhost:3001
npm run dev --workspace=frontend # frontend on http://localhost:5173
```

## Running tests

```sh
npm test --workspace=backend     # 94 tests — domain logic, dispatch, WebSocket adapter
npm test --workspace=frontend    # 60 tests — components, Redux slices
```

## Design & architecture docs

Full requirements, architecture invariants, and UX design decisions live under [`_bmad-output/planning-artifacts/`](./_bmad-output/planning-artifacts/):

- `prds/prd-elevator-simulator-2026-09-23/prd.md` — product requirements (FR-1–FR-19)
- `architecture/architecture-elevator-simulator-2026-09-23/ARCHITECTURE-SPINE.md` — the 8 architecture decisions (AD-1–AD-8) governing the codebase
- `ux-designs/ux-elevator-simulator-2026-09-24/DESIGN.md` / `EXPERIENCE.md` — the "Ascent" visual/interaction design system
