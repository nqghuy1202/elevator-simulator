---
title: PRD Reconciliation — Source PDF vs prd.md
created: 2026-09-23
---

# Reconciliation: `BAT-Node.js - Interview Test-231224-052639.pdf` vs `prd.md`

Source input: `docs/BAT-Node.js - Interview Test-231224-052639.pdf`
Target: `_bmad-output/planning-artifacts/prds/prd-elevator-simulator-2026-09-23/prd.md`

## Method
Read both documents in full. Walked every sentence/bullet of the PDF (Requirements paragraph, elevator-behavior instructions, floor-5 worked example, door-hold/close instructions, OOP instruction, UI-simplicity instruction, GitHub instruction, Deliverables block, NDA line) and located the corresponding PRD coverage (Vision, Glossary, §4 Features/FRs, §5 Non-Goals, §6 MVP Scope, §7 NFRs, §8 Constraints, §9 Success Metrics).

## Coverage confirmed (no gap)
- 3 elevators, 10 floors, Node.js backend + React.js frontend — Vision, FR-13/14, §8 Team/Process.
- Hall call ↑/↓ per floor, pending state — FR-1, FR-2.
- Car call from inside cabin once doors open — FR-3.
- SCAN/LOOK same-direction-only stop rule and the floor-5 worked example — Glossary ("SCAN/LOOK Rule"), UJ-1, FR-6, FR-8. Wording is arguably *more* precise in the PRD (explicit "ahead of its current position" clause) than the PDF's prose, so no loss of nuance.
- Door hold / door close buttons — FR-4, FR-5.
- GitHub push + reviewer invite — §8 Deadline bullet.
- 7-day deadline, 45-minute round-2 presentation — §8 Deadline bullet.
- NDA / non-disclosure — §0 NDA note, §8 NDA section.
- Efficient allocation across multiple elevators to minimize wait time — FR-6 (Nearest-Car Strategy), FR-7, FR-13.

## Gaps found

1. **OOP requirement is named but not made testable for inheritance/polymorphism specifically.** The PDF requires "encapsulation, inheritance, and polymorphism" as a flat, equally-weighted list. The PRD repeats all three by name in the Vision, the §4.5 feature description, and the NFR list (§7), but only **encapsulation** gets a testable FR (FR-10: state not directly mutable, only via public commands/Snapshot). No FR has testable consequences demonstrating a class hierarchy (inheritance) or interchangeable/overridden behavior (polymorphism) — e.g. a base Elevator/Strategy class with subclasses, or a dispatch strategy interface invoked polymorphically. §5 Non-Goals even explicitly *defers* the one place polymorphism would naturally show up ("No alternate dispatch strategy beyond Nearest-Car is required... shipping a second strategy is not in scope"), which weakens rather than strengthens polymorphism testability. SM-2 ("a reviewer... can identify all three OOP pillars") is a subjective code-review metric, not a testable FR-level requirement. **Net: 2 of 3 named OOP pillars lack a testable FR**, even though the task's evaluation criteria (§7, §9) treat OOP legibility as top-tier.

2. **UI-simplicity instruction is not captured as a positive requirement/constraint.** The PDF states: "You can implement a very simplistic UI in the frontend, no need to create too fancy UI, but it must be React.js based." This is a scope-easing permission plus a tech constraint. The PRD captures the React.js tech constraint (§8: "frontend must be React.js — non-negotiable") but never states the "simplistic/no need for fancy UI" allowance as its own line — it only surfaces indirectly via the WCAG non-goal ("UI is intentionally minimal, per the test's own allowance," §5) and the general "Correctness over polish" NFR (§7). Because this permission is scope-protective (it authorizes *not* over-investing in UI polish under the 2-day/7-day deadline), leaving it implicit is a minor risk: a candidate/reviewer skimming §4/§8 could miss that UI minimalism is explicitly sanctioned by the source test, not just a PRD stylistic choice.

3. **"Efficiently... to minimize wait times and maximize efficiency" framing is present but not tied to a metric.** The PDF's opening requirements paragraph states the dispatch goal in outcome terms ("allocate elevators efficiently to minimize wait times and maximize efficiency"). The PRD operationalizes this via Nearest-Car Strategy (FR-6) and SM-1/SM-3, which is reasonable, but there is no explicit wait-time-related success metric or NFR that traces back to "minimize wait times" as stated goal language — SM-1/SM-2/SM-3 are about correctness and OOP legibility, not efficiency/wait-time outcomes. This is a minor/defensible gap since Nearest-Car by definition addresses it, but the PDF's explicit efficiency framing has no direct textual echo in §7 NFRs or §9 Success Metrics.

## Non-gaps worth noting (precision check, not a gap)
- The PDF's SCAN/LOOK example uses only one elevator and one floor (5); the PRD's FR-6/FR-8 generalize this into a rule with Nearest-Car tie-breaking across 3 elevators, which is a legitimate, necessary generalization (PDF doesn't specify multi-elevator tie-break rules at all — PRD's Nearest-Car Strategy is additive, not a contradiction).
- PDF is silent on state machine states/names; PRD's FR-9 (Idle/MovingUp/MovingDown/DoorOpen) is an implementation elaboration, consistent with PDF's general "moving between floors, opening/closing doors" language — not a gap, just an elaboration.

## Summary
Overall coverage is strong — nearly every PDF sentence maps cleanly to a PRD FR, Non-Goal, or Constraint. The most material gap is #1 (inheritance/polymorphism named but not operationalized as testable FRs, despite OOP being called out as the single highest-legibility criterion). Gaps #2 and #3 are minor precision/traceability gaps rather than missing scope.
