# Paperclip v1 — Operating brief (veto-mainline / this Cursor host)

| Field | Value |
|---|---|
| Date | 2026-07-23 |
| Audience | Cursor on veto-mainline |
| Spec | `doc/plans/2026-07-23-paperclip-v1.md` (g1) |
| Supersession | `doc/plans/2026-07-23-paperclip-v0.07-supersession-receipt.md` (Path 2) |
| Artifact URL | https://veto-mainline.tail2fd504.ts.net:10000/paperclip-v1-operating-brief/ |

## Ownership split

| Owner | Owns | Does not |
|---|---|---|
| **Mac Thinking-zero** | Full v1 implementation in `paperclip-v1-full` / Mac paths from base `11f92018…` | Wait on veto-mainline to invent a parallel kernel |
| **veto-mainline Cursor** | Reversible prep + receipts + live gap mapping; finish already-approved ops | Full second kernel rewrite; v1 deploy; voidShip; fake-green v0.07 unlock |

**Do not race a second full kernel rewrite here unless Mac artifacts are absent and Sebastian re-authorizes.** This pass lands spec + receipts only.

## Hard stops (this host)

- No deploy of v1.
- No voidShip / capsule rewrite.
- No unlock or rewrite of v0.07 to PASS.
- Do not edit immutable v0.07 spec blob `c9a2782c…`.
- Do not invent product versions `v0.08` / `v0.09` as separately shipped releases.

## Reversible prep in scope now

| Prep | Notes |
|---|---|
| Inkbox receiver → Thinking-slow | Already approved; another agent may be finishing — coordinate, don’t duplicate |
| Restore fast-decision lane (Thinking-fast) | Proven on v0.06 (`9cad4cb…`); dropped in live rebuilds |
| Honest metrics / no canary-as-natural | Observation cohorts must exclude probe spam |

## Live gaps → internal proof slices (not separate versions)

| Slice | Live gap / prep mapping |
|---|---|
| **A. Truthful base** | Path 2 supersession recorded; Mac pins `11f92018…` / `9cad4cb…` still fetch residuals on this host; preserve v0.07 FAIL evidence |
| **B. Office kernel** | Mac owns full relational kernel; this host: do not start parallel rewrite |
| **C. Runtime boundaries** | Restore fast-decision + real router attestation; instruction-bundle honesty (prep only) |
| **D. Version and release** | Keep claim ladder honest; no mutable ship / no fake PASS |
| **E. Channels** | Inkbox receiver/ops + Desktop View-run prep; SMS stays `sms_unavailable` until gated |
| **F. Culture and memory** | Otto/Letta binding is Mac-led after kernel; no premature culture ship here |
| **G. Integrated cutover** | Out of scope until Mac candidate exists and Sebastian authorizes deploy |

Slices A–G are **implementation checkpoints inside one external v1**, not `v1.01` / `v0.08` / `v0.09` products.

## 5-line summary for Sebastian

1. Mac Thinking-zero owns full v1 in `paperclip-v1-full`; this host does not race a second kernel.
2. veto-mainline prep: Inkbox→Thinking-slow, restore Thinking-fast, honest metrics only.
3. Map live gaps to slices A–G; no v0.08/v0.09 product versions.
4. Stop at prep/candidate work — no v1 deploy, no voidShip, no fake-green v0.07.
5. Spec g1 + Path 2 supersession are the authority for what comes next.
