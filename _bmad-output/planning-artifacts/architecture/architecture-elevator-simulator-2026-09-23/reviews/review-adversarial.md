# Adversarial Review — Architecture Spine (Elevator Simulator)

**Reviewer lens:** adversarial pair construction. For each finding, I construct two units (Dev A / Dev B, or the same dev on Monday vs. Friday, or backend-dev vs. frontend-dev) who each follow every applicable AD to the letter, yet produce code that is incompatible, races, or double-owns state. Every finding is a concrete hole in the spine, not a style nitpick.

Spine reviewed: `ARCHITECTURE-SPINE.md`, AD-1 through AD-8, dated 2026-09-23. No implementation exists yet (pre-code), so findings are grounded in what each AD's literal wording permits, using the domain specifics from the take-home brief (3 elevators, 10 floors, WebSocket, `docs/ARCHITECTURE.md` seed).

---

## Finding 1 — AD-2's "public commands" list has no return-value contract, so two devs build incompatible call-vs-queue semantics

**AD cited:** AD-2 (Elevator state is mutated only through itself)

**Pair:** Dev A implements `assignHallCall(floor, dir)` as `void` — fire-and-forget, the Dispatcher never learns whether the call was accepted or silently dropped. Dev B (writing `Dispatcher.reevaluatePending`) assumes `assignHallCall` returns `boolean` (accepted/rejected) so pending calls can be removed from the pending list on success. Both obey AD-2 to the letter ("mutated only from within Elevator's own methods... Dispatcher calls only Elevator's public commands") — the AD never specifies the method signature/return contract. Result: Dev B's `reevaluatePending` either never removes satisfied calls (duplicate assignment) or removes them before confirming assignment (dropped calls) — because the two sides disagree on how success is communicated across the Dispatcher/Elevator boundary.

**Fix direction:** AD-2 (or a new AD) should pin down the return-value/error contract for every public command, not just "who may call it."

---

## Finding 2 — "Own methods or current ElevatorState's handlers" is two different write paths that can both fire in one tick

**AD cited:** AD-2

**Pair:** Dev A puts door-timer countdown logic inside `Elevator.tick()` itself (an "own method"), directly setting `doorState = 'CLOSING'` when the dwell timer expires. Dev B puts the identical logic inside `DoorOpenState.onTick(elevator)` (the "current ElevatorState's handler"), also setting `doorState`. AD-2 explicitly permits *both* locations ("mutated only from within Elevator's own methods **or** its current ElevatorState's handlers") — it never says these are mutually exclusive or specifies which one owns door-timer transitions. If both exist simultaneously (e.g. Dev A didn't realize Dev B already covers it in the state class), the door slams shut twice in one tick, or the timer double-decrements. Even if only one implements it, a future maintainer reading AD-2 cannot tell which location is canonical — the AD documents a *set* of legal writers, not a single owner per field-transition.

**Fix direction:** AD-2 needs a rule like "each field-transition (e.g., door timer expiry) has exactly one designated handler location: the ElevatorState. `Elevator`'s own methods are limited to command entry points and delegation to `this.state`."

---

## Finding 3 — AD-6 says "Elevator's own queue-management method" (singular) but Car Call and Hall Call are two different insertion call sites

**AD cited:** AD-6 (Stop Queue insertion always preserves direction-order)

**Pair:** Dev A (Hall Call path) implements `Elevator.assignHallCall()` to call a private `insertStop(floor)` that inserts respecting current `Direction`. Dev B (Car Call path, working from `docs/ARCHITECTURE.md` §4 "Car call... thêm trực tiếp vào stopQueue của elevator đó theo đúng hướng hiện tại") implements `Elevator.assignCarCall()` with its *own* separate insertion logic — because nothing in AD-6 says both call sites must funnel through the *same* private method, only that some "own queue-management method" must be used. If Dev B's insertion logic has a subtly different tie-breaking rule (e.g., how it handles a Car Call to the floor the elevator is currently sitting at with doors open, or a Car Call issued while `direction === 'IDLE'`), `stopQueue` ordering is inconsistent depending on whether a stop arrived via Hall Call or Car Call — the exact overshoot bug AD-6 exists to prevent, reintroduced through the back door.

**Fix direction:** AD-6 should name the single method (e.g. `Elevator.insertStop(floor, direction)`) both `assignHallCall` and `assignCarCall` must call — not just assert "an own method" exists.

---

## Finding 3.1 — AD-6 is silent on IDLE-direction insertion, so the two insertion paths disagree on ordering when direction is IDLE

**AD cited:** AD-6

**Pair:** Elevator #3 is `IdleState`, `currentFloor = 5`, empty `stopQueue`. Two Hall Calls land in the same tick (or two Car Calls, or one of each): floor 2 and floor 8. Dev A's `insertStop` sorts ascending by floor when `Direction === 'IDLE'` (so queue becomes `[2, 8]`, elevator moves down first). Dev B's `insertStop` sorts by "nearest first" when `Direction === 'IDLE'` (queue becomes `[8, 2]` if 8 is passed first because it treats the *first* insertion as direction-setting). AD-6 only defines ordering "consistent with current Direction" — but Direction is undefined/IDLE at the moment of the first insert into an empty queue, so there is no invariant to be consistent *with*. Both devs invent a tie-break rule, and they differ.

**Fix direction:** AD-6 needs an explicit rule for queue-seeding from IDLE (e.g., "the first inserted stop sets the elevator's Direction; subsequent same-tick inserts are ordered relative to that").

---

## Finding 4 — AD-7's "exactly once at the end of that same tick" doesn't say what data `reevaluatePending` sees if `Elevator.tick()` enqueues new Pending Calls mid-loop

**AD cited:** AD-7 (Pending Call re-evaluation runs once per tick, after every Elevator has ticked)

**Pair:** Dev A implements `Elevator.tick()` such that when an elevator reaches its last stop and reverses direction, it directly notifies the Dispatcher via a synchronous callback/event that immediately appends any now-eligible Pending Calls into a local buffer — read later by `reevaluatePending()` at tick-end. Dev B implements `Elevator.tick()` to only update its own `direction`/`stopQueue` fields with no callback, trusting that `Dispatcher.reevaluatePending()` will separately scan `elevators[].direction` after all ticks complete. AD-7 says reevaluation happens "after every Elevator has ticked" and "never from inside an individual Elevator's state-transition handler" — Dev A's callback fires *during* `Building.tick()`'s elevator-iteration loop (technically still "inside" a state-transition handler's call stack, arguably violating the letter), while Dev B's pull-based approach is clean. Both plausibly claim compliance depending on how "runs from inside" is read (does it forbid the *trigger* originating inside the handler, or only the *dispatcher method invocation* itself?). If Dev A's push-callback pattern ships, Pending Call state becomes push-driven from inside the loop instead of pull-driven at loop-end — reintroducing the very race AD-7 was written to close, while textually defensible.

**Fix direction:** AD-7 should forbid any Elevator-to-Dispatcher callback/event during the per-elevator tick loop, not just forbid literally calling `reevaluatePending()` from inside a handler — i.e., mandate a pull model: `Dispatcher.reevaluatePending()` reads elevator state, elevators never push to Dispatcher during `tick()`.

---

## Finding 5 — AD-7 doesn't define tie-break when a Pending Call is satisfiable by two elevators simultaneously after the same tick

**AD cited:** AD-7, AD-5 (Dispatcher depends on Strategy interface)

**Pair:** After a tick, both Elevator #1 (now Idle at floor 5) and Elevator #2 (just reversed to MovingDown at floor 6) are simultaneously eligible for the same Pending Call (Hall Call, floor 5, DOWN). Dev A's `reevaluatePending()` iterates `pendingCalls` outer, `elevators` inner, calling `strategy.selectElevator(candidateElevators, call)` fresh per call — deterministic, picks whichever the strategy ranks best. Dev B's `reevaluatePending()` optimizes by pre-computing each elevator's eligibility once per tick and greedily assigns "first idle elevator claims first pending call in FIFO order" without re-invoking the strategy per call — a different algorithm that still satisfies AD-5 ("Dispatcher... calls only its interface method... never branches on concrete type") since it still calls `selectElevator`, just with different batching. For a building with 3+ simultaneous Pending Calls and 2 newly-eligible elevators, Dev A and Dev B assign different elevators to different calls — not a correctness bug per se, but the spine gives no invariant pinning down *which* pairing is canonical, meaning two "spec-compliant" implementations produce divergent, non-reproducible dispatch outcomes for the same input — a problem for grading/testing determinism, which the PRD's testability NFR presumably cares about.

**Fix direction:** Add a rule to AD-7 (or AD-5) mandating a canonical iteration order for `reevaluatePending` (e.g., pending calls in FIFO arrival order, elevators in fixed array order, strategy invoked once per call against the current candidate set) so behavior is reproducible and testable.

---

## Finding 6 — AD-8 "no Elevator reads another Elevator's state" collides with AD-5/Dispatcher's need to compare all elevators for Nearest-Car

**AD cited:** AD-8 (cross-instance isolation), AD-5

**Pair:** Dev A reads AD-8 literally and puts `NearestCarStrategy.selectElevator(elevators, request)` entirely inside `Dispatcher`/`scheduling/`, passing in read-only snapshots (`ElevatorSnapshot[]`, per AD-4) so no `Elevator` instance ever touches another's live fields — safe. Dev B, optimizing to avoid extra snapshot allocations every tick, has `NearestCarStrategy` accept the live `Elevator[]` array directly and call `elevator.getCurrentFloorForComparison()` (a public getter, not a raw field, technically satisfying AD-2's "no direct field touch") on each candidate while iterating — this still doesn't violate AD-2 or AD-8's literal text ("no Elevator's transition reads... another Elevator's state" — this is the *Dispatcher* reading elevators, not one Elevator reading another), but now the Strategy holds live references into mutable Elevator objects. If `Building.tick()`'s elevator-loop and the Dispatcher's post-tick `reevaluatePending()` (Finding 4) are not as strictly sequenced as Dev A assumed, Dev B's live-reference approach can read a partially-updated `Elevator` (e.g., `direction` field flipped but `stopQueue` not yet re-sorted). AD-8's isolation guarantee is about elevator-to-elevator, but says nothing about whether Dispatcher/Strategy must read *snapshots* vs *live objects* — a real gap since AD-4 defines Snapshot as the wire contract but never mandates it's also the *internal* dispatch-decision contract.

**Fix direction:** Clarify whether `SchedulingStrategy.selectElevator` operates on live `Elevator` objects or read-only snapshots/DTOs — this affects both AD-8's isolation guarantee and testability (unit-testing a Strategy against live Elevator instances vs. plain data objects is a very different test surface).

---

## Finding 7 — AD-3 "replaces, never merges" doesn't say what happens to client-local UI state keyed by IDs that vanish between Snapshots

**AD cited:** AD-3 (Snapshot replaces, never merges)

**Pair:** Dev A (frontend, Monday) builds `DestinationPanel.tsx` to track "which elevator's door-open panel is currently expanded" as local `useState` in the component, entirely outside Redux — safe under AD-3 since it's not in the store. Dev B (frontend, Friday), refactoring for consistency, "fixes" this by lifting that UI-only flag into the Redux `buildingSlice` next to the Snapshot data, reasoning that "all building-related state belongs in the store." Now, on the next `buildingState` event, AD-3's replace-not-merge rule wipes the UI flag along with the Snapshot data, because the reducer does `state = action.payload` wholesale — the panel silently collapses every ~500ms tick even while a user is actively looking at it. Both devs are AD-3-compliant; AD-3 never scopes itself to "Snapshot-derived state only" vs. "all Redux state," so Dev B's placement choice (permitted by AD-4's silence on where non-wire-contract UI state should live) breaks the UI through an entirely different mechanism than a data bug.

**Fix direction:** AD-3 or AD-4 should state explicitly that Redux slices holding Snapshot data must be *disjoint* from any slice/local-state holding client-only UI state — i.e., "replace-not-merge" only applies to (and is only safe for) state slices that are 1:1 with wire Snapshot shape.

---

## Finding 8 — AD-3 says "every buildingState event fully replaces" but doesn't address out-of-order delivery on reconnect

**AD cited:** AD-3, AD-1 (server-authoritative client)

**Pair:** Client disconnects briefly (WiFi blip) and reconnects. Dev A's `useBuildingSocket.ts` hook, on the Socket.IO `connect` event, does nothing special — it just waits for the next natural tick broadcast (~500ms), which is a full Snapshot, so AD-3's replace semantics apply trivially and correctly. Dev B's hook, trying to minimize the "stale UI for up to 500ms after reconnect" gap, calls `socket.emit('requestSnapshot')` immediately on reconnect *in addition to* listening for the regular tick broadcast — now two `buildingState` events can arrive close together (the on-demand one and the next scheduled tick one), potentially out of order if the on-demand handler is slower (e.g., server-side the request handler and the tick broadcast race on the event loop, or Socket.IO's own delivery isn't FIFO-guaranteed across a reconnect boundary with buffered acks). AD-3 guarantees each individual event "fully replaces" the slice — it says nothing about sequencing/ordering multiple events, so a stale Snapshot arriving after a fresher one (e.g., due to network reordering across the reconnect) silently overwrites newer data with older data, and nothing in AD-3 or AD-1 catches this since both events are individually valid full-replace Snapshots.

**Fix direction:** Add a monotonic tick/sequence number to `BuildingSnapshot` (a new field, or fold into AD-4's wire contract) and a rule that the client reducer drops any incoming Snapshot whose sequence number is not greater than the currently-stored one.

---

## Finding 9 — AD-1's "client never derives Elevator/Building state locally" doesn't ban client-side *interpolation*, which is a state derivation in disguise

**AD cited:** AD-1

**Pair:** Dev A renders `ElevatorCar.tsx` by snapping directly to `snapshot.currentFloor` every time a new Snapshot arrives — strictly compliant, but visually the elevator "teleports" floor-to-floor every 500ms tick with no smooth motion, which is poor UX for a demo. Dev B, wanting smooth animation between ticks, adds a `requestAnimationFrame` loop in `ElevatorCar.tsx` that linearly interpolates the car's pixel position between `previousSnapshot.currentFloor` and `currentSnapshot.currentFloor` over the ~500ms tick interval — this computes an intermediate *position value* client-side that never came from the server. Dev B can argue this isn't "Elevator/Building state" (it's a rendering-only interpolation, doesn't touch Redux, doesn't affect `direction`/`doorState`/`stopQueue`), so AD-1 is satisfied; Dev A can argue Dev B has clearly violated the *spirit* ("the client holds no simulation logic") since computing where the car "currently is" between two known points is itself a tiny simulation. The AD's wording ("computing Elevator/Building state itself") is ambiguous about derived/interpolated *presentation* values vs. authoritative *domain* values — two devs on the same team will disagree on code review about whether this is allowed, with no spine text to arbitrate.

**Fix direction:** AD-1 should explicitly carve out (permit or forbid) client-side interpolation/animation of Snapshot values between ticks, since this is a near-certain implementation temptation for a visual elevator demo.

---

## Finding 10 — AD-4 "shared/ is the single source of the wire contract" doesn't cover the doorHold/doorClose payload's elevatorId type, so backend and frontend silently disagree on ID representation

**AD cited:** AD-4

**Pair:** Dev A (backend) defines `Elevator.id` as a `number` (0, 1, 2 — array index) in `domain/Elevator.ts`, and when writing `shared/src/events.ts`, defines `DoorHoldPayload = { elevatorId: number }` to match. Dev B (frontend), building `ElevatorCar.tsx` components keyed by React `key` props, is used to string keys and — because nothing in AD-4 mandates *which side authors* the shared type first, only that both *import* from `shared/` — proposes a PR to `shared/src/events.ts` changing `elevatorId: number` to `elevatorId: string` (stringified) "for consistency with DOM/React key conventions," and updates the frontend call sites. If this PR merges without the backend socket handler being updated in lockstep (a real risk: AD-4 governs *where types live*, not a process for *coordinating changes to them*, and nothing in the spine assigns ownership of `shared/` to backend-only or requires backend sign-off on type PRs), `ws/socketHandlers.ts` receives `doorHold` events with a stringified `elevatorId` and its `elevators[Number(elevatorId)]` lookup either silently no-ops (per the spine's own "invalid client action is a silent no-op" convention in Consistency Conventions) or throws — and because errors are explicitly *not* surfaced to the client (no WS error envelope, by design), this failure is invisible in the running demo.

**Fix direction:** AD-4 should state an ownership/change-process rule for `shared/` (e.g., "type changes in `shared/` require the PR to include the corresponding backend AND frontend call-site changes in the same commit, verified by shared TypeScript project references / a single tsc build step across workspaces") — otherwise "single source of truth" only guarantees *one place to look*, not *synchronized change*.

---

## Finding 11 — AD-2/AD-6 don't define what "Elevator's own methods" may do about a Car Call to the floor the elevator currently occupies with doors open

**AD cited:** AD-2, AD-6

**Pair:** Passenger is in Elevator #1, doors open at floor 5 (`DoorOpenState`). They press the "5" car-call button again (fat-fingered or testing). Dev A's `assignCarCall(floor)` checks `if (floor === this.currentFloor) return;` — silent no-op, consistent with the Consistency Conventions table's stated pattern ("Car Call to the current floor" is explicitly called out as the no-op example). Dev B, not having read the Consistency Conventions table closely (it's a different section from AD-2/AD-6, which are the AAs actually governing `assignCarCall`), implements `assignCarCall(floor)` to always call `insertStop(floor)` unconditionally per AD-6's rule ("Hall/Car Call floors are added to stopQueue only through Elevator's own queue-management method") — since AD-6 says *how* insertion is ordered, not that same-floor calls should be filtered before reaching insertion. If `insertStop` doesn't itself guard against inserting the current floor, this either (a) re-triggers `DoorOpenState`'s dwell timer reset via a spurious re-arrival, or (b) inserts a duplicate/no-op stop that later causes an extra door-open cycle when the elevator revisits floor 5 in a future queue pass. AD-6 is silent on de-duplication and current-floor filtering — it only promises *order*, not *uniqueness* or *validity* of entries.

**Fix direction:** AD-6 should state that `insertStop` (or its caller) rejects/no-ops floors equal to `currentFloor` while `doorState !== 'CLOSED'`, and de-duplicates already-queued floors — both are ordering-adjacent invariants currently unstated.

---

## Finding 12 — AD-8 "nothing about iteration order is load-bearing for correctness" directly conflicts with AD-7's requirement of a "fixed deterministic order" for elevator ticking

**AD cited:** AD-8, AD-7

**Pair:** This is a textual tension inside the spine itself, which two devs will resolve differently. AD-7 says: "`Building.tick()` calls each Elevator's `tick()` first, in a fixed deterministic order." AD-8 says: "`Building.tick()` iterates the elevators array in a fixed order; ... nothing about the iteration order is load-bearing for correctness." Dev A reads these together and concludes order is fixed *only* for reproducibility/testability, not correctness — so Dev A feels free to parallelize the per-elevator tick loop with `Promise.all`/`elevators.forEach` in any order internally, as long as the *externally observable* result (next Snapshot) is order-independent, since AD-8 explicitly says order isn't "load-bearing for correctness." Dev B reads AD-7's "fixed deterministic order" as a hard sequencing requirement and writes a `for` loop with an explicit comment `// DO NOT parallelize, iteration order is load-bearing — see AD-7`. Both cite the spine correctly for opposite engineering decisions. In practice, since JS/Node is single-threaded and there's no real concurrency here, both produce the same observable result *today* — but the spine text itself is internally inconsistent about whether order is a correctness invariant (AD-7) or merely a testability nicety (AD-8), which will confuse any dev trying to explain why the loop is written the way it is, and is a trap if a future change (e.g., truly async elevator behavior, or Worker threads for scale) is ever introduced.

**Fix direction:** Reconcile AD-7 and AD-8's language — pick one framing (e.g., "order is fixed for determinism/testability; no correctness property depends on it since elevators are mutually isolated per AD-8") and use identical wording in both ADs.

---

## Finding 13 — AD-5's "never branches on the concrete strategy's type" doesn't prevent Dispatcher from branching on *request* type, creating a parallel undocumented seam for Hall vs. Car Call handling

**AD cited:** AD-5

**Pair:** Dev A implements `Dispatcher` with a single `handleHallCall(floor, dir)` method that always delegates floor-selection to `strategy.selectElevator(...)` — clean, AD-5-compliant. Dev B, implementing Car Call handling (per `docs/ARCHITECTURE.md` §4: "Car call... không cần dispatcher vì hành khách đã ở trong xe" — car calls bypass the Dispatcher/Strategy entirely and go straight to `Elevator.assignCarCall`), reasonably places `assignCarCall` as a direct method on `Elevator`, never touching `Dispatcher` or `SchedulingStrategy` at all. Both are individually AD-5-compliant (AD-5 only binds `Dispatcher`/`SchedulingStrategy`/`NearestCarStrategy`, and Car Call never touches those classes) — but this means `SchedulingStrategy`'s interface, and therefore the OOP/polymorphism the whole PRD is graded on (per the doc's own callout: "đây là 2 design pattern kinh điển... rất ăn điểm"), applies to *only one* of the two call types. A reviewer/interviewer probing "does your Strategy pattern actually get exercised for all dispatch decisions" will find Car Call routing has no Strategy seam at all — not a bug exactly, but a gap between what AD-5 implies ("the polymorphism the OOP requirement is graded on") and what it actually covers, and nothing in the spine flags that Car Call intentionally sits outside the Strategy pattern's scope.

**Fix direction:** Either add a line to AD-5 (or the Capability Map) explicitly stating "Car Call is intentionally out of Strategy scope — it is an in-cabin destination add with no elevator-selection decision," or reconsider whether Car Call should route through a (trivial) Strategy call for architectural symmetry and stronger OOP-pattern demonstration.

---

## Finding 14 — AD-2's command list omits any "cancel"/"remove stop" command, so doorClose-triggered re-routing and stopQueue removal-on-arrival are unowned

**AD cited:** AD-2, AD-6

**Pair:** When an elevator arrives at a queued floor, that floor must be removed from `stopQueue` (implied by `docs/ARCHITECTURE.md` §7 step 3: "khi currentFloor khớp một stop trong queue... remove khỏi queue"). AD-2's public command list is `assignHallCall`, `assignCarCall`, `openDoor`, `closeDoor` — there is no `removeStop`/`arriveAt` command listed. Dev A implements stop-removal inside `MovingUpState.onArriveFloor(elevator, floor)`, directly splicing `elevator.stopQueue` — permitted under AD-2's "or its current ElevatorState's handlers" clause. Dev B, writing `Elevator.closeDoor()` (one of the four explicitly-named public commands), decides that door-close time is *also* a reasonable moment to prune any stops that have somehow become stale/invalid (e.g., a Car Call to a floor the elevator already passed due to a race), and adds cleanup logic directly inside `Elevator.closeDoor()` itself — also permitted, since `closeDoor` is Dev B's own method on `Elevator`. Now `stopQueue` has two independent mutation sites for removal (arrival-triggered inside state handler, close-triggered inside Elevator method) that were never coordinated, and AD-6 ("inserts in position consistent with current Direction... Elevator's own queue-management method") only governs *insertion* ordering — it says nothing about removal being similarly centralized through one method, so the two removal paths can disagree (e.g., Dev B's close-time cleanup removes a floor that Dev A's arrival handler was about to process in the same tick, or vice versa, depending on call order within `tick()`).

**Fix direction:** Extend AD-6 (or add a new AD) to cover stop *removal*, not just insertion — name a single method (e.g. `Elevator.completeStop(floor)`) that is the only legal way to remove an entry from `stopQueue`, called exclusively from the arrival handler.

---

## Severity Summary

| # | Finding | Severity |
|---|---|---|
| 1 | AD-2 command return-contract unspecified | High |
| 2 | AD-2 dual door-timer write path (Elevator vs. State) | High |
| 3 | AD-6 doesn't force Hall/Car Call through one insertion method | High |
| 3.1 | AD-6 silent on IDLE-direction queue seeding | Medium |
| 4 | AD-7 doesn't forbid push-callback during tick loop | High |
| 5 | AD-7 no canonical iteration/tie-break order for reevaluation | Medium |
| 6 | AD-8 vs AD-5: live object vs snapshot for Strategy input undefined | Medium |
| 7 | AD-3 doesn't scope replace-not-merge away from client-only UI state | Medium |
| 8 | AD-3 doesn't handle out-of-order Snapshot delivery on reconnect | High |
| 9 | AD-1 ambiguous on client-side interpolation/animation | Medium |
| 10 | AD-4 "single source" lacks a change-coordination/ownership rule | Medium |
| 11 | AD-6 silent on same-floor / duplicate stop filtering | Medium |
| 12 | AD-7 vs AD-8 internally inconsistent on whether order is "load-bearing" | Low-Medium |
| 13 | AD-5 leaves Car Call entirely outside the Strategy pattern, undocumented | Low-Medium |
| 14 | AD-2/AD-6 don't centralize stop *removal* the way they centralize insertion | High |

**Total findings: 14** (exceeds the 10-minimum threshold).

## Overall Assessment

The spine's 8 ADs correctly name the major seams (domain purity, single-writer mutation, snapshot replace, shared types, strategy polymorphism, queue ordering, reevaluation timing, cross-instance isolation) but each AD tends to state *a* rule that closes the headline race it names while leaving an adjacent, same-shape race open: AD-2 governs "who may write" but not "the contract of what's written or returned"; AD-6 governs "insertion order" but not "removal" or "uniqueness"; AD-7 governs "how many times reevaluation runs" but not "what order/tie-break it uses" or "whether push during the loop counts as a violation"; AD-3 governs "replace vs merge" but not "which store slices this applies to" or "sequencing across reconnects." The recurring pattern is ADs phrased as single-example prohibitions ("Prevents: X") rather than as closed invariants — which is exactly the shape that lets two literal-compliant implementers diverge. Tightening findings 1, 2, 3, 4, 8, and 14 (the "High" severity rows) would close the races most likely to actually manifest in a 3-elevator/10-floor/500ms-tick WebSocket demo.
