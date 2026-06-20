# Heartbeat Protocol

Phase 0 gate plus five phases. Do not skip any phase.

## Phase 0 — Reality Check

Before planning or acting, reconcile source truth. Do not rely on memory, old comments, or prior claims when a live source can be checked.

Required fields: repo/branch/CI state, deploy state (env, URL, release SHA), active sessions and review queue, customer/file/record grounding, approval queue status. If any material field is unknown, mark work `blocked: source truth missing` and create the smallest task that discovers it.

A plan without source truth is a hypothesis, not an operating plan.

## Phase 1 — Triage

Read Letta. Scan the board. Find what changed, broke, is blocked, stale, or unassigned.

Priority order:
1. Customer/prod incident or live-file safety risk.
2. Sebastian-blocking approval or decision.
3. Active pilot work producing a Review Record.
4. Unblocking work that frees other tasks.
5. New product work.
6. Growth work.
7. Cleanliness and meta.

## Phase 2 — Execute

Take the highest-priority item per the triage order. Work it on a branch. Stage one-way doors, do not walk through them.

## Phase 3 — Review

Run the relevant checklists from workflows.md. Walk the ship gate. For external deliverables, run the banned-term scan (deterministic substring match against stems: verif-, approv-, guarant-, ensur-, secur-, prevent-, authoriz-, "clears fraud," "makes safe," "confirms account"). Any hit blocks the artifact.

## Phase 4 — Report

Write the receipt. Post the pulse if due. Self-critique gate: simulate founder reading on phone in 15 seconds — if it would fail that test, fix before shipping. Surface anything that needs Sebastian via SCQA.

## Phase 5 — Plan

Write the next move into the board and Letta. The next heartbeat wakes up oriented, not lost.

A heartbeat with no receipt and no pulse is a missed heartbeat. Silence reads as a blackhole.

## Emergency modes

**Customer-down / production incident.** Overrides normal triage. Drop current work. Fix the incident. Post SCQA immediately regardless of pulse schedule. Normal priority resumes after incident receipt is posted.

**Day-one / cold-start triage.** First activation with a large existing backlog. Do not attempt to work tickets. Spend the first full heartbeat cycle on inventory: count open/blocked/stale/orphaned issues, group by project, identify the 5 most urgent by customer impact, post a triage receipt as the first briefing. Normal operation begins on the second heartbeat.

**Sebastian unreachable (48h+).** One-way doors queue. Two-way doors continue. If a queued one-way door becomes urgent (customer impact, security), post an SCQA to the 1:1 and attempt any fallback contact channel. Work does not stop — only irreversible actions wait. If all meaningful work is blocked behind one-way doors, post a briefing explaining the queue and switch to cleanliness, documentation, and improvement work.
