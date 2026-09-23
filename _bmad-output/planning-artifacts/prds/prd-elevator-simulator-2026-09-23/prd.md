---
title: Elevator Simulator — PRD
status: final
created: 2026-09-23
updated: 2026-09-23
---

# PRD: Elevator Simulator (Node.js Interview Take-Home Test)

## 0. Document Purpose

This PRD scopes the elevator simulator built for a Junior Fullstack Developer take-home test (The Chad Digital). It is written for one reader wearing two hats: the candidate building the system, and the interview reviewer evaluating it. Features are grouped with FRs nested and globally numbered (FR-1–FR-19); assumptions are tagged inline as `[ASSUMPTION]` and indexed in §9. Full technical design (class diagrams, state machine, dispatch algorithm pseudocode, WebSocket contract, folder structure) already exists in `docs/ARCHITECTURE.md` — this PRD does not duplicate it; it defines *what* the system must do and why, ARCHITECTURE.md defines *how*.

**NDA note:** the original test prompt (`docs/BAT-Node.js - Interview Test-*.pdf`) is confidential per the test's own terms. This PRD paraphrases requirements; it does not reproduce the PDF verbatim.

## 1. Vision

Build an elevator simulator (Node.js backend, React frontend) that models 3 elevators serving a 10-floor office building in real time, correctly implementing the industry-standard SCAN/LOOK directional dispatch rule. The system exists to demonstrate — convincingly, in a 45-minute presentation — deliberate object-oriented design (encapsulation, inheritance, polymorphism), correct handling of the concurrency and edge cases inherent to multi-elevator dispatch, and enough engineering judgment to proactively align with the target role's real stack (React/Redux) and workflow expectations (Docker) beyond what the test strictly demands.

Success here is not "an elevator app that runs." It is a codebase and demo that make the underlying design decisions legible to a reviewer without narration, and a candidate who can defend every one of those decisions on the spot.

## 2. Target User

### 2.1 Jobs To Be Done
- As a **building occupant**, I need to call an elevator to my floor and get where I'm going, without wondering whether my request registered or which car is coming.
- As a **building occupant inside a cabin**, I need to select my destination and trust the elevator won't skip it or take an illogical route.
- As the **interview reviewer**, I need to read the code and watch the demo and immediately see the OOP structure and correct business rules — without the candidate having to explain it away.

*(The second persona is the PRD's real audience of consequence; the first is the in-world role the FRs are written from. Both are named because they pull in different directions — see Success Metrics counter-metric.)*

### 2.3 Key User Journey (UJ-1)

Scope dial: **Lighter** (solo take-home test, single occupant role) — the test's own worked example *is* the canonical journey:

- **UJ-1. Occupant on Floor 5 catches an elevator already headed her way.** She's on Floor 5; an elevator is mid-run from Floor 1 to Floor 10. She presses ↑ — it stops for her, because she's going the same direction it's already traveling. Had she pressed ↓ instead, nothing would happen immediately; her request queues until the car reaches Floor 10, reverses, and re-evaluates pending calls on the way down. Realizes FR-6, FR-7, FR-8.

## 3. Glossary

- **Hall Call** — a request made from a floor (not inside a cabin) specifying a floor and a desired direction (UP/DOWN).
- **Car Call** — a request made from inside an Elevator cabin specifying a destination floor.
- **Direction** — UP, DOWN, or IDLE; an Elevator's current travel direction.
- **Door State** — OPEN, OPENING, CLOSING, or CLOSED.
- **Elevator State** — the current behavioral mode (Idle, MovingUp, MovingDown, DoorOpen) governing how an Elevator responds to ticks and calls; implemented as a class hierarchy (see FR-10, FR-11).
- **Dwell Timer** — countdown that keeps doors open before auto-closing; reset by Hold, bypassed by Close.
- **Stop Queue** — the ordered set of floors an Elevator must still visit, derived from its accepted Hall Calls and Car Calls.
- **Dispatcher** — the component that assigns incoming Hall Calls to an Elevator, or defers them to Pending Calls.
- **Pending Call** — a Hall Call no Elevator can currently serve under the SCAN/LOOK rule; held for re-evaluation.
- **SCAN/LOOK Rule** — a moving Elevator only stops for a Hall Call that shares its current Direction and lies ahead of its current position.
- **Scheduling Strategy** — the interchangeable interface the Dispatcher calls to pick an Elevator for a Hall Call; Nearest-Car Strategy is the one required implementation.
- **Nearest-Car Strategy** — the Dispatcher's default rule for choosing which eligible Elevator serves a Hall Call (least distance to travel).
- **Snapshot** — the full serialized state of the Building (all Elevators + Pending Calls) sent from server to client.
- **Building** — the container for all Elevators and floors; the unit the Dispatcher operates within.

## 4. Features

*Numbering note: each `4.N` subsection is a feature group, informally referenced elsewhere as `F1`–`F9` in document order (F1 = §4.1, … F9 = §4.9). Individual requirements nested inside them are the globally-numbered `FR-1`–`FR-19` — `F#` and `FR-#` are different axes, not typos of each other.*

### 4.1 Hall Call
**Description:** An occupant at any floor requests an elevator by pressing Up or Down. The system must register the request, visibly reflect its pending status, and route it through the Dispatcher (§4.4). Realizes UJ-1.

#### FR-1: Occupant can place a Hall Call from any floor
Occupant can press ↑ (floors 1-9) or ↓ (floors 2-10) at any Floor Panel.
**Consequences (testable):**
- Pressing ↑ at floor 10 or ↓ at floor 1 is not offered (button absent/disabled).
- A placed Hall Call is immediately visible as "pending" in the UI until an Elevator is assigned.

#### FR-2: Hall Call pending state is visible until serviced
**Consequences (testable):**
- Pending indicator clears only when an Elevator opens its doors at that floor for that direction.
- A floor's ↑ and ↓ pending indicators are tracked independently — one direction being serviced does not clear the other if both were pressed.
- Pressing an already-pending direction again at the same floor does not create a duplicate request or reset its position in FR-6's assignment order.

### 4.2 Car Call
**Description:** Once an Elevator's doors open for an occupant, they select a destination from inside the cabin. Realizes UJ-1.

#### FR-3: Occupant can place a Car Call while inside an open-door Elevator
**Consequences (testable):**
- Any floor 1-10 except the current floor is selectable.
- Multiple Car Calls can be queued in a single visit; each is added to the Stop Queue in current-direction order.

### 4.3 Door Control
**Description:** While doors are open, the occupant controls dwell explicitly.

#### FR-4: Occupant can hold the door open
**Consequences (testable):** Each Hold press resets the Dwell Timer; doors do not auto-close mid-hold.

#### FR-5: Occupant can close the door immediately
**Consequences (testable):** Close cancels the remaining Dwell Timer and begins the closing transition on the next tick.

### 4.4 Dispatch Engine
**Description:** The core business-rule surface of the whole test. Governs which Elevator serves which Hall Call, and guarantees no request is ever silently dropped. Realizes UJ-1.

#### FR-6: Dispatcher assigns each Hall Call under the SCAN/LOOK rule
An eligible Elevator is Idle, or already moving in the requested Direction with the requested floor still ahead of it.
**Consequences (testable):**
- Elevator moving 1→10 accepts a Hall Call ↑ at floor 5 (ahead, same direction).
- Same Elevator does *not* immediately accept a Hall Call ↓ at floor 5 (matches the test's own worked example).
- Among eligible Elevators, the Nearest-Car Strategy selects the one with least distance to travel — this is the system's concrete implementation of the PDF's stated goal to "minimize wait times and maximize efficiency."

#### FR-7: Unservable Hall Calls become Pending and are re-evaluated, never dropped
**Consequences (testable):**
- A Hall Call with no eligible Elevator at request time is added to Pending Calls.
- Every time any Elevator goes Idle or reverses Direction, all Pending Calls are re-evaluated against FR-6.
- No Hall Call is ever discarded — it either gets assigned or remains Pending indefinitely until it can be.

#### FR-8: A moving Elevator stops only where its Stop Queue and Direction agree
**Consequences (testable):** Floors in the Stop Queue that don't match current Direction are skipped until a Direction reversal makes them reachable.

#### FR-9: Stop Queue never causes overshoot
The Stop Queue stays ordered consistently with the Elevator's current Direction so a stop already passed is never re-approached from the wrong side.
**Consequences (testable):** For any sequence of Hall/Car Calls added while an Elevator is en route, every Stop Queue floor ahead of the current position is visited in order before the Elevator reverses Direction — none are skipped and re-added out of order.

### 4.5 Elevator State Machine
**Description:** Models each Elevator's lifecycle explicitly so the OOP requirement (encapsulation, inheritance, polymorphism) is structurally unavoidable, not just claimed.

#### FR-10: Elevator and Dispatcher behavior is polymorphic, not conditional
`Elevator.tick()` and the Dispatcher's call-assignment both delegate to a runtime-substitutable object (the current Elevator State; the configured Scheduling Strategy) rather than branching on a type tag or enum.
**Consequences (testable):**
- `Elevator.tick()` contains no switch/if-chain keyed on a state name — behavior comes from invoking a method on the current Elevator State object.
- Dispatcher's call-assignment logic depends only on the Scheduling Strategy interface, not a concrete class — substituting a different Strategy implementation requires no Dispatcher code change, even though only Nearest-Car Strategy ships (§5 Non-Goals).

#### FR-11: Elevator States form a real inheritance hierarchy, not flat siblings
At least two levels deep: an abstract Elevator State base, an intermediate abstract Moving State shared by MovingUp/MovingDown, and leaf states (Idle, MovingUp, MovingDown, DoorOpen).
**Consequences (testable):** MovingUp and MovingDown states share movement logic inherited from Moving State and override only direction-specific behavior — that shared logic exists once, not duplicated across both leaf classes.

Transitions across all states (Idle, MovingUp, MovingDown, DoorOpen) are deterministic given current state + Stop Queue + Direction, and reproducible/unit-testable without a running server.

#### FR-12: Elevator's internal state is encapsulated
**Consequences (testable):** Current floor, Direction, Door State, and Stop Queue are not directly mutable from outside the Elevator; all external interaction goes through public commands (assign call, open/close door) or a read-only Snapshot.

### 4.6 Real-time Sync
**Description:** Server is the single source of truth; clients never compute simulation state themselves.

#### FR-13: Connected clients receive Building state updates in real time
**Consequences (testable):** State changes (movement, door, call assignment) reach the client without a manual refresh or polling interval longer than one simulation tick.

#### FR-14: Client renders Snapshots only — it does not compute state
**Consequences (testable):** Two browser tabs open simultaneously never disagree about Elevator position or Door State.

### 4.7 Multi-elevator Coordination
**Description:** The 3-elevator, 10-floor scale is a first-class constraint, not a config afterthought.

#### FR-15: 3 Elevators operate concurrently and independently
**Consequences (testable):** One Elevator's state transition cannot block, delay, or corrupt another's in the same tick.

#### FR-16: Building floor count and Elevator count are parameterized
**Consequences (testable):** Changing floor count or Elevator count requires a configuration change, not a code change to dispatch or state logic. `[ASSUMPTION: parameterization only needs to be structurally easy, not exposed via UI/config file — no runtime reconfiguration required for this test.]`

### 4.8 Client State Management
**Description:** Frontend state is managed deliberately to mirror the target role's real stack, not just to satisfy the test.

#### FR-17: Client-side Building/UI state is managed via Redux Toolkit
**Consequences (testable):** Snapshot data and UI interaction state (selected floor, pending Hold/Close actions) live in a Redux store, not ad hoc component state passed through props. `[ASSUMPTION: "client state" scoped to Building snapshot + interaction state; does not imply Redux is used for anything else, e.g. routing.]`

### 4.9 Containerization
**Description:** Lowest-cost JD alignment item; must not consume disproportionate time under the deadline.

#### FR-18: Application can be built and run via Docker (backend + frontend)
**Consequences (testable):** `docker-compose up` starts both backend and frontend without manual local dependency installation.

#### FR-19: Frontend is served via Nginx in the containerized setup
**Consequences (testable):** The frontend container serves the built React app through Nginx, matching the JD's Docker/Nginx bonus point.

## 5. Non-Goals (Explicit)

- Not a production elevator control system — no real hardware/IoT integration, no safety-certification concerns.
- No authentication or user accounts — single shared Building view.
- No persistence layer — Building state lives in server memory for the simulation session; a server restart resets it.
- No multi-building or multi-tenant support.
- No accessibility (WCAG) compliance work — UI is intentionally minimal, per the test's own allowance.
- No horizontal scaling / load balancing — designed for single-process demo scale (3 elevators × 10 floors), not production traffic.
- No native mobile app — web only.
- No alternate dispatch strategy beyond Nearest-Car is *required* — Strategy pattern makes one swappable in ARCHITECTURE.md, but shipping a second strategy (e.g. Round-Robin) is not in scope.

## 6. MVP Scope

### 6.1 In Scope
- F1-F9 in full, per §4 — all confirmed must-have for the 2026-09-25 deadline.

### 6.2 Out of Scope for MVP
- Round-Robin (or any second) scheduling strategy — deferred, architecture keeps it swappable.
- Hall-call merge optimization (serving a call at a floor where an Elevator is already stopped) — noted in ARCHITECTURE.md §8 as optional.
- Max-hold-time cap on Door Hold — optional hardening, not required.
- Broad automated test coverage / CI pipeline — testing scope intentionally limited to what's needed for the 45-min presentation (§7, decided by user).
- Presentation deck / slide content for the 45-min round-2 talk — tracked separately by the candidate, outside this PRD (`docs/INTERVIEW_PREP_REPORT.md` covers the outline).

## 7. Cross-Cutting NFRs

- **Correctness over polish:** every SCAN/LOOK edge case (not just the PDF's worked example) must resolve correctly — this is the single highest-weighted evaluation criterion.
- **OOP legibility:** encapsulation, inheritance, and polymorphism must be identifiable by reading the code, without the candidate narrating it.
- **Reliability:** no Hall Call or Car Call is ever silently lost (FR-7 is the load-bearing guarantee here).
- **Performance:** simulation tick rate must feel like continuous movement in the demo (ARCHITECTURE.md proposes ~500ms/tick) without overwhelming client re-renders.
- **Testability:** Dispatch logic and state transitions must be unit-testable in isolation from the WebSocket/UI layer. At minimum, `NearestCarStrategy` selection and each Elevator State's transition rules ship with unit tests — the specific pair the candidate has committed to being able to discuss in the presentation (`docs/INTERVIEW_PREP_REPORT.md` §5).
- **Deployability:** a reviewer must be able to get the full stack running locally from a single documented command (or Docker).
- **UI simplicity is permitted, not a shortfall:** the test explicitly allows a minimal, unstyled UI — time is better spent on correctness and OOP than visual polish (reinforces counter-metric SM-C1).

## 8. Constraints and Guardrails

**Deadline**
- Working code pushed to a personal GitHub repo, reviewer invited, by **2026-09-25**.
- 45-minute strategy presentation prepared for interview round 2.
- Scope-cutting order if time runs short (confirmed by user): correctness of SCAN/LOOK business rules > clear/intentional OOP > UI polish > test coverage > Docker. All F1-F9 groups are currently must-have with none pre-approved to drop — this order only applies if reality forces a cut. This does not contradict `INTERVIEW_PREP_REPORT.md`'s ranking of OOP as the top *presentation* emphasis — that ranking is about what to explain first when presenting working code, not what survives if the code itself has to be cut short.

**NDA**
- Confidentiality terms per §0 apply to every public artifact this PRD scopes.
- Repo is **private**, reviewer added by invite — confirmed by user.

**Team/Process**
- Solo developer, no design or dev team — all remaining scope must be achievable by one person in ~2 days of calendar time.
- Backend must be Node.js, frontend must be React.js — non-negotiable per the test.

## 9. Success Metrics

**Primary**
- **SM-1**: All SCAN/LOOK edge cases (not just the PDF's floor-5 example) resolve correctly under manual test — target: 100%. Validates FR-6, FR-7, FR-8.
- **SM-2**: Code-review checklist confirms all three OOP pillars are structurally present, not just claimed: (a) Elevator internal state is private/encapsulated, (b) Elevator States form a ≥2-level inheritance hierarchy, (c) `Elevator.tick()` and Dispatcher call-assignment dispatch polymorphically with no type-switch. Validates FR-10, FR-11, FR-12.

**Secondary**
- **SM-3**: Live demo runs 3 Elevators in parallel through at least the three scenarios in `docs/INTERVIEW_PREP_REPORT.md` §5 checklist (same-direction multi-stop, pending-call-due-to-direction, simultaneous nearest-car assignment) with zero dropped requests. Validates FR-7, FR-15.

*(45-min presentation content itself is out of scope for this PRD — see §6.2 — so it is not tracked as an SM here.)*

**Counter-metrics (do not optimize)**
- **SM-C1**: Time spent on JD-alignment extras (Redux, Docker) must not come at the cost of SM-1/SM-2 — a fully correct, clearly-OOP core with no Redux would still pass; a polished Redux+Docker shell around broken SCAN/LOOK logic would not. Counterbalances F8/F9 against F4/F5.

## 10. Open Questions

None outstanding — all four initial open questions (Nginx scope, Docker scope, repo visibility, presentation deck ownership) are resolved and reflected in §4.9, §6.2, and §8.

## 11. Assumptions Index

- §4.7 FR-16 — parameterization only needs to be structurally easy, not exposed via runtime UI/config.
- §4.8 FR-17 — "client state" scoped to Building snapshot + interaction state, not routing or other concerns.
