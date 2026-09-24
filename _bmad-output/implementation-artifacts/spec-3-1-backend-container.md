---
title: 'Backend Container'
type: 'feature' # feature | bugfix | refactor | chore
created: '2026-09-24'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done
route: 'oneshot' # oneshot | full — set by step-02
route_source: 'auto' # pinned | auto — set with route by step-02
review: 'quick' # none | quick | thorough — set by step-04
review_source: 'auto' # pinned | auto — set with review by step-04
lenses_ran: ['quick'] # ids of the lenses launched, set by step-04
review_loop_iteration: 0 # incremented by step-04 before each review loopback
baseline_commit: '3f459ec56155b76a2e59181b382738f4423dd18c'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A reviewer must have Node.js 24 and run `npm install` locally to evaluate the backend — there is no way to build and run it in a container.

**Approach:** Add `backend/Dockerfile` (built from the repo root as context) that installs only the `backend` + `shared` workspace dependencies via `npm ci --workspace=backend --workspace=shared` on `node:24-alpine`, copies only `backend/src` + `shared/src` (plus their `tsconfig.json`s), and runs the existing `start` script (`tsx src/server.ts` — no compiled build step, since `shared`'s package entrypoint resolves to `.ts` source and switching to compiled output would require touching application import paths, which is out of this purely-additive epic's scope). Add a root `.dockerignore` (`node_modules`, `frontend`, `.git`, `dist`, `coverage`) so the frontend workspace and other bulk never enter the build context.

</frozen-after-approval>

## Implementation Notes

Validated this approach interactively before writing this spec: built a throwaway image with this exact Dockerfile shape against a minimal context (root package.json/lock + backend/shared package.json+src+tsconfig, no frontend), confirmed `npm ci --workspace=backend --workspace=shared` succeeds and installs `tsx` (needs devDependencies present — `--omit=dev` strips `tsx` and breaks the start script), ran the resulting image, and confirmed the server logs "listening on port 3001" and the Socket.IO polling handshake (`GET /socket.io/?EIO=4&transport=polling`) returns HTTP 200. Also confirmed no `frontend/` directory exists inside the built image. This spec productionizes that validated shape as real repo files.

Wrote `backend/Dockerfile` and root `.dockerignore`, then re-ran the full verification against the real files from repo root: `docker build -f backend/Dockerfile -t elevator-backend .` (build context 222.97kB — confirms `.dockerignore` is excluding `node_modules`/`frontend`/etc.), ran the image, logs showed `Elevator simulator backend listening on port 3001`, the Socket.IO polling handshake returned `200`, and `/app/frontend` does not exist in the container. Host port 3001 was already bound locally (a dev server), so the verification run mapped to host port 3098 instead — the container itself still listens on 3001 internally per `EXPOSE 3001`. Cleaned up the test image/container afterward.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `docker build -f backend/Dockerfile -t elevator-backend .` (run from repo root) -- expected: builds successfully, no error
- `docker run --rm -d --name elevator-backend-verify -p 3001:3001 elevator-backend && sleep 2 && docker logs elevator-backend-verify` -- expected: log line `Elevator simulator backend listening on port 3001`
- `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/socket.io/?EIO=4&transport=polling"` -- expected: `200`
- `docker exec elevator-backend-verify sh -c "test -d /app/frontend && echo FOUND || echo OK"` -- expected: `OK` (no frontend source in the image)
- `docker rm -f elevator-backend-verify && docker rmi elevator-backend` -- cleanup
