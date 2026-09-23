# Reconciliation: docs/ARCHITECTURE.md vs ARCHITECTURE-SPINE.md

Date: 2026-09-23

## Method

Read both documents in full. Compared: Design Paradigm vs §5 system architecture; AD-1..AD-5 vs the class diagram (§2), state machine (§3), and dispatch algorithm (§4); Structural Seed vs §6 folder structure; Consistency Conventions (event names, data formats) vs §5 WebSocket contract; the npm-workspace open question; the tick-loop design vs AD-2; and §8 edge cases vs the spine's rules. The task instructed to flag only genuine contradictions or missed invariants, not missing seed-level detail — the spine is supposed to be terser.

## Result: No real gaps found

Everything checked out consistent. Detail below per area.

### 1. Folder structure (Structural Seed vs ARCHITECTURE.md §6)

No conflict. The spine's structure is a strict superset/refinement of ARCHITECTURE.md's, consistent with resolving the npm-workspace question (see #3):
- ARCHITECTURE.md proposes `/backend`, `/frontend`, `/docs` at repo root with no root `package.json`. The spine adds a root `package.json` (npm workspace root) and a new top-level `shared/` package — additive, not contradictory.
- Domain, states/, scheduling/, ws/, server.ts paths under `backend/src/` match exactly (file names, subfolder names identical).
- Frontend components (`BuildingView.tsx`, `FloorHallPanel.tsx`, `ElevatorShaft.tsx`, `ElevatorCar.tsx`, `DestinationPanel.tsx`) and `hooks/useBuildingSocket.ts` match exactly.
- One deliberate, explained divergence: ARCHITECTURE.md's `frontend/src/types/shared.ts` ("copy hoặc symlink type từ backend") is replaced by the spine's top-level `shared/src/{snapshot.ts,events.ts}` package. This is the resolution of ARCHITECTURE.md's own open question (§6 note), not a contradiction — see #3.
- Spine adds `frontend/src/store/` (Redux Toolkit slices, per AD-3) and Dockerfiles/nginx.conf/docker-compose.yml, which ARCHITECTURE.md doesn't mention at all — additive, driven by PRD FR-16/FR-19, doesn't conflict with anything ARCHITECTURE.md asserts.
- A builder using both documents together would not be confused: the spine explicitly annotates `docs/ARCHITECTURE.md` in its own Structural Seed listing as "superseded by this spine for invariants; retained for full seed detail," which correctly signals precedence.

### 2. WebSocket event names (Consistency Conventions vs ARCHITECTURE.md §5 contract)

Exact match, no drift:
- Client→Server: `hallCall`, `carCall`, `doorHold`, `doorClose` — identical names and identical direction in both documents.
- Server→Client: `buildingState` — identical in both.
- Payload-level type names (`ElevatorSnapshot`, `BuildingSnapshot`) also match verbatim between ARCHITECTURE.md's TS block and the spine's AD-4 / Structural Seed (`snapshot.ts`).
- The spine correctly omits the exact field-level payload shapes (e.g. `{floor: number, direction: 'UP'|'DOWN'}`), which is expected seed-level detail per the task's framing, not a gap.

### 3. npm workspace / shared/ resolution

ARCHITECTURE.md §6 leaves this as an explicit open question: "Cân nhắc dùng npm workspace hoặc đơn giản là 2 folder độc lập với `shared/` chứa type dùng chung cho cả 2 phía" (consider npm workspace, or simply 2 independent folders with a shared/ type folder).

The spine resolves this cleanly by choosing "npm workspace root" + `shared/` package (AD-4, Structural Seed). This does not contradict anything else ARCHITECTURE.md assumes:
- ARCHITECTURE.md's own text frames the workspace-vs-two-folders choice as a `shared/`-either-way decision (the note pairs "npm workspace" with "shared/" as compatible, not opposed) — so choosing npm workspace + shared/ is a valid resolution of that either/or, not a rejection of an ARCHITECTURE.md assumption.
- ARCHITECTURE.md's `/backend` and `/frontend` each has their own `package.json`; the spine keeps both (`backend/src`, `frontend/src` each implied to remain independently buildable) while adding a root `package.json` for the workspace — consistent with npm workspaces mechanics, doesn't remove the sub-package.jsons.
- No other section of ARCHITECTURE.md assumes copy/symlink specifically (that was only ever the tentative suggestion in the open question itself), so nothing else needs to change to accommodate the shared package resolution.

### 4. Tick-loop design vs AD-2 mutation ownership

Checked for the specific concern raised: does `assignHallCall` mutate/transition state immediately, outside the tick loop, in a way that looks like it violates AD-2?

ARCHITECTURE.md §7 step 2: `Dispatcher.handleHallCall` → `NearestCarStrategy.selectElevator` → `elevator.assignHallCall(5, 'UP')` → "thêm 5 vào `stopQueue`, nếu đang Idle thì chuyển sang `MovingUpState`/`MovingDownState`" (adds to stopQueue, and if Idle, transitions to MovingUpState/MovingDownState) — this happens on hall-call receipt, not on the next tick.

This is consistent with AD-2, not a violation, because:
- AD-2's rule is about *who* is allowed to touch the fields (only `Elevator`'s own methods/its current `ElevatorState`'s handlers), not *when* (tick-bound only). AD-2 explicitly lists `assignHallCall` as one of the public commands `Dispatcher`/`ws/` are permitted to call ("Dispatcher and ws/ call only Elevator's public commands (assignHallCall, assignCarCall, openDoor, closeDoor) — never touch a field").
- `assignHallCall` is an `Elevator` method (per the class diagram in ARCHITECTURE.md §2: `+assignHallCall(floor, dir) void` is a public method on `Elevator`), so its internal mutation of `stopQueue`/state still happens "from within Elevator's own methods," satisfying AD-2's actual rule.
- The Consistency Conventions table's "State & cross-cutting" row says the tick loop is "the sole driver of movement and door timing" (movement/timing specifically) and that "every other entry point funnels through AD-2" — i.e., it already anticipates that non-tick entry points (like a hall-call arriving mid-tick-cycle) exist and are fine as long as they go through AD-2's ownership rule. No mismatch.

### 5. ARCHITECTURE.md §8 edge cases vs spine invariants

Checked each edge case for an implied invariant the spine should have (but didn't) capture:
- Multiple simultaneous hall calls / `reevaluatePending` guarantee no request is dropped — this is a behavioral/algorithmic correctness property of `Dispatcher`, covered by AD-2 (Dispatcher only calls public commands) and AD-5 (Dispatcher depends on Strategy interface); no separate ownership rule is implied beyond what AD-2/AD-5 already state.
- Hall call merge optimization at a floor where doors are already open — ARCHITECTURE.md itself marks this "tối ưu, không bắt buộc" (optimization, not required). Spine's Deferred section explicitly lists "Hall-call merge optimization and max-hold-time cap" as deferred/optional hardening — correctly captured, not a gap.
- Repeated hold presses only resetting the timer, optional max-hold-time — same Deferred bullet covers max-hold-time explicitly. Correctly captured.
- All 3 elevators busy/wrong-direction → pending queue, retried on next `reevaluatePending` — pure algorithmic behavior internal to `Dispatcher`/`NearestCarStrategy`, no cross-component ownership/invariant beyond AD-2/AD-5.
- Long `stopQueue` must stay sorted in current direction — this is an internal `Elevator` invariant, but it's an implementation-level data-structure correctness detail (how `stopQueue` orders itself), not a cross-component architectural rule; AD-2 already establishes that only `Elevator`/its state handlers may touch `stopQueue`, which is the actual architectural lever here. The sortedness requirement itself is squarely seed-level (matches ARCHITECTURE.md's class diagram note `-stopQueue SortedSet<number>` — already a data-structure choice, not a new invariant).

None of the five edge cases surfaces a cross-cutting invariant that AD-1 through AD-5 don't already govern.

## Conclusion

No contradictions and no missed genuine architectural invariants were found. The spine's paradigm, AD-1..AD-5, Consistency Conventions, Stack, and Structural Seed are all faithful, non-contradictory distillations of ARCHITECTURE.md, and the npm-workspace/shared/ open question is resolved in a way ARCHITECTURE.md's own phrasing already anticipated as compatible. This is the expected outcome of a correctly-scoped lean spine, not a sign of incompleteness.
