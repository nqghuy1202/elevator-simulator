# Reconciliation: INTERVIEW_PREP_REPORT.md vs prd.md

Source input: `docs/INTERVIEW_PREP_REPORT.md` (Vietnamese interview prep notes)
Target PRD: `_bmad-output/planning-artifacts/prds/prd-elevator-simulator-2026-09-23/prd.md`

Scope of this check: qualitative/strategic ideas that don't reduce to an FR — checking whether they survive somewhere in Vision, Success Metrics, Constraints, or Non-Goals, or whether the FR-shaped structure silently dropped them.

---

## 1. "AI usage in workflow" talking point (§2 JD bonus row, §3 outline step 6, §5 checklist last item)

**Status: DROPPED — not referenced anywhere in the PRD.**

The report treats "mentioning Claude Code usage in the workflow" as a JD bonus point (§2: "Điểm cộng: biết ứng dụng AI vào công việc... nên kể lại quy trình dùng AI trong lúc present") and gives it a dedicated 2-3 minute presentation slot (§3 step 6) plus a checklist prep item (§5 last bullet).

The PRD's §6.2 Out of Scope explicitly excludes "Presentation deck / slide content for the 45-min round-2 talk... tracked separately by the candidate, outside this PRD (`docs/INTERVIEW_PREP_REPORT.md` covers the outline)." That exclusion is reasonable for presentation *content*, but the AI-usage talking point is arguably closer to a JD-alignment strategy item than pure presentation content — it sits alongside Redux (FR-15) and Docker/Nginx (FR-16/17), which *did* get promoted into FRs because they're JD bonus points. AI-in-workflow is the one JD bonus-point row from §2 of the report that has no PRD trace at all — not in Vision, not in a Non-Goal explaining why it's excluded, not in Constraints. It is simply absent, with no explicit decision recorded either way.

This is arguably fine (it's a talking point about *process*, not a product feature — nothing to build), but it is worth flagging because every *other* JD-bonus row in the report's §2 table (Redux, Docker/Nginx, even the Java Spring Boot callout) left a visible mark on the PRD, and this one didn't. A reader of the PRD alone would not know "mention AI usage" was ever a considered JD-alignment tactic.

---

## 2. Priority ranking — report §4 vs PRD §8 Constraints scope-cutting order

**Status: PARTIALLY DIVERGENT — different ranking criteria, not a strict contradiction, but not reconciled either.**

Report §4 ranks *presentation/interview-performance priorities*:
1. OOP clarity (explicit requirement, will be probed deepest)
2. Correct SCAN/LOOK business rule (will be tested with off-script examples)
3. Ability to justify technical choices (WebSocket/TS/algorithm — since none were mandated)
4. Proactive JD-connection (Redux, Java Spring Boot, AI, Docker)
5. Live demo that actually runs (not just slides)

PRD §8 Constraints gives a *scope-cutting order* (what to drop first if time runs short):
"correctness of SCAN/LOOK business rules > clear/intentional OOP > UI polish > test coverage > Docker."

These are answering different questions (interview-performance emphasis vs. what code to cut under time pressure), so they aren't strictly required to match. But there is a real divergence worth flagging: the report ranks **OOP above business-rule correctness** (#1 vs #2) as the interview-priority, while the PRD's cutting order ranks **business-rule correctness above OOP** (drop OOP polish before dropping SCAN/LOOK correctness). The PRD does not acknowledge or explain this inversion — a reader comparing the two documents would reasonably ask "which one wins, and why did the ranking flip?" The PRD's own §7 NFRs states correctness is "the single highest-weighted evaluation criterion," which is consistent with its own §8 order, but that means the PRD has implicitly *overridden* the report's #1/#2 ranking without saying so.

Also note: the report's #3 (ability to justify technical choices) and #4 (JD-connection) don't appear in the PRD's scope-cutting order at all — the PRD's order is only about which *code/FR groups* to cut, not about presentation-prep priorities like "be ready to defend WebSocket vs REST." See gap #4 below for the related point.

---

## 3. Checklist section 5 — testability of prep-checklist items in the PRD

**Status: MOSTLY CAPTURED, with one partial gap.**

Checked each checklist item from report §5 against PRD success metrics / requirements:

- **Unit tests for `NearestCarStrategy` + state machine specifically** — PARTIAL GAP. PRD §7 NFRs says "Dispatch logic and state transitions must be unit-testable in isolation" (testability as a design property), and FR-9's consequence says the state model must be "reproducible and unit-testable without a running server." But PRD §6.2 Out of Scope explicitly says: "Broad automated test coverage / CI pipeline — testing scope intentionally limited to what's needed for the 45-min presentation." There is no Success Metric that actually requires unit tests to exist and pass for NearestCarStrategy and the state machine — the PRD guarantees these things are *testable in principle* (an architectural property) but never commits to the report's concrete checklist action ("có ít nhất vài unit test cho NearestCarStrategy và state machine" — have at least a few unit tests written). This is a real gap: "testable" (design quality) and "tested" (an artifact that exists, per the report's checklist) are different claims, and only the weaker one made it into the PRD.

- **README with run instructions** — CAPTURED. PRD §7 NFRs: "Deployability: a reviewer must be able to get the full stack running locally from a single documented command (or Docker)." This covers the intent even though it doesn't say "README" by name.

- **2-3 rehearsed demo scenarios** — CAPTURED, and strengthened. PRD SM-3 explicitly ties to "the three scenarios in `docs/INTERVIEW_PREP_REPORT.md` §5 checklist (same-direction multi-stop, pending-call-due-to-direction, simultaneous nearest-car assignment)" as a Secondary success metric with a live cross-reference back to the source report. This is the strongest example of the PRD faithfully carrying a report item forward.

---

## 4. Explaining technical choices during presentation (WebSocket vs REST polling, why this algorithm)

**Status: PARTIALLY CAPTURED — the underlying decisions are documented, but the *expectation to defend them* is not.**

The report frames this as a first-class prep task: §1 explicitly calls out the three undeclared-by-the-JD choices (WebSocket/Socket.IO, TypeScript, SCAN/LOOK + nearest-car) as things "bạn được quyền tự quyết định và nên chủ động giải thích lý do khi present" (you get to decide and should proactively explain why, when presenting). Report §4 priority #3 and §5 checklist both reinforce that being able to justify "why WebSocket not REST polling," "is this algorithm optimal," "how would this scale to 10 elevators/50 floors," and "what changes in Java Spring Boot" are rehearsed answers, not incidental.

In the PRD:
- The WebSocket choice is captured as a requirement (FR-11: real-time sync) and implicitly justified by Vision ("in real time") — but the PRD never states *why* WebSocket was chosen over REST polling, nor flags that this justification is an interview-defense expectation.
- The SCAN/LOOK + nearest-car algorithm choice is thoroughly justified functionally (FR-6, FR-7, FR-8, Glossary) since it *is* the core business rule — this one is well covered.
- TypeScript is not mentioned anywhere in the PRD (arguably appropriately — it's a tech-stack/architecture detail, not a product requirement, and ARCHITECTURE.md is the designated home for "how").
- Nowhere does the PRD note, even as a Non-Goal caveat or a Constraint, that the candidate is expected to be ready to articulate trade-off rationale live — this is adjacent to "presentation content" (excluded in §6.2) but is really about *design-decision defensibility*, which the PRD's own Vision statement gestures at ("a candidate who can defend every one of those decisions on the spot") without cross-referencing the report's specific rehearsed-question list (REST polling comparison, scalability to 10/50, Java Spring Boot equivalent).

So: Vision (§1, closing sentence) is the one place this idea survives in spirit — "a candidate who can defend every one of those decisions on the spot" — but it's generic and doesn't name the specific comparisons (WebSocket vs REST, algorithm optimality, scale-up, cross-stack translation) the report calls out as the actual rehearsed Q&A prep. A reader of the PRD alone would not know these specific questions were anticipated.

---

## Summary of Gaps

1. **AI-usage-in-workflow talking point** — entirely absent from the PRD (no FR, no Vision mention, no Non-Goal explanation for exclusion), unlike every other JD-bonus item in the report's §2 table which did get PRD representation.
2. **Priority ranking inversion** — report ranks OOP above business-rule-correctness for interview emphasis; PRD's Constraints scope-cutting order ranks correctness above OOP for code-cutting, with no acknowledgment of the flip or of why the two orderings differ.
3. **Unit tests as a concrete deliverable** — PRD guarantees dispatch/state logic is architecturally *testable*, and explicitly excludes "broad automated test coverage" from MVP scope, but never commits to the report's concrete checklist item of actually having unit tests for NearestCarStrategy and the state machine.
4. **Expectation to defend technical choices live** — Vision has one generic sentence ("defend every one of those decisions on the spot") but doesn't carry forward the report's specific rehearsed-question list (WebSocket vs REST polling, algorithm optimality, scale-up to 10 elevators/50 floors, Java Spring Boot translation) that section 5's checklist treats as required prep.

Items that reconciled cleanly (no gap): Redux (FR-15), Docker/Nginx (FR-16/17), README/run-instructions (NFR Deployability), and the 2-3 demo scenarios (SM-3, which directly cross-references the report).
