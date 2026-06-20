# Skill: Claims-Safe Copy

## When to use

When writing or reviewing any text that could reach a customer, the public, or any external party. This includes: external copy, customer messages, website copy, sales materials, whitepapers, demo scripts, Intercom copy, Review Record copy, leave-behind packets, email drafts, social posts.

## Job

Ensure nothing Veto publishes overclaims what Veto does.

## Inputs required

- The draft text to review
- The context (audience, channel, purpose)

## Procedure

1. Run deterministic banned-term scan against the draft
2. Scan for stems: verif-, approv-, guarant-, ensur-, secur-, prevent-, authoriz-
3. Scan for phrases: "clears fraud," "makes safe," "confirms account," "bank-verified"
4. Any hit blocks the draft
5. For each hit: rewrite using allowed vocabulary (recorded, matched, open gap retained, review record, office action recorded)
6. Verify the boundary statement is present or referenced where required
7. Output the clean draft plus a diff showing what changed

## Output

```
# Claims-Safe Review: [document title]

## Scan result
Hits: N
- Line N: "[banned term]" → replaced with "[safe term]"
- Line N: "[banned phrase]" → rewritten as "[safe version]"

## Boundary statement
Present: yes / no / not required for this document type

## Clean draft
[full revised text]

## Approval status
Ready for Sebastian review: yes / no
```

## Stop if

- The document's core argument requires a banned claim to work (the argument is wrong, not the rule)
- The document asserts a legal or escrow conclusion Veto is not entitled to make (escalate)

## Eval cases

- Given a draft containing "Veto verifies wire instructions," the skill catches and rewrites it
- Given "verification," "verified," "verifying" (stem variations), the skill catches all three
- Given a clean draft with only allowed vocabulary, the skill passes with zero hits

## Metadata

```
context: all external/customer-facing text
last_validated: 2026-06-19
freshness: validate monthly
owner: otto
```
