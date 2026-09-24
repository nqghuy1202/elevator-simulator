---
title: 'Door Hold/Close UI'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: 'a20d46bf7e2823ab45b9d9c88834f2014a25eaf4'
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

**Problem:** The `doorHold`/`doorClose` WS events and their domain commands (`Building.handleDoorHold` → `Elevator.openDoor`, `Building.handleDoorClose` → `Elevator.closeDoor`) have existed and been fully tested since Epic 1/Story 2.1, but nothing in the client emits either — there is no way for an occupant to hold or close the doors.

**Approach:** Add a `DoorControls` component — Hold (◁▷) and Close (▷◁) buttons — rendered by `ElevatorCar` alongside the existing `DestinationPanel`, visible only while that elevator's `doorState` is `OPEN` (per Snapshot). Selecting either emits `doorHold`/`doorClose` via an extended `useBuildingSocket`. Purely additive frontend work, mirroring the pattern Stories 2.3/2.4 established: the backend/domain/shared command path is already implemented and tested, so this story only wires the client to it.

## Boundaries & Constraints

**Always:**
- `DoorControls` is visible only while that elevator's `doorState === 'OPEN'` in the Snapshot — same gating rule `ElevatorCar` already applies to `DestinationPanel`, reused rather than duplicated.
- Pressing Hold emits `doorHold{elevatorId}`; pressing Close emits `doorClose{elevatorId}` — both are simple, stateless emits with no client-derived logic (AD-1); the server alone decides the dwell-timer effect (FR-4/FR-5).
- Each elevator's controls are independent: with multiple elevators, only the ones whose own `doorState` is `OPEN` show controls, driven per-elevator straight from that elevator's own Snapshot entry.
- All Snapshot/UI-interaction state stays in Redux/props per the existing pattern — no ad hoc component state (FR-17).

**Never:**
- No backend, domain, or `shared` changes — `Building.handleDoorHold`/`handleDoorClose`, `Elevator.openDoor`/`closeDoor`, and the `doorHold`/`doorClose` WS handlers already exist and are tested; this story is frontend-only.
- No changes to the Hall Call UI (Story 2.3) or Car Call UI (Story 2.4, both done).
- No visual polish beyond what's needed to demonstrate correctness (PRD NFR-7).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Doors open, press Hold | Elevator `E1`, `doorState: 'OPEN'` | `doorHold{elevatorId:'E1'}` emitted | No error |
| Doors open, press Close | Elevator `E1`, `doorState: 'OPEN'` | `doorClose{elevatorId:'E1'}` emitted | No error |
| Doors closed: no controls | Elevator's `doorState` is `CLOSED`/`OPENING`/`CLOSING` | No Hold/Close buttons rendered for that elevator | No error |
| Independent per elevator | Two elevators: one `OPEN`, one `CLOSED` | Only the `OPEN` elevator's controls render; the other shows none | No error |

</frozen-after-approval>

## Code Map

- `frontend/src/hooks/useBuildingSocket.ts` -- EDIT: add `emitDoorHold(elevatorId)` and `emitDoorClose(elevatorId)` to the returned object, mirroring `emitCarCall`'s `socketRef.current?.emit(...)` pattern (payload types `DoorHoldPayload`/`DoorClosePayload` already exist in `shared/src/events.ts`)
- `frontend/src/components/DoorControls.tsx` -- NEW: given `{ elevatorId, onDoorHold, onDoorClose }`, renders a Hold (◁▷) button and a Close (▷◁) button, each calling its respective callback with `elevatorId`; no visibility logic of its own (the parent gates on `doorState`, same division of responsibility as `DestinationPanel`)
- `frontend/src/components/ElevatorCar.tsx` -- EDIT: render `<DoorControls>` alongside the existing `<DestinationPanel>` inside the same `doorState === 'OPEN'` conditional block; add `onDoorHold`/`onDoorClose` props
- `frontend/src/App.tsx` -- EDIT: destructure `emitDoorHold`/`emitDoorClose` from `useBuildingSocket()` and pass them through to `ElevatorCar`
- `frontend/src/hooks/useBuildingSocket.test.tsx` -- EDIT: add `emitDoorHold`/`emitDoorClose` tests mirroring the existing `emitCarCall` one
- `frontend/src/components/DoorControls.test.tsx` -- NEW: covers Hold/Close click-to-emit
- `frontend/src/components/ElevatorCar.test.tsx` -- EDIT: cover `DoorControls`' visibility toggling alongside the existing `DestinationPanel` visibility tests, and that both wire to the correct `elevatorId`

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/hooks/useBuildingSocket.ts` -- add `emitDoorHold`/`emitDoorClose` -- client emit path, mirrors Story 2.4's `emitCarCall`
- [x] `frontend/src/components/DoorControls.tsx` -- Hold/Close buttons -- FR-4, FR-5
- [x] `frontend/src/components/ElevatorCar.tsx` -- render `DoorControls` alongside `DestinationPanel` when doors open -- reuses the existing visibility gate
- [x] `frontend/src/App.tsx` -- wire `emitDoorHold`/`emitDoorClose` through -- completes the pipeline
- [x] Frontend tests -- cover all 4 I/O Matrix rows -- NFR-5

**Acceptance Criteria:**
- Given `npm test --workspace=frontend`, when run, then all pass including new coverage
- Given `npm run build --workspace=frontend`, when run, then zero type errors
- Given the backend+frontend running live, when an elevator's doors are open and Hold is pressed, then the dwell timer visibly resets (doors stay open longer); when Close is pressed, then the elevator begins closing on the next tick (manual verification, recorded in Implementation Notes)

## Implementation Notes

- `useBuildingSocket.ts`: added `emitDoorHold`/`emitDoorClose`, mirroring `emitCarCall`'s `socketRef.current?.emit(...)` no-op-if-not-connected pattern, using the existing `DoorHoldPayload`/`DoorClosePayload` types from `shared/src/events.ts`.
- `DoorControls.tsx` (new): stateless `{ elevatorId, onDoorHold, onDoorClose }` component rendering a Hold (◁▷) and Close (▷◁) button; no visibility logic of its own, matching `DestinationPanel`'s division of responsibility.
- `ElevatorCar.tsx`: renders `<DoorControls>` inside the same `doorState === 'OPEN'` conditional block as `<DestinationPanel>` (wrapped in a fragment); added `onDoorHold`/`onDoorClose` props.
- `App.tsx`: destructures `emitDoorHold`/`emitDoorClose` from `useBuildingSocket()` and passes them through to `ElevatorCar`.
- Tests added: `useBuildingSocket.test.tsx` (emit assertions for both events), `DoorControls.test.tsx` (new, click-to-emit + per-elevator wiring), `ElevatorCar.test.tsx` (extended with a `DoorControls` visibility describe block mirroring the existing `DestinationPanel` one, covering all doorState values, re-render disappearance, prop wiring, and independence between two elevators).
- No backend/domain/shared changes were needed or made — `Building.handleDoorHold`/`handleDoorClose` and the `doorHold`/`doorClose` WS handlers were already implemented and tested (Story 2.1).

**Manual verification (live backend+frontend):**
- Ran `backend` (`npm run start`, port 3001) and `frontend` (`npm run dev`, port 5173) together and drove the UI in a real Chrome tab. Confirmed visually: `DoorControls` (◁▷ Hold / ▷◁ Close) render alongside `DestinationPanel` only while an elevator's Snapshot `doorState` is `OPEN`, and disappear on the next tick once it closes.
- The live dwell window is very short (`DOOR_DWELL_TICKS = 3` in `backend/src/domain/Elevator.ts`, ~500ms/tick), too narrow to reliably race by hand in the browser. To get a deterministic, timestamped result, wrote a throwaway Node script (`socket.io-client` connected directly to the backend, not committed) that: (1) measured the natural/baseline open-door duration by emitting a `hallCall` and watching ticks between `doorState` becoming `OPEN` and `CLOSED`; (2) repeated with a `doorHold` emitted the instant `OPEN` was observed; (3) repeated with `doorClose` emitted the instant `OPEN` was observed. Results:
  - Baseline dwell: 3 ticks open.
  - With `doorHold` emitted on open: 4 ticks open (longer than baseline) -- confirms FR-4, dwell timer reset/extended.
  - With `doorClose` emitted on open: 1 tick open (shorter than baseline) -- confirms FR-5, elevator begins closing on the next tick.
- This confirms the full client -> WS -> domain -> Snapshot -> client round trip works as specified, both from the rendered UI and at the wire level.

## Spec Change Log

## Review Triage Log

**Lenses run:** blind-hunter (7 findings), edge-case-hunter (0 findings — `[]`), verification-gap (0 gaps — "No verification gaps found"), intent-alignment (descriptive, 4 divergence points).

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| 1 | (blind-hunter) No `App`-level integration test would catch a wiring typo (e.g. `onDoorHold={emitDoorHold}` mismatched). | false / accepted precedent | Trivial, non-branching prop pass-through; verification-gap independently classified it as non-behavioral risk. Same precedent already accepted in Stories 2.3/2.4's reviews (no `App.tsx` test exists or is expected for simple wiring). |
| 2 | (blind-hunter + edge-case-hunter, same root cause) No debounce/disabled guard against rapid double-click emitting `doorHold`/`doorClose` twice. | low → reject | Edge-case-hunter confirmed this exactly mirrors the pre-existing `DestinationPanel`/`emitCarCall` click-to-emit pattern already in the codebase — not a new gap introduced by this diff, and (per Story 2.4's row #2) harmless: the effect is idempotent/stateless server-side. |
| 3 | (blind-hunter + intent-alignment, same root cause) Hold/Close glyphs (`◁▷`/`▷◁`) are visually similar and only `aria-label` is asserted, not the visible glyph/text. | low → reject | Cosmetic; PRD NFR-7 explicitly deprioritizes visual polish. No functional risk — `aria-label` is the accessibility-relevant, tested surface. |
| 4 | (blind-hunter) No test exercises keyboard-only activation (Enter/Space) of the buttons. | false / out of scope | Native `<button>` elements have built-in keyboard activation from the browser with no custom key handler added by this diff to bypass it; nothing to regress. |
| 5 | (blind-hunter) JSDoc on `DoorControls`/`useBuildingSocket` describes server-side dwell-timer effects as fact, coupling frontend docs to backend behavior that could drift. | low → reject | Documentation nit; the description is accurate as of this change and mirrors the same pattern already used in Story 2.3/2.4's doc comments. |
| 6 | (blind-hunter) No test covers an empty-string or unusual `elevatorId`. | false / out of scope | `elevatorId` always originates from a real `ElevatorSnapshot.id` populated by `Building`, never empty/malformed in practice; matches the same reasoning already applied to analogous claims in Stories 2.3/2.4's reviews. |
| 7 | (blind-hunter) No single test asserts `DoorControls` and `DestinationPanel` render together in the same `OPEN` case. | low → reject | Indirectly covered: both are independently tested against the identical `doorState === 'OPEN'` condition, and the diff wraps them in one fragment under one conditional — a regression separating them would need to break that shared conditional, which each component's own visibility tests would already catch. |
| 8 | (intent-alignment) Tests verify `elevatorId` as an opaque string flowing through correctly (prop/id-centric), not a rendered "this is car E1's panel" scenario (occupant-centric). | false | Both framings produce identical, correct behavior for this frontend-only, per-elevator-id-keyed design; no test or code distinguishes them because there's nothing behaviorally different to distinguish — not a defect. |
| 9 | (intent-alignment) FR-4/FR-5's actual dwell-timer effect is confirmed only by the recorded manual/scripted verification, not an automated test in this diff. | false / accepted precedent | Correctly out of scope per the frozen "Never: no backend changes" boundary — the dwell-timer logic itself was already tested in Epic 1/Story 2.1. Matches the same manual-verification pattern Stories 2.2-2.4 all used for their live end-to-end acceptance criterion. |
| 10 | (intent-alignment) The "independent per elevator" test uses sequential `rerender` on one component instance rather than mounting two `ElevatorCar`s simultaneously. | low → reject | Logically equivalent: each `ElevatorCar` is a pure function of only its own `elevator` prop, so two simultaneously-mounted instances behave identically to two sequential renders of the same component; a concurrent-mount variant would add no additional protection. |

**Routing:** No `high`/`medium` findings, no `intent_gap`/`bad_spec`/`patch`/`defer` entries. Review is clean on the first pass — proceeding to present.

## Design Notes

## Verification

**Commands:**
- `npm test --workspace=frontend` -- expected: all pass, including new `DoorControls` coverage and `ElevatorCar`'s extended visibility tests
- `npm run build --workspace=frontend` -- expected: zero type errors

**Manual checks (if no CLI):**
- Run backend + frontend dev servers together, wait for an elevator's doors to open, press Hold and confirm the doors stay open longer than the default dwell, then press Close and confirm the elevator begins closing on the next tick.
