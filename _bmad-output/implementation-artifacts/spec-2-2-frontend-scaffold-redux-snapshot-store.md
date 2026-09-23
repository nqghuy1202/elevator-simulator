---
title: 'Frontend Scaffold + Redux Snapshot Store'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: 'a795f6e174361415d7dc3011d4f54df4093ae557'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No frontend exists yet. Story 2.1 made the backend real-time-reachable, but nothing on the client connects to it, and there's no established pattern for how Snapshot data and UI-only state coexist without the drift AD-3 exists to prevent.

**Approach:** Scaffold `frontend` (Vite + React 19.3 + TypeScript ^5.9) as the third npm workspace member. Add a Redux store with two slices: `building` (holds the latest `BuildingSnapshot`, replace-only, sequence-guarded) and `ui` (connection status today; the separate home for any UI-only state later stories add). `useBuildingSocket` connects to the backend, dispatches `snapshotReceived` on every `buildingState` event. `App` wires it all together and renders a minimal, walking-skeleton view proving the pipeline works end-to-end — not the real UI (Stories 2.3–2.5 build that).

## Boundaries & Constraints

**Always:**
- The client never computes Elevator/Building state itself — `buildingSlice` only stores whatever `BuildingSnapshot` arrives; no derived/interpolated business state (FR-14, AD-1).
- Every `buildingState` event fully replaces `buildingSlice`'s snapshot — never a partial merge. The reducer drops (no-ops) any incoming Snapshot whose `tick` is not strictly greater than the one currently stored (AD-3).
- UI-only state (this story: connection status) lives in a separate `uiSlice` that a Snapshot replace never touches, establishing the pattern later stories (2.3–2.5) extend (AD-3).
- All Snapshot and UI-interaction state lives in the Redux store — no ad hoc component state holding either (FR-17).
- `frontend` imports `Direction`/`DoorState`/`ElevatorSnapshot`/`BuildingSnapshot`/event types from `shared` — never redefines them locally (AD-4).

**Never:**
- No Hall Call / Car Call / Door Hold/Close UI or emit-triggering components — Stories 2.3–2.5 build those on top of this store. `useBuildingSocket` may expose the means to emit later, but nothing calls it yet.
- No visual polish — a minimal, unstyled view is explicitly acceptable (PRD NFR-7).
- No changes to `backend`/`shared`/`domain` — this story only adds `frontend`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh Snapshot replaces store | `buildingSlice` holds tick 5; a `buildingState` with tick 6 arrives | Store now holds the tick-6 Snapshot in full — no merged/partial fields from tick 5 | No error expected |
| Stale/duplicate Snapshot is dropped | `buildingSlice` holds tick 6; a `buildingState` with tick 6 or tick 5 arrives | Store unchanged — the reducer no-ops | No error expected |
| UI-only state survives a Snapshot replace | `uiSlice.connectionStatus` is `'connected'`; a fresh `buildingState` arrives | `uiSlice.connectionStatus` is untouched by the `building` reducer | No error expected |
| Hook dispatches on real socket event | `useBuildingSocket` mounted, connected to a (mocked) socket; server emits `buildingState` | `snapshotReceived` is dispatched with that payload | No error expected |
| Initial state before first Snapshot | Store just created, no `buildingState` received yet | `buildingSlice.snapshot` is `null`; the app renders a "connecting" state without crashing | No error expected |

</frozen-after-approval>

## Code Map

- `package.json` (root) -- EDIT: `workspaces` → `["backend", "shared", "frontend"]`
- `frontend/` -- NEW: Vite + React + TS scaffold (`npm create vite@latest -- --template react-ts`), plus Redux Toolkit 2.12, react-redux 9.3, socket.io-client 4.8.3, Vitest 5.0.1, `@testing-library/react`
- `frontend/src/store/buildingSlice.ts` -- NEW: `snapshot: BuildingSnapshot | null`, `snapshotReceived` reducer (tick-guarded replace)
- `frontend/src/store/uiSlice.ts` -- NEW: `connectionStatus: 'connecting' | 'connected' | 'disconnected'`
- `frontend/src/store/index.ts` -- NEW: `configureStore`, typed `useAppDispatch`/`useAppSelector`
- `frontend/src/hooks/useBuildingSocket.ts` -- NEW: connects via `socket.io-client`, dispatches `snapshotReceived` + connection-status updates
- `frontend/src/App.tsx` -- EDIT (from Vite template): wraps with `<Provider>`, calls `useBuildingSocket`, renders a minimal snapshot summary
- `frontend/src/index.css`, `frontend/src/setupTests.ts` -- NEW (Vite/Vitest template scaffolding: base styles, test-environment setup)

## Tasks & Acceptance

**Execution:**
- [x] Scaffold `frontend` via Vite react-ts template, add to root workspaces -- establishes the third workspace member
- [x] `frontend/src/store/buildingSlice.ts` -- tick-guarded replace-only reducer -- FR-14, AD-3
- [x] `frontend/src/store/uiSlice.ts` -- `connectionStatus`, untouched by `building`'s reducer -- AD-3
- [x] `frontend/src/store/index.ts` -- store + typed hooks -- FR-17
- [x] `frontend/src/hooks/useBuildingSocket.ts` -- connects to `import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001'`, dispatches on `buildingState` -- FR-13, AD-1
- [x] `frontend/src/App.tsx` -- minimal wired view (e.g. connection status + elevator count/floors from the store) -- proves the pipeline end-to-end
- [x] `frontend/src/store/buildingSlice.test.ts`, `uiSlice.test.ts` -- reducer tests covering every I/O Matrix row -- NFR-5
- [x] `frontend/src/hooks/useBuildingSocket.test.ts` -- dispatch-on-event test against a mocked socket -- NFR-5

**Acceptance Criteria:**
- Given `npm test --workspace=frontend`, when it runs, then all reducer and hook tests pass
- Given `npm run build --workspace=frontend`, when it runs, then it produces a production build with zero type errors
- Given `npm run dev --workspace=frontend` with the backend running, when the page loads, then it shows a connected state reflecting the live `BuildingSnapshot` (manually verified, not just unit-tested)

## Implementation Notes

**AC #3 (manual live-backend verification) — performed, recording it here:** started the backend (`npm run start --workspace=backend`, port 3001) and frontend (`npm run dev --workspace=frontend`) together, loaded the page in a real browser. Observed "Connection status: connected", live elevator/floor data, and the tick counter advancing (85 → 101 over ~3s, matching the ~500ms server tick) with zero console errors — confirmed the real-time pipeline works end-to-end, not just unit-tested. Both dev servers were stopped and build artifacts cleaned up afterward.

## Spec Change Log

## Review Triage Log

**Lenses run:** blind-hunter (9 findings), edge-case-hunter (3 findings), verification-gap (2 findings), intent-alignment (descriptive, 1 recording gap, 2 minor notes).

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| 1 | (edge-case-hunter, cross-cutting) After a backend restart, the server's `tick` counter resets to 0/low, but the client's tick-guard (`action.payload.tick <= state.snapshot.tick`) permanently rejects every subsequent Snapshot once the client has seen a higher tick — the UI freezes on stale pre-restart data indefinitely, with no visual indication. | high→patch | Real, significant: traced the full mechanism (server restart → low tick → client guard blocks all future updates until the new tick count naturally exceeds the old one, which for a long-running client could be effectively forever). This threatens the project's own correctness/demo-readiness goals — restarting the backend mid-demo would visibly break the UI. Fix: reset `buildingSlice`'s remembered snapshot/tick whenever the socket `connect` event fires (covers both initial connect and reconnect-after-restart), since the server always sends a fresh Snapshot immediately on connect (Story 2.1). |
| 2 | (blind-hunter, verification-gap pre-verified) No test triggers the `connect_error` handler — a regression there (wrong dispatch, or deleting the handler) would not be caught. | patch | Real, confirmed reachable by both lenses independently; trivial test addition mirroring the existing `disconnect` test. |
| 3 | (blind-hunter) No `.env.example` documents `VITE_BACKEND_URL`, which `useBuildingSocket` reads. | patch (doc-only) | Real, cheap: a contributor has no discoverable hint the variable exists. |
| 4 | (verification-gap) `resolveBackendUrl()`'s actual return value is never asserted as the argument passed to `io(...)` — a wrong env key or always-default bug wouldn't be caught. | defer | Verification-gap's own disposition: only matters once a non-default deployment target exists; no such config exists yet in this take-home project. Consistent with the project's stakes. |
| 5 | (intent-alignment) The spec's third Acceptance Criterion (manual live-backend verification) was genuinely performed — implementer reported a real browser session against the running backend, tick counter advancing 85→101 — but nothing in the spec's `Implementation Notes` records it. | patch (doc-only) | Real recording gap, not a work gap; the verification happened, just wasn't written down. Recorded directly below. |
| 6 | (blind-hunter) No root-level script runs `build`/`test` across all three workspaces together. | false | Each workspace already has its own verified `npm test --workspace=X`/`npm run build --workspace=X`; a combined convenience script is a nice-to-have, not correctness-bearing, and not worth the time against the deadline. |
| 7 | (blind-hunter) `App.tsx` renders raw `direction`/`doorState` enum strings with no note that Stories 2.3-2.5 will replace this view. | false | Already implicit from the spec's own Intent ("not the real UI — Stories 2.3–2.5 build that") and Code Map ("minimal snapshot summary"); no further doc needed. |
| 8 | (blind-hunter) The Immer/`readonly`-array workaround in `buildingSlice.ts` isn't captured anywhere reusable for future slice authors. | false | Already documented inline at the one place it currently applies; premature to generalize before a second slice actually hits the same issue. |
| 9 | (blind-hunter) Spec's "may expose the means to emit later" vs. the hook currently exposing no emit capability at all. | false | Not a contradiction — "may expose" was always permissive, not a requirement for this story; Story 2.3 will extend the hook's return signature when it needs to emit, which is a normal, expected next step. |
| 10 | (blind-hunter) `favicon.svg` has more visual polish than the "minimal, unstyled" framing suggests. | false | Harmless default Vite-template asset; not worth touching. |
| 11 | (blind-hunter) Code Map doesn't mention `frontend/src/index.css`/`setupTests.ts`. | patch (doc-only) | Real, trivial Code Map completeness fix. |
| 12 | (intent-alignment) Design Notes' reducer snippet (direct mutation) vs. shipped code (returns new object) — a documented, reasoned deviation, not silent drift. | false | Already explained inline in the code's own comment; no further action needed. |
| 13 | (intent-alignment) Task checklist boxes still unchecked despite the work being done. | patch (doc-only) | Cosmetic doc-sync fix, same pattern as prior stories. |

**Routing:** #1, #2 → patch (re-engaged step-03 implementer, includes the critical reconnect fix). #3, #5, #11, #13 → doc-only, applied directly. #4 → defer, no action needed now. All others → false, no action.

## Design Notes

```ts
// buildingSlice.ts
const buildingSlice = createSlice({
  name: 'building',
  initialState: { snapshot: null as BuildingSnapshot | null },
  reducers: {
    snapshotReceived(state, action: PayloadAction<BuildingSnapshot>) {
      if (state.snapshot && action.payload.tick <= state.snapshot.tick) return;
      state.snapshot = action.payload;
    },
  },
});
```

`useBuildingSocket` is the only frontend module touching `socket.io-client` directly — components/other hooks read the store, never the socket. This keeps the same "one adapter" discipline AD-1 established on the backend, mirrored on the client.

## Verification

**Commands:**
- `npm test --workspace=frontend` -- expected: all tests pass
- `npm run build --workspace=frontend` -- expected: zero type errors, production build succeeds
