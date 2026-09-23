---
name: 'Version Verification Review'
type: review
scope: 'Stack table + Design Paradigm of architecture-elevator-simulator-2026-09-23'
reviewer-lens: 'web-research / reality-check of every committed technology decision'
created: '2026-09-23'
---

# Review — Stack/Version Web-Verification Gate

## Verdict: CONDITIONAL PASS — two unverified claims must be closed before this spine is final

Most of the Stack table is backed by explicit memlog `(version)` entries citing a source. Two rows carry a version/currency claim with **no corresponding memlog verification at all**, and one row's verification is present but weaker than its peers (rationale cited, but no source for the specific version number).

## Row-by-row

| Stack row | Spine claim | Memlog backing | Status |
| --- | --- | --- | --- |
| Node.js | 24 LTS "Krypton" (24.21.0) | `(version)` line 8: "current LTS as of 2026-09, verified via web (nodejs.org release schedule)" | VERIFIED — source cited |
| TypeScript | ^5.9, not 7.0.x | `(question)` line 12 + `(decision)` line 13: TS 7.0.2 (Go rewrite, released 2026-07) identified as technically latest; 5.x chosen for stability given 2-day deadline | VERIFIED — reasoning present and sound (see below) |
| React | 19.3.0 | `(version)` line 9: "current stable as of 2026-09, verified via web (react.dev/versions)" | VERIFIED — source cited |
| Vite | 8.3.0 | `(decision)` line 17: CRA-deprecation rationale is sourced ("officially deprecated since Feb 2025"), but the version number itself is only asserted ("verified current v8.3.0") with no named source (no npm/vitejs.dev citation, unlike Node/React/Socket.IO/RTK rows) | **GAP** — currency of the specific 8.3.0 number not independently traceable to a source |
| Redux Toolkit | 2.12.0 | `(version)` line 11: "current as of 2026-09, verified via npm" | VERIFIED — source cited |
| react-redux | 9.3.0 | `(version)` line 19: "verified compatible with React 19 (peer-dep fixed, no --legacy-peer-deps needed)" | VERIFIED — source cited (compat verification, appropriate given the spine's own compat claim) |
| Socket.IO | 4.8.3 | `(version)` line 10: "current as of 2026-09, verified via npm" | VERIFIED — source cited |
| Vitest | 5.0.1 | `(decision)` line 18: rationale given (pairs with Vite, avoids Jest/Vitest config split, satisfies testability NFR) — but no `(version)` line confirming 5.0.1 is actually current/exists, unlike every other numbered row | **GAP** — version number not verified, only the choice-of-tool reasoning is |
| Docker / docker-compose | "current Docker Engine + Compose v2" | **No memlog entry whatsoever** — not in any `(version)` or `(decision)` line | **GAP** — zero verification trail for a named technology in the Stack table |
| Nginx | Named in Stack row parenthetical ("backend + frontend + Nginx") and in Structural Seed (`nginx.conf`) | **No memlog entry** — Nginx never appears in the memlog | **GAP** (minor) — no version is claimed for Nginx, so there's no currency claim to falsify, but its selection/fit as the static-serving reverse proxy was never checked against anything (e.g., whether it's still the default/recommended choice for a Vite static build vs. `serve`/Caddy/vite preview). Flag as unverified-but-low-risk since no specific version number is asserted. |

## TypeScript 5.x vs 7.0.x reasoning — assessed as sound and current

The memlog correctly identifies that TypeScript 7.0 is a genuine, significant event (the native Go-ported compiler, first shipped as a preview and later promoted to `typescript` proper) rather than a routine minor bump, and separately notes 7.0.2 as a specific released patch version dated 2026-07. Choosing the mature 5.x line for a 2-day take-home deadline — where tooling/plugin ecosystem stability outweighs the performance upside of a brand-new compiler rewrite — is a reasonable, well-justified call for this scope. No issue with this decision or its documentation.

## Vite vs create-react-app reasoning — sound, but incompletely sourced

The CRA-deprecation claim itself is specific and checkable ("officially deprecated since Feb 2025") and Vite being React's current recommended starter is accurate framing. The tool choice is sound. The gap is narrower: the *exact version pinned* (8.3.0) has no source citation in the memlog the way Node/React/RTK/Socket.IO do. Given how fast Vite's major-version cadence has historically been, an unverified major/minor number is exactly the kind of drift this review is meant to catch.

## Findings requiring action

1. **Docker Engine / Compose v2** — the Stack table asserts "current Docker Engine + Compose v2" as if it were a checked fact; the memlog shows this was never looked up. Either add a `(version)` memlog entry with a real source (docs.docker.com release notes) pinning an actual Compose v2 minor version, or soften the spine's phrasing to make clear this is an assumed baseline, not a verified one.
2. **Vitest 5.0.1** — the *choice* of Vitest is well-reasoned but the *version number* was never verified against npm/vitest.dev the way its neighbors were. Add a `(version)` memlog line or downgrade the spine to a version range instead of a precise patch pin.
3. **Vite 8.3.0** — same category as #2: rationale for the tool is sourced, the precise version is not. Add a source citation.
4. **Nginx** — no verification trail at all. Low risk since no version is pinned, but the spine should at minimum note that Nginx (vs. simpler static-serving alternatives) was a default carried from `docs/ARCHITECTURE.md` rather than a checked decision, so a future reader doesn't mistake silence for confirmation.

## Non-findings

Node.js, React, Redux Toolkit, react-redux, Socket.IO, and the TypeScript 5.x-vs-7.0 decision are all properly traceable to memlog `(version)`/`(decision)` entries with named sources or explicit reasoning. No gaps there.
