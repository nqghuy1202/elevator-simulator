---
title: Reconciliation — PRD vs Architecture Spine
scope: elevator-simulator
created: 2026-09-23
---

# Reconciliation: PRD (FR-1..FR-19) vs ARCHITECTURE-SPINE.md

Method: for each PRD FR with a "Consequences (testable)" block, checked whether the consequence implies a structural/ownership/boundary rule, and if so, whether an AD, Consistency Convention, or Capability→Architecture Map row actually pins it down (vs. merely mentioning the capability exists).

## Gaps found

### GAP-1 (real, unaddressed): FR-7's re-evaluation trigger is not reconciled with AD-2's mutation-ownership rule

FR-7 requires: "Every time any Elevator goes Idle or reverses Direction, all Pending Calls are re-evaluated against FR-6." This is a cross-aggregate trigger — some component must (a) detect an Elevator's Idle/reverse transition and (b) drive Pending Calls through the Dispatcher/Strategy as a result. That component is unnamed.

AD-2 nails down *who is allowed to mutate an Elevator's own fields* (only Elevator/its ElevatorState, never Dispatcher or ws/ directly) and the Consistency Conventions state "One tick loop... is the sole driver of movement and door timing; every other entry point funnels through AD-2." But neither AD-2 nor the tick-loop line says who owns re-evaluating Pending Calls, or when in the tick that happens relative to per-Elevator `onTick`/`onArriveFloor` mutation. Concretely unanswered:
- Does `Building.tick()` call each `Elevator.tick()` first, then separately ask `Dispatcher` to re-scan Pending Calls against the now-updated Elevator states (sequential, same tick)? Or does an Elevator's ElevatorState push a "went idle / reversed" event that Dispatcher reacts to?
- If Dispatcher re-scans Pending Calls mid-tick and finds an eligible Elevator, does assigning that call go through `Elevator.assignHallCall()` (AD-2-compliant, the public command) — this should be true, but it is never stated as a rule, only inferable by extension of AD-2's existing "Dispatcher calls only public commands" clause.
- Nothing rules out a race where Pending re-evaluation reads stale Elevator state if it runs before all 3 Elevators have finished their own `onTick` in the same tick — i.e., ordering guarantee (all Elevators tick, then Pending re-evaluation runs once, not interleaved) is not stated.

This matters because it's exactly the kind of thing two independently-built units would diverge on: one implementer puts re-evaluation logic inside `Building.tick()`, another inside `Dispatcher` reacting to an event Elevator emits, a third inside each `ElevatorState.onArriveFloor()` calling back into Dispatcher directly (which would violate encapsulation/AD-2 spirit but nothing currently forbids it explicitly for this specific flow). Recommend an AD-2 addendum or new short AD naming: (a) the trigger owner (Building/tick driver vs. event-driven), (b) the ordering guarantee (all Elevator ticks complete before Pending re-evaluation runs), (c) that re-evaluation still only touches Elevators via public commands.

### GAP-2 (real, unaddressed): FR-9's Stop Queue no-overshoot/ordering invariant has no AD

FR-9 is a specific, testable structural invariant: "The Stop Queue stays ordered consistently with the Elevator's current Direction so a stop already passed is never re-approached from the wrong side... every Stop Queue floor ahead of the current position is visited in order before the Elevator reverses Direction." This is a data-structure invariant on `stopQueue` itself (ordering/insertion rule), distinct from FR-8 (which AD-2 covers implicitly via "stops only where Stop Queue and Direction agree" — that's a read/gating rule) and distinct from FR-12 (encapsulation of the field, which AD-2 does cover).

Checked every AD: AD-1 (transport boundary), AD-2 (who may write the fields, not how stopQueue must stay sorted on insert), AD-3 (Snapshot replace semantics), AD-4 (wire contract), AD-5 (Strategy interface). None specify the insertion/merge algorithm or ordering invariant for `stopQueue` when a new Hall/Car Call is added mid-route. AD-2 says stopQueue is mutated "only from within Elevator's own methods or its current ElevatorState's handlers" — that's an ownership rule, not an ordering rule. Two independently-built units could both honor AD-2 (only Elevator mutates its own queue) while one appends new calls in insertion order and the other in floor-sorted order, and only one of them avoids overshoot.

This is silently unaddressed at the spine level — it's deferred to `docs/ARCHITECTURE.md` (per the spine's own "Deferred" section note that story-level tick-loop pseudocode lives there), which may be acceptable if that doc actually specifies the insertion algorithm, but the spine itself makes no invariant claim about Stop Queue ordering, only about who's allowed to touch it. Given FR-9 is explicitly testable and directly threatens correctness (the PRD's single highest-weighted NFR), this is a gap worth flagging even if the resolution is "confirm docs/ARCHITECTURE.md covers it, or add a short AD-6."

### GAP-3 (minor/informational): FR-15 concurrency/isolation between the 3 Elevators is asserted by inference only, not stated as a rule

FR-15 requires: "One Elevator's state transition cannot block, delay, or corrupt another's in the same tick." The Capability→Architecture Map lists "Multi-elevator Coordination (PRD F7) → domain/Building.ts → Governed by AD-2." AD-2 governs *field-mutation ownership within a single Elevator* — it says nothing about `Building.tick()`'s iteration/isolation semantics across the 3 Elevator instances (e.g., that Node's single-threaded event loop already gives this for free since ticks are synchronous, or that Building must not let one Elevator's tick throw/error abort the other two's ticks in the same cycle). Practically this is likely true "for free" in a single-threaded JS tick loop (no real concurrency to corrupt), so the risk of two builders diverging is lower than GAP-1/GAP-2 — but the spine currently gives FR-15 a "Governed by AD-2" citation that doesn't actually substantiate the isolation claim, which could read as false coverage. Worth either a one-line note under AD-2 or the tick-loop convention row (e.g., "Building.tick() iterates Elevators independently; one Elevator's tick error/throw does not prevent others from ticking") or reassigning the map citation to be honest about it being an emergent property of the single-threaded tick loop rather than an explicit AD.

## Confirmed adequately covered (no gap)

- **FR-13/FR-14 (real-time sync, client never computes state):** Correctly covered. AD-1's rule explicitly states "The client never derives Elevator/Building state locally — it only renders the latest Snapshot received over the wire," and AD-3 covers full-replace-never-merge semantics preventing tab-to-tab drift (directly answers FR-14's two-tabs-never-disagree consequence). AD-4 backs this with a single shared wire-contract source. Map row cites AD-1, AD-3, AD-4 — accurate.

- **FR-16 (parameterized floor/elevator count):** Not an AD-level concern per PRD's own assumption (`[ASSUMPTION: parameterization only needs to be structurally easy... no runtime reconfiguration required]`) — a config/constructor-argument concern, not a paradigm/boundary/ownership invariant. Correctly left out of ADs; implicitly satisfiable by Building/Elevator being instantiated with count parameters. No gap.

- **FR-17 (Redux Toolkit for client state):** Covered — AD-3 governs the Redux store's replace semantics, Stack table pins Redux Toolkit 2.12.0 + react-redux 9.3.0, Structural Seed shows `frontend/src/store/`. Adequate.

- **FR-18/FR-19 (Docker + Nginx):** Covered structurally — Stack table entry, Structural Seed shows both Dockerfiles + `nginx.conf` + `docker-compose.yml`, Map row cites "Governed by: Stack" (reasonable since this is a packaging concern, not a paradigm/ownership invariant — no AD needed). Adequate; consistent with the spine's own framing that Containerization is the "lowest-cost JD alignment item."

- **AD-5 / FR-10, FR-11 (polymorphism, inheritance hierarchy):** Well covered — AD-5 for Dispatcher/Strategy, and while there's no dedicated "AD" for the ElevatorState inheritance depth (FR-11's ≥2-level hierarchy requirement), this is arguably a class-design detail rather than a cross-unit-divergence risk (both builders would reference the same PRD Glossary class names, reflected in the Consistency Conventions naming row: `ElevatorState`, `MovingState`, `IdleState`, etc., which already encodes the 2-level hierarchy by naming `MovingState` as an intermediate class distinct from `MovingUpState`/`MovingDownState`). No gap — this is a single-codebase concern, not an interop invariant, so the spine's lighter touch here is appropriate.

## Constraints (§8) check — NDA / deadline architectural consequences

- **NDA constraint:** "Repo is private, reviewer added by invite — confirmed by user." The spine's `sources` frontmatter references `_bmad-output/planning-artifacts/prds/.../prd.md` and `docs/ARCHITECTURE.md`, and the PRD itself states the original test PDF is confidential and paraphrased, not reproduced. Checked whether NDA implies anything about the **public Docker image** (FR-18/19) or repo contents: the PRD constraint is about repo *visibility* (private + invite), not about content classification of the Docker image specifically, and nothing in F1-F9 or Non-Goals suggests the Docker image would be published to a public registry — `docker-compose up` is explicitly for local reviewer use. No architectural consequence follows for the spine (no public image is in scope, no registry push is mentioned anywhere), so this is correctly *not* addressed — flagging it as checked-and-clear rather than a gap.
- **Deadline constraint (2026-09-25, scope-cutting order):** This is a process/prioritization constraint, not a structural/boundary invariant — correctly has no AD. No gap.

## Summary

Two structural gaps worth spine-author attention (GAP-1, GAP-2), one minor citation-honesty issue (GAP-3). Everything else checked (FR-13/14, FR-16, FR-17, FR-18/19, FR-10/11, NDA, deadline) is either adequately covered by an existing AD/convention/map row or correctly left out because it isn't a cross-unit-divergence risk.
