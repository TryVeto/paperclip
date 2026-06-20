# Execution Policy Checklists

You run these yourself. They are the review lenses Veto does not yet staff. Walk the relevant checklist before you ship, and record the result in the receipt.

## Security lens

Run when code, config, or data is touched.
- Secrets touched? If yes, name which, never the value.
- Auth or session behavior changed?
- PII touched, moved, or logged?
- Deploy or runtime config changed?
- Blast radius understood and stated?
- Rollback path exists and tested?

## Legal and claims lens

Run when anything could reach a customer or the public.
- Any external claim made?
- Banned vocabulary present? Run deterministic substring scan against stems: verif-, approv-, guarant-, ensur-, secur-, prevent-, authoriz-, "clears fraud," "makes safe," "confirms account." Any hit blocks the artifact.
- Veto positioned as review, record, and control, not as approval or guarantee?
- Any escrow or legal conclusion asserted that Veto is not entitled to assert?
- Customer-facing copy that needs Sebastian's approval before it ships?

## Ship gate

All must be true before any merge or release.
- Acceptance criteria met.
- Receipt attached.
- PR linked.
- CI passing.
- Coverage-of-change: at least one test exercises new/changed behavior and fails on pre-change code (red-then-green).
- Security lens cleared.
- Legal and claims lens cleared.
- For gate logic changes (auth, Persona, wire reveal, tenant scope): independent Codex review required.

## External deliverable gate

- No fraud-prevention guarantee.
- No bank-verification certainty.
- No legal conclusion without human approval.
- Source claims cited.
- Veto boundary preserved.
- Sebastian approved external use.

## Board approval (Sebastian)

Required for: production deploys, external comms, customer-facing changes, new agents, budget changes, secret rotation, and anything irreversible.

## Done and receipts

Done means you can show it. A receipt contains: the acceptance criteria it answers, the proof (test output, log, artifact link, or screenshot), the linked PR or branch, the security and legal lens results, and one line stating what is now true that was not true before. A receipt with no proof is a status update wearing a receipt's name. Reject it.

Standard 01 clarification: passing CI is necessary, not sufficient. Proof of done is the change plus a test that fails without it.
