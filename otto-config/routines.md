# Routines

Defense against the one failure pattern that has hurt us most: a hundred tickets and no visibility into what is actually happening.

## Live pulse — every 30 minutes

Five lines to the Otto:Seb 1:1 issue. The anti-blackhole mechanism.

```
TASK:   what you are working on right now
STATUS: on track / slow / blocked
LAST:   the last concrete action you took
NEXT:   the next concrete action you will take
NEEDS:  what you need from Sebastian, or "nothing"
```

No prose. No preamble. Five lines, every thirty minutes, without fail.

## Daily cleanliness — morning

Sweep for orphaned, blocked, errored, stale, and unassigned work. Fix inside two-way doors. Also run reality check on deploy state and repo state — confirm what is actually live matches what the board says is live. Output a Cleanliness Receipt: what you found, what you fixed, what remains and why, what needs Sebastian.

## Review drain — before spawning new sessions

Clear the review queue before creating new work. Every completed session receipt gets AC-by-AC review. If review queue > 1, do not spawn new sessions until the queue is ≤ 1. This prevents the pile-up where sessions produce faster than Otto reviews, and unreviewed work stacks up with no one catching bad outputs.

```
For each receipt in queue:
1. Read the session output against acceptance criteria
2. Run the ship gate checklist
3. If pass: mark ready for merge, notify Sebastian
4. If fail: reopen with specific feedback, reassign or fix
5. Post review receipt
```

## Citizens Pilot Watch — daily (after cleanliness)

The one customer that matters right now gets dedicated attention. This routine checks for anything that could damage the pilot relationship.

```
Citizens Pilot Watch

Check:
- Any Citizens-related issue blocked > 24h?
- Any buyer funding flow error or incident?
- Any pending Citizens communication waiting on approval?
- Any Review Record gap for an active Citizens file?
- Any feedback or request from Citizens in any channel?

If any check is true: surface as Issue with fix in the daily briefing.
If all clear: one line in the briefing: "Citizens: no issues."
```

## Daily briefing — end of day

The narrative layer over the day's pulses. Seven lines:
- **Shipped** — what is live or merged, with receipts.
- **In progress** — what is moving and where it stands.
- **Blocked** — what is stuck and on what.
- **Needs Sebastian** — decisions and approvals waiting.
- **Sessions** — N active, on what, receipts returned.
- **Risks** — what could go wrong tomorrow.
- **First move** — the single thing you pick up first tomorrow.

## Weekly standards review — Friday

The culture audit. Five questions:
- Where did an agent fake progress this week?
- Where did a gate catch something and save us?
- Where did a gate create drag without catching anything?
- What correction should become canon? (3+ instances)
- What routine should be killed because it stopped earning its place?

Output as an Issue with any proposed changes staged as one-way-door proposals.
