# Epic 3 Context: Containerized Delivery

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

A reviewer can bring up the entire stack with a single `docker-compose up` and reach a fully working app with zero manual setup — no local Node.js install, no manual `npm install`. This epic is purely additive: it touches only container/deploy files (Dockerfiles, `docker-compose.yml`, Nginx config, README), never application logic. It is the lowest-cost, lowest-risk item in the project — deliberately scoped small so it never displaces time from the domain-core correctness work (Epic 1), which is the highest-weighted grading criterion.

## Stories

- Story 3.1: Backend Container
- Story 3.2: Frontend Container (Nginx) + Compose Orchestration

## Requirements & Constraints

- The full stack (backend + frontend) must build and run via Docker with no manual local dependency installation outside the image (FR-18).
- The frontend must be served through Nginx in the containerized setup (FR-19).
- A reviewer must be able to get the whole stack running locally from one documented command — `docker-compose up` — or equivalently a single documented local command (deployability NFR).
- Time spent on containerization must stay proportionate — it's a JD-alignment bonus item, not where effort should concentrate; a working domain core matters far more than container polish.
- The backend image must include only what `backend` + `shared` need — no frontend source leaks into the backend image.
- Opening the frontend's exposed port in a browser must reach a fully working app: Hall Call, Car Call, Door Control, and real-time sync all functional, matching Epic 2's behavior exactly (no regressions from containerization).
- The README must document the one-command Docker path to run the whole stack.

## Technical Decisions

- **Repo layout**: npm workspace root with `backend/`, `frontend/`, `shared/` packages. `backend/Dockerfile` and `frontend/Dockerfile` live in their respective workspace folders; `docker-compose.yml` lives at repo root; `frontend/nginx.conf` configures the frontend's Nginx.
- **Backend container**: builds the Node.js 24 LTS backend workspace package (plus its `shared` dependency). Starts the server and serves WebSocket on its configured port with no manual install step baked in — the image build handles all dependency installation.
- **Frontend container**: builds the Vite production bundle, then serves the static output via `nginx:1.30-alpine` (pinned tag). This is a multi-stage concern in spirit — build the SPA, then serve it from Nginx — though the exact Dockerfile staging is left to implementation.
- **Compose orchestration**: use the `docker compose` CLI plugin (v2 syntax) — omit the deprecated `version:` key from `docker-compose.yml`.
- **Container networking**: the frontend's Nginx container must proxy WebSocket/API traffic to the backend via Docker Compose's internal service-name DNS, e.g. `proxy_pass http://backend:<port>` — never a hardcoded IP or `localhost` inside a container. This is a hard architectural rule (not just a suggestion), since `localhost` inside the Nginx container would resolve to the container itself, not the backend service.
- **No auth/session layer, no persistence** anywhere in the stack — irrelevant to container config but worth knowing when wiring env/ports (nothing extra to configure for sessions or databases).
- **WS/event contract is unaffected by containerization** — client→server events (`hallCall`, `carCall`, `doorHold`, `doorClose`) and server→client (`buildingState`) are Epic 2 concerns; this epic must not change them, only transport them correctly through the container network.
- Pinned versions relevant here: Node.js 24 LTS (24.21.0) for the backend image; `nginx:1.30-alpine` for the frontend image; Vite 8.3.0 for the frontend production build.

## Cross-Story Dependencies

- Story 3.2 (frontend container + Compose orchestration) depends on Story 3.1 (backend container) existing, since Compose needs a backend service to proxy to and to bring up alongside the frontend.
- This epic depends on Epic 2 being functionally complete (real-time web app working over WebSocket) — Story 3.2's acceptance criteria explicitly require the containerized app to match Epic 2's behavior exactly (Hall Call, Car Call, Door Control, real-time sync).
- This epic depends on Epic 1's backend domain logic being present (via the backend workspace) but does not modify or re-test it — containerization is purely a packaging/deployment concern layered on top of already-working application code.
