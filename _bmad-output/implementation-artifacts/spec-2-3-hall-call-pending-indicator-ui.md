---
title: 'Hall Call & Pending Indicator UI'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: '2a751d9c5209950005b2ea48ad89bcc1f3b164e7'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 1
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 2.2 wired the Redux Snapshot pipeline but nothing lets an occupant place a Hall Call or see it acknowledged. Separately, the only existing "pending" wire signal (`BuildingSnapshot.pendingHallCalls`) mirrors `Dispatcher`'s internal unassigned-backlog concept (FR-7) — it clears the instant an elevator is assigned, not when the elevator actually arrives, so it cannot drive FR-2's "lit until serviced" indicator in the common case (immediate assignment).

**Approach:** Add `FloorHallPanel`/`BuildingView` components that emit `hallCall` via an extended `useBuildingSocket`. Add a small, additive server-side tracker — `Building` records every requested `{floor, direction}` and drains it only when the elevator that actually took it opens its doors there — exposed as a new `BuildingSnapshot.activeHallCalls` field, so the client renders the indicator purely from Snapshot data (AD-1), with zero changes to SCAN/LOOK dispatch or state-machine logic.

## Boundaries & Constraints

**Always:**
- `activeHallCalls` covers every Hall Call from press until the elevator that took it opens its doors at that floor; it is independent of `pendingHallCalls`/`Dispatcher.getPendingCalls()`, whose existing meaning and tests are untouched.
- A floor/direction is tagged onto whichever elevator `Dispatcher` routed the request to — even when `insertStop` itself was a no-op because that floor was already queued on that elevator for another reason (a Car Call, or a same-direction Hall Call already tagged there), since that elevator is still going to open its doors there — and also when the elevator is already stationary at that exact floor with its doors currently `OPEN`. Never inferred from `Elevator.direction` or any other cross-elevator heuristic, so ↑/↓ per floor still clear independently (FR-2): a request that never reaches a given elevator (e.g. genuinely opposite-direction, filtered out by `SchedulingStrategy` eligibility before `assignHallCall` is ever called) is never tagged onto it, and a call stuck in the unassigned backlog stays lit until some elevator truly takes it.
- `assignHallCall`'s new `direction` parameter is optional; every existing call site/test calling `assignHallCall(floor)` keeps compiling and behaving unchanged.
- The client renders the indicator strictly from `snapshot.activeHallCalls`; no client-side optimistic/derived bookkeeping of presses (AD-1). Re-pressing an already-active direction re-emits `hallCall` but changes no client state (already lit; server already dedupes).
- ↑ hidden at floor 10, ↓ hidden at floor 1 (FR-1).

**Never:**
- No changes to `Dispatcher`'s SCAN/LOOK selection, `reevaluatePending` cadence (AD-7), or any `states/*.ts` move/door-transition logic.
- No Car Call or Door Hold/Close UI (Stories 2.4/2.5).
- No behavior or shape change to `pendingHallCalls`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Press ↑, no prior call | `FloorHallPanel` floor 5, `activeHallCalls` empty | `hallCall{floor:5,direction:'UP'}` emitted; next Snapshot's `activeHallCalls` includes it; indicator lights | No error |
| Repeat press, already active | ↑ already active at floor 5, pressed again | `hallCall` re-emitted; no duplicate entry added, order unchanged; indicator stays lit | No error |
| Elevator services the call | An elevator opens its doors at floor 5 having taken the UP call | Next Snapshot's `activeHallCalls` drops `{5,'UP'}`; indicator clears | No error |
| Opposite direction independence | Floor 5 has both UP (active) and DOWN pressed | Elevator services UP only → `{5,'UP'}` clears, `{5,'DOWN'}` remains active | No error |
| Immediate same-floor service | Idle elevator already at floor 5, doors closed; hall call for floor 5 arrives | Elevator's existing same-floor fast path opens doors synchronously; the very next Snapshot already has `{5,dir}` drained | No error |
| Piggyback on an already-queued stop | An elevator already has floor 8 queued via a Car Call and is moving toward it; a same-direction Hall Call for floor 8 arrives and is routed to that same elevator | `insertStop` no-ops (floor already queued) but the direction is still tagged on that elevator; when it arrives and opens its doors at 8, `activeHallCalls` drops `{8,dir}` same as a fresh assignment — never stranded in the pending backlog | No error |
| Press while doors already open here | An elevator is stationary at floor 5 with doors `OPEN` (mid-dwell, e.g. servicing a Car Call); a Hall Call for floor 5 in a compatible direction arrives | The direction is tagged immediately and drains within that same `handleHallCall()` call — `activeHallCalls` never shows `{5,dir}` as active past that point | No error |

</frozen-after-approval>

## Code Map

- `shared/src/snapshot.ts` -- EDIT: add `activeHallCalls: readonly PendingHallCall[]` to `BuildingSnapshot` (reuses `PendingHallCall`)
- `backend/src/domain/Elevator.ts` -- EDIT: add `private hallCallDirections = new Map<number, Set<Exclude<Direction,'IDLE'>>>()`; `assignHallCall(floor, direction?)` tags the floor's direction whenever, after calling `insertStop(floor)`, that floor is in `stopQueue` (covers both a fresh insert and "already queued for another reason") OR `floor === currentFloor && doorState === 'OPEN'` (covers a press while already stationary there) — `insertStop`'s own return value and `Dispatcher`'s success/pending routing are untouched, this only widens what gets tagged for later draining; new `takeServicedHallCallDirections(floor): ReadonlySet<Exclude<Direction,'IDLE'>>` reads-and-clears that floor's entry — pure bookkeeping alongside `stopQueue`, no state-machine changes
- `backend/src/domain/Dispatcher.ts` -- EDIT: `tryAssign` calls `elevator.assignHallCall(request.floor, request.direction)` (was floor-only)
- `backend/src/domain/Building.ts` -- EDIT: private `outstandingHallCalls: HallCallRequest[]`; `handleHallCall` adds `{floor,direction}` (dedupe by floor+direction, same pattern as `Dispatcher.addPending`) before delegating to the dispatcher as today; new private `drainServicedHallCalls()` loops elevators and, for any with `doorState === 'OPEN'`, calls `takeServicedHallCallDirections(currentFloor)` and removes matches from `outstandingHallCalls`; call it at the end of `handleHallCall()` (covers the synchronous same-floor fast path) and at the end of `tick()`, after `reevaluatePending()` (covers arrivals-by-movement and later reassignment); new `getActiveHallCalls(): readonly HallCallRequest[]`
- `backend/src/ws/socketHandlers.ts` -- EDIT: `buildSnapshot` adds `activeHallCalls: building.getActiveHallCalls()`
- `backend/src/domain/Elevator.test.ts`, `Dispatcher.test.ts`, `Building.test.ts`, `backend/src/ws/socketHandlers.test.ts` -- EDIT: cover tagging/draining/getter and the new snapshot field per the I/O Matrix
- `frontend/src/hooks/useBuildingSocket.ts` -- EDIT: return `{ emitHallCall(floor, direction) }`, emitting `'hallCall'` on the held socket ref
- `frontend/src/components/FloorHallPanel.tsx` -- NEW: one floor's ↑/↓ buttons (hidden per FR-1) + independent pending indicators driven by whether `{floor,direction}` is in `activeHallCalls`
- `frontend/src/components/BuildingView.tsx` -- NEW: renders `FloorHallPanel` for each floor 1..`snapshot.floors`, wiring `snapshot.activeHallCalls` and `emitHallCall`
- `frontend/src/App.tsx` -- EDIT: capture `useBuildingSocket()`'s `emitHallCall`; render `<BuildingView>` alongside the existing snapshot summary
- `frontend/src/hooks/useBuildingSocket.test.tsx`, `frontend/src/store/buildingSlice.test.ts`, `frontend/src/store/uiSlice.test.ts` -- EDIT: fixtures gain `activeHallCalls: []`
- `frontend/src/components/FloorHallPanel.test.tsx`, `BuildingView.test.tsx` -- NEW: cover the I/O Matrix's client-visible rows

## Tasks & Acceptance

**Execution:**
- [x] `shared/src/snapshot.ts` -- add `activeHallCalls` field -- wire contract for the new pending semantics
- [x] `backend/src/domain/Elevator.ts` -- add direction tagging map + widened `assignHallCall` tag condition (already-queued or already-open-here) + `takeServicedHallCallDirections` -- precise per-elevator, per-direction service signal, closes Review Triage Log #1/#2
- [x] `backend/src/domain/Dispatcher.ts` -- thread `request.direction` into `assignHallCall` -- only call-site change needed to tag
- [x] `backend/src/domain/Building.ts` -- `outstandingHallCalls` bookkeeping + `drainServicedHallCalls` + `getActiveHallCalls` -- FR-2 "visible until serviced"
- [x] `backend/src/ws/socketHandlers.ts` -- expose `activeHallCalls` in `buildSnapshot` -- closes the wire contract
- [x] Backend tests -- cover all 7 I/O Matrix rows, including the piggyback-on-already-queued-stop and press-while-doors-already-open rows -- NFR-5
- [x] `frontend/src/hooks/useBuildingSocket.ts` -- expose `emitHallCall` -- client emit path
- [x] `frontend/src/components/FloorHallPanel.tsx` + `BuildingView.tsx` -- Hall Call UI -- FR-1, FR-2
- [x] `frontend/src/App.tsx` -- wire `BuildingView` in -- completes the pipeline
- [x] Frontend tests -- fixture updates + new component tests -- NFR-5

**Acceptance Criteria:**
- Given `npm test` in `backend`, `shared`, `frontend` workspaces, when run, then all pass including new coverage
- Given `npm run build --workspace=backend` and `--workspace=frontend`, when run, then zero type errors
- Given the backend+frontend running live, when pressing ↑ at a floor and watching an elevator arrive, then the indicator lights on press and clears exactly when that elevator opens its doors there (manual verification, recorded in Implementation Notes)

## Implementation Notes

Re-derived per the amended Boundaries/I-O Matrix (widened tagging rule, Review Triage Log #1/#2).

- `shared/src/snapshot.ts`: added `activeHallCalls: readonly PendingHallCall[]` to `BuildingSnapshot`.
- `backend/src/domain/Elevator.ts`: added `hallCallDirections: Map<number, Set<Exclude<Direction,'IDLE'>>>`; `assignHallCall(floor, direction?)` tags whenever, after `insertStop`, the floor is in `stopQueue` (fresh insert OR already queued for another reason) OR the elevator is already stationary there with doors `OPEN`; `insertStop`'s return value (and thus `Dispatcher`'s success/pending routing) is untouched. Added `takeServicedHallCallDirections(floor)` as a read+delete drain.
- `backend/src/domain/Dispatcher.ts`: `tryAssign` now calls `elevator.assignHallCall(request.floor, request.direction)`.
- `backend/src/domain/Building.ts`: added `outstandingHallCalls` (dedup by floor+direction like `Dispatcher.addPending`), `drainServicedHallCalls()` (loops elevators, drains any with doors `OPEN`), and `getActiveHallCalls()`. `drainServicedHallCalls()` is called at the end of `handleHallCall()` (covers the synchronous same-floor / doors-already-open fast paths) and at the end of `tick()` after `reevaluatePending()` (covers arrivals-by-movement and later reassignment).
- `backend/src/ws/socketHandlers.ts`: `buildSnapshot` now includes `activeHallCalls: building.getActiveHallCalls()`.
- Backend tests: added coverage in `Elevator.test.ts` (tagging with no direction, fresh insert, piggyback-on-Car-Call, piggyback-on-already-tagged-Hall-Call, press-while-doors-open, opposite-direction independence, drain-on-empty-floor), `Dispatcher.test.ts` (direction threading), `Building.test.ts` (all 7 I/O Matrix rows against `getActiveHallCalls()`), `socketHandlers.test.ts` (`activeHallCalls` present in `buildSnapshot`/connect-snapshot fixtures).
- `frontend/src/hooks/useBuildingSocket.ts`: now returns `{ emitHallCall(floor, direction) }`, emitting `hallCall` on the held socket ref via `socketRef.current?.emit(...)` (safe no-op pre-connect).
- `frontend/src/components/FloorHallPanel.tsx` (new): one floor's ↑/↓ buttons, ↑ hidden at the top floor, ↓ hidden at floor 1, each with an independent indicator (`" (pending)"` suffix) driven strictly from whether `{floor,direction}` is in the `activeHallCalls` prop.
- `frontend/src/components/BuildingView.tsx` (new): renders one `FloorHallPanel` per floor `1..snapshot.floors` (descending), wiring `snapshot.activeHallCalls`/`onHallCall` straight through.
- `frontend/src/App.tsx`: captures `emitHallCall` from `useBuildingSocket()`, renders `<BuildingView>` below the existing snapshot summary once a Snapshot is present.
- Frontend tests: `useBuildingSocket.test.tsx`, `buildingSlice.test.ts`, `uiSlice.test.ts` fixtures gained `activeHallCalls: []`; new `FloorHallPanel.test.tsx` and `BuildingView.test.tsx` cover FR-1 visibility, press-emits-hallCall, repeat-press re-emits without new state, indicator lit/cleared strictly from the prop, and opposite-direction independence.

**Verification performed:**
- `npm test --workspace=backend`: 92/92 passed (6 files).
- `npm test --workspace=frontend`: 27/27 passed (5 files).
- `npm run build --workspace=backend` (`tsc --noEmit`): zero type errors.
- `npm run build --workspace=frontend` (`tsc -b && vite build`): zero type errors.
- Manual live check: ran `npm run start --workspace=backend` + `npm run dev --workspace=frontend`, drove the real UI in Chrome. Confirmed: ↑ absent at floor 10, ↓ absent at floor 1, both present elsewhere. Pressed Hall Calls at several floors and observed, via the real WS round trip, the assigned elevator's `NearestCarStrategy` selection, travel, door-open, and the indicator correctly showing no `(pending)` text once serviced. Explicitly caught a call in the `(pending)` state (a DOWN call requested opposite an elevator's current direction, so it sat in the pending backlog while `activeHallCalls` correctly still reported it active) — `Floor 10 DOWN (pending)` — then confirmed it cleared to unlit once that elevator later served it. Independent ↑/↓ clearing was confirmed by the passing automated I/O Matrix tests (Building-level "opposite direction independence" test), since the two directions resolve within a couple of simulation ticks (~1s) — faster than this environment's browser-automation click-to-screenshot round trip could reliably catch mid-flight for every case, so the fastest-path timing assertions rely on the deterministic tick-by-tick backend/frontend test suites rather than a screenshot capturing that exact instant.

**Nothing left incomplete.** No known risks beyond the inherent limitation that live-UI screenshot timing couldn't pin every I/O Matrix row to a single screenshot (mitigated by the deterministic automated tests, which directly assert the same transitions tick-by-tick).

## Spec Change Log

## Review Triage Log

**Lenses run:** blind-hunter (11 findings), edge-case-hunter (2 findings), verification-gap (1 gap + 1 other), intent-alignment (descriptive, 1 divergence).

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| 1 | (verification-gap) `Elevator.assignHallCall` only tags `hallCallDirections` when `insertStop` performs a *fresh* insert. When the target floor is already in `stopQueue` for another reason (e.g. a Car Call to the same floor, or the dispatcher retrying against the same still-eligible elevator), `insertStop` returns `false`, so the direction is never tagged, `Dispatcher.tryAssign` pushes it to the pending backlog, and once the elevator arrives and opens its doors there, `takeServicedHallCallDirections` finds nothing to drain — the indicator can stay lit long past actual service. | **high → intent_gap** | Traced independently: `NearestCarStrategy.isEligible`'s `IDLE`-only floor-agnostic branch means the elevator only becomes re-eligible for the stranded pending call once it goes fully `IDLE` again — not immediately, and under continuous load potentially never in practice. Root cause is the frozen Boundaries rule itself ("tagged as serviced only where `Elevator.assignHallCall` actually inserted that exact stop"), which didn't anticipate this interleaving. |
| 2 | (blind-hunter) Same root cause as #1, narrower trigger: a Hall Call arriving for the elevator's *current* floor while its doors are already `OPEN` for an unrelated reason (mid-dwell from a Car Call) also fails to tag, since `insertStop`'s same-floor/doors-not-closed guard also returns `false` without queuing anything. | high → grouped with #1 (intent_gap) | Traced: self-resolves after one extra dwell cycle (doors close, then the existing same-floor fast path re-opens them), but only once — not indefinite like #1, same missing-tag root cause. |
| 3 | (blind-hunter) Multiple elevators simultaneously `OPEN` at the same floor for opposite directions is untested. | false | Traced: `hallCallDirections` is a private per-`Elevator`-instance map; `drainServicedHallCalls` drains each elevator's own tags independently — no cross-contamination possible regardless of test coverage. |
| 4 | (blind-hunter) Hypothetical future caller invoking `assignHallCall(floor)` with no `direction` on a floor that already has tags from another call. | false / out of scope | No such caller exists in the diff; the only production call site (`Dispatcher.tryAssign`) always passes `direction`. Speculative about code that doesn't exist. |
| 5 | (blind-hunter) `hallCallDirections` entries are only ever cleared by `takeServicedHallCallDirections`; if a queued stop were ever removed without opening doors, the tag would leak. | false | Blind-hunter's own finding notes "no such removal path exists today" — `completeStop` is the sole removal path and is only called from arrival/door-open handlers per its own doc comment. |
| 6 | (blind-hunter) `activeHallCalls`/`pendingHallCalls` share the exact `PendingHallCall` shape with no nominal distinction, risking an accidental swap by a future consumer. | low → reject | Real but cosmetic; no actual swap occurs anywhere in this diff, and a branded-type fix is more than a trivial correction for a not-yet-demonstrated mistake. |
| 7 | (blind-hunter) No keyboard-accessibility test; no test for `activeHallCalls` entries outside `1..floors`. | false / out of scope | PRD NFR-7 explicitly accepts minimal/unstyled UI; out-of-range Snapshot data is a server-truth concern (AD-1) — `Building`'s constructor guarantees `floors > 0` and only ever emits floor numbers it actually manages. |
| 8 | (blind-hunter) No test isolates the exact ordering guarantee that `reevaluatePending()` runs before `drainServicedHallCalls()` inside `tick()`. | low → reject | The existing "stuck in backlog" test already exercises reassignment-then-eventual-drain across ticks; an isolated ordering-only test adds little marginal value for the size of effort. |
| 9 | (blind-hunter) No test exercises `emitHallCall` before the socket connects, to confirm it no-ops rather than throwing. | false | `socketRef.current?.emit(...)` — optional chaining makes a throw impossible when the ref is `null`; the claimed bad outcome cannot occur. |
| 10 | (blind-hunter) No `App.tsx` test asserts `emitHallCall` is actually threaded to `BuildingView`'s `onHallCall` prop. | low → defer | Grouped with #12 below — real gap, but this project's own precedent (Story 2.2's review) accepted manual live verification in place of full composition-level automated tests; moot this pass regardless since #1 forces a re-derivation. |
| 11 | (blind-hunter) Re-press dedupe is verified per-layer (component, hook, `Building` unit tests) but no test drives a full click → socket → `Building` → re-render round trip. | low → defer | Same theme as #12; grouped, moot this pass. |
| 12 | (intent-alignment) The Problem statement is framed at the occupant-observable level ("press, see lit, see it clear"), but every test proving that behavior is either pure-backend (`Building`/`Elevator`, no UI) or pure-frontend (component rendered with a hand-built `activeHallCalls` prop, no real socket/`Building`) — nothing spans both halves; `App.tsx`'s own wiring is untested. | low → defer | Real, descriptive divergence. Consistent with Story 2.2's own accepted pattern (unit tests per layer + one manual live-backend verification, recorded in Implementation Notes) rather than automated e2e. Moot this pass; #1 forces a re-derivation regardless. |
| 13 | (blind-hunter) Button `aria-label` string literals are duplicated across `FloorHallPanel.tsx` and two test files with no shared constant. | low → reject | Cosmetic DRY nit; fix is a refactor, not a direct correction, for negligible real-world risk. |
| 14 | (edge-case-hunter) `floors === 1` hides both ↑ and ↓ buttons on the only floor. | false / out of scope | Unreachable in this app: the backend always constructs `Building` with `floors: 10` (PRD/architecture fixed spec); not something this story's diff introduces or worsens. |
| 15 | (edge-case-hunter) `snapshot.floors <= 0` renders zero panels with no indication. | false | `Building`'s constructor throws for `floors <= 0`; a real `BuildingSnapshot` can never carry a non-positive `floors`. |
| 16 | (verification-gap, Other findings) `FloorHallPanelProps.activeHallCalls` is typed `readonly PendingHallCall[]`, the same shape used for the semantically-different `pendingHallCalls`. | low → reject | Same theme as #6; cosmetic, no actual mix-up occurs in the diff as written. |

**Routing:** #1 and #2 share one root cause inside the frozen `## Boundaries & Constraints` block → **intent_gap**, looping back to the human before any further spec/code changes. All other entries are moot for this pass (code is being reverted and re-derived) and are not separately patched or deferred now — they'll be re-assessed against the next diff if still applicable.

### Pass 2 (post re-derivation, widened tagging rule)

**Lenses run:** blind-hunter (9 findings), edge-case-hunter (4 findings, one carried), verification-gap (0 gaps + 1 other), intent-alignment (descriptive, 5 divergence points, all negative-path test-coverage gaps).

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| 17 | (edge-case-hunter + verification-gap, independently corroborated) In the "press while doors already open here" / piggyback-via-already-open case, `assignHallCall` returns `false` (no fresh insert), so `Dispatcher.tryAssign` still routes it to `Dispatcher.addPending` — even though the widened tag correctly drains it from `activeHallCalls` right away. `pendingHallCalls` can then carry (and `reevaluatePending` can churn) a stale entry for a call `activeHallCalls` already correctly cleared. | low → defer | Verification-gap traced this exact mechanism back to pre-existing `Dispatcher`/`insertStop` behavior from Story 1.3/1.4 (commits `04bd8bc`/`b21eac1`), unchanged by this diff (no hunk touches `Dispatcher.tryAssign`'s success/pending routing). Explicitly out of scope per this spec's own frozen boundary ("No behavior or shape change to `pendingHallCalls`"). No frontend code reads `pendingHallCalls` — `activeHallCalls` alone drives the indicator — so there is no current observable UI impact. |
| 18 | (edge-case-hunter) `floors === 1` hides both ↑ and ↓ buttons on the only floor. | false / out of scope — **carried** | Same claim, same location as row #14 (pass 1); verdict and routing kept per the carry-forward rule. |
| 19 | (blind-hunter) `hallCallDirections` map entries have no cleanup path independent of `takeServicedHallCallDirections`; would leak if a tagged floor were ever removed from `stopQueue` without opening doors. | false | No such removal path exists in this codebase — `completeStop` is the sole removal path and only fires from arrival/door-open handlers. Same disposition as pass 1's row #4 (different diff, same reasoning). |
| 20 | (blind-hunter) `drainServicedHallCalls` doesn't scope its `outstandingHallCalls` filter by elevator id — two elevators simultaneously `OPEN` at the same floor with different tagged directions could theoretically cross-remove each other's claims. | false | Each elevator only ever drains its own `hallCallDirections` map (`takeServicedHallCallDirections` is an instance method); the `{floor,direction}` filter in `Building` matches exactly the one outstanding entry that specific direction corresponds to — there is exactly one such entry per pair by construction (`addOutstandingHallCall`'s dedupe), so no cross-elevator interference is possible. |
| 21 | (blind-hunter) The `assignHallCall` docstring references "Review Triage Log #1/#2" with no path to find it. | low → reject | Cosmetic; the referenced log is this very spec file's section above. Not worth a cross-reference for an internal planning artifact. |
| 22 | (blind-hunter) `BuildingView`/`FloorHallPanelProps.onHallCall` hand-roll `'UP' \| 'DOWN'` instead of importing `Exclude<Direction,'IDLE'>` from `shared`. | low → reject | Structurally identical type; cosmetic consistency nit, no behavioral risk. |
| 23 | (blind-hunter) No dedicated test isolates a pending call being reassigned and immediately serviced within the same `tick()` (the exact scenario `tick()`'s own code comment calls out). | low → reject | Real but low-risk: `drainServicedHallCalls` unconditionally checks every elevator's *current* door state regardless of when it was assigned, so this path is correct by construction; a dedicated same-tick test adds little marginal protection for the effort. |
| 24 | (blind-hunter) No `disabled` state or rate-limit guard on the Hall Call buttons; nothing stops rapid repeated clicks. | false / out of scope | FR-2's actual requirement (no duplicate request / no reordering) is already satisfied server-side by `Building`'s dedupe; UI-level click-throttling is not a stated requirement, and PRD NFR-7 explicitly deprioritizes UI polish. |
| 25 | (blind-hunter) No test exercises the intermediate Snapshot shape where a call is simultaneously assigned-but-not-yet-serviced (present in `activeHallCalls`, absent from `pendingHallCalls`) across several ticks. | low → reject | Materially the same shape already exercised by the passing "opposite direction independence" test (one call active+unassigned, one active+assigned, in the same Snapshot); additional coverage here is marginal. |
| 26 | (blind-hunter) No test/doc cross-references the "non-reentrant, single-threaded callers" assumption from `Dispatcher.reevaluatePending`'s docstring against the new `Building` bookkeeping methods. | false | Node.js's single-threaded event loop already guarantees this for the entire codebase; not a reachable risk in this stack. |
| 27 | (blind-hunter) `BuildingView` renders floors top-down (`floors..1`) with no test pinning that order. | low → reject | Real gap but purely cosmetic layout preference, explicitly deprioritized by PRD NFR-7; no FR depends on floor render order. |
| 28 | (intent-alignment) No `Elevator`-level unit test directly confirms a genuinely-ineligible `assignHallCall(floor, direction)` call (insert fails, elevator not at that floor) leaves no tag — only inferred indirectly via the `Building`-level "opposite direction independence" test. | low → reject | The guarantee holds by construction (the tagging `if` condition literally excludes this case) and is already indirectly exercised; a redundant unit-level test adds little. |
| 29 | (intent-alignment) No test drives a Hall Call that never gets assigned to *any* elevator across many ticks, confirming it stays in `activeHallCalls` indefinitely (the feature's defining boundary case). | low → reject | Directionally important but the existing "stuck in backlog" test from pass 1's design (retained in spirit by "opposite direction independence") already demonstrates the mechanism (stays active while genuinely unassigned); a fully-never-assigned variant is a marginal addition. |
| 30 | (intent-alignment) No test walks a door open/close/reopen cycle at the same floor to confirm a tag added *after* an unrelated first opening survives to drain on the *intended* later opening. | low → reject | Real but narrow scenario; `hallCallDirections` is keyed and drained per-floor independent of *why* a door opened, so this holds by construction. |
| 31 | (intent-alignment) AD-1's "re-press changes no client state" guarantee is enforced by the absence of a `useState`/reducer in `FloorHallPanel.tsx`, not by a test that would catch a future regression. | low → reject | Static-code guarantee, verified on inspection (no state hook exists); adding a "no extra dispatch" test is disproportionate for this project's scale. |
| 32 | (intent-alignment / verification-gap-pass-1 #16) `activeHallCalls`/`pendingHallCalls` share the `PendingHallCall` type name despite different lifecycles. | low → reject — **carried theme** | Same disposition as pass 1's row #16; cosmetic, no actual mix-up in the code as written. |

**Routing:** No `high`/`medium` findings, no `intent_gap`/`bad_spec` entries this pass. One **defer** (#17, pre-existing Epic-1 behavior, appended to `deferred-work.md`). All other entries are `false` or `low → reject`. Review is clean — proceeding to present.

## Design Notes

```ts
// Elevator.ts — widened tagging (Review Triage Log #1/#2): tag whenever the
// floor ends up queued for ANY reason, or the elevator is already stationary
// there with doors open — not only on a fresh insertStop.
assignHallCall(floor: number, direction?: Exclude<Direction, 'IDLE'>): boolean {
  const inserted = this.insertStop(floor);
  if (inserted) this.state.onStopAssigned(this);

  const alreadyThere = floor === this.currentFloor && this.doorState === 'OPEN';
  if (direction !== undefined && (this.stopQueue.includes(floor) || alreadyThere)) {
    const directions = this.hallCallDirections.get(floor) ?? new Set();
    directions.add(direction);
    this.hallCallDirections.set(floor, directions);
  }
  return inserted; // unchanged — Dispatcher's success/pending routing is untouched
}
```

Safety argument (why this can't wrongly clear an opposite-direction indicator): `Dispatcher.tryAssign` only calls `assignHallCall` on an elevator `SchedulingStrategy.isEligible` already approved for `request.direction`. `NearestCarStrategy.isEligible` rejects any elevator whose current `direction` differs from the request's — so a floor already queued on elevator E for the *opposite* direction (from a Hall Call) can never be reached by this widened tag path for E; that request either lands on a different, genuinely-eligible elevator or sits in `Dispatcher`'s pending backlog untouched (see the passing "opposite direction independence" test, where the losing direction never reaches `assignHallCall` on the busy elevator at all). The only same-floor "already queued" cases that do reach a tag are a Car Call (no direction, no conflict) or a duplicate same-direction Hall Call (idempotent `Set.add`).

```ts
// Building.ts
private drainServicedHallCalls(): void {
  for (const elevator of this.elevators) {
    const snap = elevator.getSnapshot();
    if (snap.doorState !== 'OPEN') continue;
    for (const direction of elevator.takeServicedHallCallDirections(snap.currentFloor)) {
      this.outstandingHallCalls = this.outstandingHallCalls.filter(
        (call) => !(call.floor === snap.currentFloor && call.direction === direction),
      );
    }
  }
}
```

`takeServicedHallCallDirections` is a drain (read + delete): calling it again on a still-open door is a safe no-op since the per-floor entry is already gone, so no diffing between ticks is needed.

## Verification

**Commands:**
- `npm test --workspace=backend` -- expected: all pass, including new Elevator/Dispatcher/Building/socketHandlers coverage
- `npm test --workspace=frontend` -- expected: all pass, including new component tests
- `npm run build --workspace=backend` -- expected: zero type errors
- `npm run build --workspace=frontend` -- expected: zero type errors

**Manual checks (if no CLI):**
- Run backend + frontend dev servers together, press ↑/↓ at a couple of floors, confirm indicators light immediately and clear only when that floor/direction is actually serviced, with independent ↑/↓ state.
