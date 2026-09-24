---
title: 'Frontend Container (Nginx) + Compose Orchestration'
type: 'feature' # feature | bugfix | refactor | chore
created: '2026-09-24'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done
route: 'oneshot' # oneshot | full — set by step-02
route_source: 'auto' # pinned | auto — set with route by step-02
review: 'quick' # none | quick | thorough — set by step-04
review_source: 'auto' # pinned | auto — set with review by step-04
lenses_ran: ['quick'] # ids of the lenses launched, set by step-04
review_loop_iteration: 0 # incremented by step-04 before each review loopback
baseline_commit: '453b9d33192ab98f15695348b1f24b333e1e9440'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** There is no single command to bring up and evaluate the full stack — a reviewer must run backend and frontend separately with Node.js installed locally, and Story 3.1's backend container alone has no browser-facing UI.

**Approach:** Add `frontend/Dockerfile` (multi-stage: `node:24-alpine` builds the Vite production bundle for the `frontend`+`shared` workspaces only, then `nginx:1.30-alpine` serves it), `frontend/nginx.conf` reverse-proxying `/socket.io/` (WS + HTTP polling) to `http://backend:3001` via Compose's internal service-name DNS, and a root `docker-compose.yml` (no `version:` key) wiring `backend`+`frontend` together with only the frontend's port published to the host — matching FR-19's "never a hardcoded IP/localhost" for the proxy target. Because the *browser* (not Nginx) initiates the Socket.IO connection, `frontend/src/hooks/useBuildingSocket.ts`'s `resolveBackendUrl()` needs a small, mechanical change: build the image with `VITE_BACKEND_URL=""`, resolved to `undefined` (not a literal URL) so `io(undefined)` uses socket.io-client's same-origin default — this is what actually routes the browser's WS traffic through Nginx's proxy instead of around it. Local dev (`VITE_BACKEND_URL` unset) is unaffected. Document `docker-compose up` as the one-command path in a new root `README.md` (NFR-6).

</frozen-after-approval>

## Implementation Notes

Investigation surfaced a real design constraint not obvious from the epic context: `useBuildingSocket.ts` connects the browser directly to `DEFAULT_BACKEND_URL = 'http://localhost:3001'` by default. If the container build kept that default, the browser's WS traffic would go straight to wherever `localhost:3001` resolves for the viewer — bypassing Nginx entirely and violating "proxies WS/API traffic to the backend" — and would break unless the backend's port were also published to the host, contradicting the single-entry-point design. Confirmed via `socket.io-client`'s `url.js` source (`node_modules/socket.io-client/build/esm/url.js`) that only `null`/`undefined` triggers its same-origin default — an empty string does not (it gets treated as a literal, malformed URI). So `resolveBackendUrl()` now maps `VITE_BACKEND_URL=''` to `undefined` specifically, not just passes the empty string through.

Built and ran the real stack end-to-end via `docker compose build` + `docker compose up -d`: confirmed `GET http://localhost:8080/` → 200 (SPA), `GET http://localhost:8080/socket.io/?EIO=4&transport=polling` → 200 with a valid engine.io handshake body (proxied). Inspected the actual built+minified bundle and confirmed `import.meta.env.VITE_BACKEND_URL` is baked in as `''` and `resolveBackendUrl()`'s compiled logic (`e===''?void 0:e??Ri`) always takes the `void 0` (same-origin) branch in this build — the `http://localhost:3001` string is present in the bundle only as inert, unreachable dead code (the `DEFAULT_BACKEND_URL` fallback), not something the compiled logic can actually select given `VITE_BACKEND_URL` is always `''` here. Then ran a real `socket.io-client` WebSocket connection (`transports: ['websocket']`) against `http://localhost:8080` from outside the containers and confirmed it upgrades to a WebSocket and receives live `buildingState` ticks through the Nginx proxy — full round-trip, not just the HTTP-level polling handshake. Ran `npm test --workspace=frontend` after the `useBuildingSocket.ts` change: all 56 tests still pass (the test suite mocks `socket.io-client`'s `io` entirely, so it doesn't assert on the URL argument). Cleaned up all containers/images/scratch files afterward.

## Spec Change Log

## Review Triage Log

Quick lens, 6 findings:
- `nginx.conf`'s `/socket.io/` block lacked `proxy_read_timeout`/`proxy_send_timeout` overrides for long-lived WS connections — `medium` (real gap this diff introduced, simple fix). **Patched**: added `proxy_read_timeout 3600s;`/`proxy_send_timeout 3600s;`. Re-verified: `nginx -t` passes, stack still serves 200 on `/` and the proxied `/socket.io/` handshake after the change.
- No healthcheck/restart policy in `docker-compose.yml` — `low`, not required by any AC, real fix would exceed "simple correction." **Deferred** (see `deferred-work.md`).
- Backend publishes no host port — reviewer flagged for confirmation, matches this spec's own frozen Intent (single entry point) exactly. **false** — not a problem, it's the intended design.
- `.dockerignore`'s `frontend`/`node_modules`/`dist` coverage — reviewer's own analysis already concluded the existing `**/node_modules`/`**/dist` patterns cover it. **false** — reviewer self-resolved, no action needed.
- Whether `shared` needs a pre-built `dist` for the frontend build — **false**: disproven by the actual `docker compose build` run captured in Implementation Notes (`✓ built in 405ms`, 62 modules transformed, no missing-module errors); `shared`'s package entrypoint resolves to `.ts` source directly and Vite consumes it as-is.
- Whether `resolveBackendUrl()`'s `string | undefined` return type still compiles at its call site — **false**: disproven by `npx tsc --noEmit -p frontend/tsconfig.app.json` (zero errors) already run and recorded, plus the bundle inspection confirming correct compiled behavior.

## Verification

**Commands:**
- `docker compose build` (repo root) -- expected: both `backend` and `frontend` images build successfully
- `docker compose up -d` -- expected: both containers start and stay up
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/` -- expected: `200` (SPA served)
- `curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/socket.io/?EIO=4&transport=polling"` -- expected: `200` (proxied to backend, confirms same-origin routing works)
- `docker compose logs backend` -- expected: no proxy/connection errors after a client interaction
- `docker compose down` -- cleanup

**Manual checks (if no CLI):**
- Open `http://localhost:8080` in a browser: Hall Call, Car Call, and Door Hold/Close controls work and the UI updates in real time (snapshot ticks), matching Epic 2's app exactly.
