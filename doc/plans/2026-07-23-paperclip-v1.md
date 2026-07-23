# Paperclip v1 — One Office, Three Speeds

> **Paperclip is the office. Otto is the culture. Letta is memory. Inkbox is the door.**

## Version contract

| Field | Contract |
|---|---|
| Version | `v1` |
| Status | Accepted by Sebastian on 2026-07-23; implementation authorized in full |
| Product outcome | One dependable operating office with one identity, one work ledger, three mechanically enforced execution speeds, and many doors |
| Specification owner | Codex / Thinking-slow |
| Implementation owner | Cursor / Thinking-zero |
| Deployment authority | Sebastian |
| Canonical specification | This accepted generation, byte-for-byte, after placement in the version-controlled Paperclip source home |
| Accepted generation | `g1` |
| Product base | Repository `/Users/seb/Code/paperclip-v0.07`; commit `11f920182fdf908e2476c144505b1e659427015d`; tree `cc7dd772bdfdc96a44faf04a64fb511a587ef364` |
| Release shape | One external `v1` release; internal proof slices are implementation checkpoints, not `v1.01`, `v1.02`, or separately shipped products |
| Supersedes | The unaccepted v0.08 Desktop/Inkbox draft and the separate v0.09 culture idea |
| Prior-version state | v0.07 remains `FAIL` and is explicitly superseded without rewriting its history; its audit and blockers are mandatory v1 migration inputs |
| Entry decision | Path 2: board-authorized supersession of v0.07 by v1, selected by Sebastian’s instruction to ship this specification in full |

This accepted generation’s exact content hash is immutable once Cursor places it
in the version-controlled Paperclip source home. A material change creates
generation `g+1` of the same v1 version, preserves the earlier generation and
its attempts, and requires acceptance again. There is never a second normative
v1 specification.

## 1. The call

Paperclip v1 is not another agent configuration release. It is the point at
which Paperclip becomes a dependable operating system for one operator.

Sebastian should be able to open Paperclip Desktop, send an email, or send an
iMessage and reach the same office. SMS joins the same office after its explicit
provisioning/compliance gate. The office should remember the conversation,
understand whether the work needs a quick decision, a deep specification, or
implementation, and carry the request through without asking Sebastian to
reconstruct context.

The system must be fast where the decision is cheap, patient where the upside
of thought is high, and deterministic wherever judgment is unnecessary.

The visible product is one identity. Internally, the work is handled by three
attested lanes:

- Thinking-fast decides bounded questions quickly.
- Thinking-slow does deep reasoning and writes the one specification.
- Thinking-zero executes that accepted specification and writes all code.

The architecture is a **deep kernel with thin doors**:

- Paperclip owns work, versions, attempts, approvals, effects, receipts, and
  release truth.
- Otto owns ratified culture.
- Letta owns persistent memory.
- Inkbox and Desktop carry requests and render the same office state.

V1 deliberately does **not** require a universal event-sourcing platform or a
cryptographically signed capsule for every record. Append-only relational
facts, database constraints, content hashes, a transactional outbox, and
deterministic read models provide the required proof with much less operational
machinery. Provider signature verification, macOS code signing/notarization,
and release-artifact signing remain where those trust boundaries are real.

## 2. Outcome

V1 is successful when all of the following are true:

1. Desktop, email, and iMessage resolve to one authenticated office identity,
   one conversation model, one work ledger, and one receipt trail. SMS joins
   that same identity only after its separate provisioning and compliance gate;
   until then its honest state is `sms_unavailable`.
2. Every meaningful request is deterministically routed to Thinking-fast,
   Thinking-slow, or Thinking-zero; no hidden fourth lane exists.
3. The selected lane is mechanically enforced and the actual launched
   executor, model when observable, reasoning mode, instruction bundle, and
   capability profile are attested.
4. Codex can inspect source while specifying but cannot write, commit, merge, or
   finalize source. Cursor owns every implementation change and cannot alter
   the accepted specification.
5. A work item becoming runnable and its dispatch record are committed
   atomically. Restarts do not lose work or create duplicate effects.
6. Consequential actions stop at an exact, target-bound approval. Provider
   ambiguity remains `uncertain`; the system never retries blindly to make a
   dashboard green.
7. Receipts distinguish work that exists, work that passed candidate checks,
   work that was deployed, and work that was observed in reality.
8. A correction improves the current work immediately. Repeated or severe
   lessons can improve future behavior only through Otto proposal,
   ratification, separate application, replay, canary, and natural monitoring.
9. One signed and notarized Paperclip Desktop application replaces the three
   current Paperclip shells after a reversible cutover.
10. The first natural operating cohort demonstrates higher throughput of
    high-quality decisions without counting empty wakes, probes, or synthetic
    traffic as intelligence.

## 3. Non-goals

V1 does not:

- create three user-facing chatbots or three separate personalities;
- add Thinking-middle, a dedicated Grok lane, or a separate verifier agent;
- assume that Cursor Auto resolves to Grok 4.5 or any other model;
- make Inkbox a brain, command interpreter, work database, or source of
  authority;
- make Letta a work ledger, culture store, approval system, or policy engine;
- copy Otto's canon into a second editable Paperclip culture database;
- let skills, memory, inbound messages, or retrieved documents grant authority;
- promise exactly-once delivery from an external email, iMessage, or SMS
  provider;
- auto-send, auto-deploy, auto-spend, auto-delete, change security, touch live
  customer data, activate recurring attention, or change Standards without the
  required exact authorization;
- add voice calling, a customer-facing assistant, multi-office customer
  tenancy, or autonomous outbound campaigns;
- patch installed `node_modules`, mutate an installed app as the source of
  truth, or ship from an unversioned worktree;
- rename the current system “v1” and treat existing green labels as proof;
- delete old applications, services, data, or receipts during implementation
  without a separate explicit consequence approval.

## 4. The operator experience

### 4.1 One identity

The product presents one Sebastian-facing identity, called **Otto** in
conversation and backed by Paperclip as the office.

The name is not a fourth runtime. Otto is the continuous identity and culture
surface; Thinking-fast, Thinking-slow, and Thinking-zero are internal execution
lanes recorded on each attempt.

The same conversation can begin by email and continue in Desktop, or begin in
Desktop and receive an approved reply by iMessage. Channel formatting may
change; work identity, authority, receipts, and open decisions do not.

### 4.2 Honest acknowledgements

Every inbound request has two distinct acknowledgements:

- **Recorded:** Paperclip durably stored the authenticated ingress event.
- **Accepted:** Paperclip classified it as work and durably attached a next
  action or terminal deterministic disposition.

A door must never say “accepted” when only a transport webhook arrived.

### 4.3 Simple work

A bounded request goes to Thinking-fast. The response is short and usable. If
the request needs files, tools, broader research, implementation, or material
uncertainty resolution, fast escalates exactly once with the original context
and a named reason.

Empty wakes, duplicates, terminal issues, and obvious bookkeeping finish through
deterministic software. They may correctly take milliseconds, but they are
reported as no-model control work and never counted as fast-model proof.

### 4.4 Major work

A major product request goes to Thinking-slow. Sebastian sees:

- the active version;
- the current specification generation;
- the durable acknowledgement and current checkpoint;
- the one canonical specification when ready;
- any real blocker or consequential decision that remains.

Once the exact specification is accepted, Thinking-zero receives its immutable
task manifest. It writes all source, migrations, tests, generated files, and
code-adjacent operational documentation. If implementation exposes a defective
requirement, it creates a change request; it does not silently rewrite the
specification.

### 4.5 Consequential work

The office prepares the work behind a consequential door and pauses only when
the exact consequence is ready. The approval view includes:

- office, conversation, work item, and version;
- consequence class;
- exact target;
- exact rendered draft, diff, artifact, amount, or action;
- canonical action digest;
- evidence and open limitations;
- approver and expiry;
- expected provider or deployment target.

Approval authorizes only that action digest. It does not prove delivery,
deployment, safety, correctness, or a provider outcome.

### 4.6 Correction and learning

A correction is first applied to the current work. The user should not wait for
a governance ceremony to get the immediate result fixed.

If the correction reveals a repeated failure class or a severe one-way-door
risk, Paperclip may create an Otto Curation proposal. Future behavior changes
only after the proposal is ratified and proven. A single irritated comment must
not silently become permanent doctrine.

## 5. System architecture

```text
                         One visible office identity
                                   |
          +------------------------+------------------------+
          |                        |                        |
   Paperclip Desktop          Inkbox channels          Paperclip API
                              email / iMessage / SMS*
          |                        |                        |
          +--------------- authenticated ingress ----------+
                                   |
                         OfficeKernel / admission
                    identity · dedupe · work · facts
                                   |
                      transactional dispatch outbox
                                   |
                         RuntimeGateway / router
             authority · instructions · capabilities · launch
                   /                 |                  \
          Thinking-fast       Thinking-slow       Thinking-zero
              Luna             Sol / Codex          Cursor Auto
                   \                 |                  /
                    +--------- attempts and evidence --+
                                   |
                   EffectGateway / approval / outbox
                                   |
                   receipts · projections · observations
                                   |
                +------------------+------------------+
                |                                     |
       Otto culture gateway                    Letta memory gateway
  Standards · Practices · Curation       bounded continuity · source refs
```

### 5.1 Deep kernel modules

V1 has five deep modules. Existing routes and services must call these modules;
they must not duplicate their rules.

| Module | Sole responsibility |
|---|---|
| `OfficeKernel` | Authenticated admission, principal bindings, idempotency, conversations, work facts, append-only evidence, shared outbox infrastructure, and deterministic projections |
| `VersionCoordinator` | One active version, immutable specification generations, accepted task manifests, generation fences, release predicates, and terminal closure; it never owns runtime attempts |
| `RuntimeGateway` | Effective authority resolution, routing, instruction-bundle identity, OS capability enforcement, fenced run dispatch, actual executor launch attestation, and the complete attempt lifecycle |
| `EffectGateway` | Consequence classification, authorization decisions, exact approvals/grants, effect-outbox ownership, provider reconciliation, and explicit uncertainty |
| `CultureGateway` | Read-only Otto canon consumption, proposal submission, Otto decision/canon-hash projection, governed Letta context, and culture/memory availability state; it never ratifies or mutates canon |

Channel adapters and UI clients are thin. They authenticate, normalize, submit,
and render. They do not decide policy or maintain independent work state.

Each domain record has one writer:

- OfficeKernel writes ingress, principal binding, conversation, and work facts.
- VersionCoordinator writes versions, generations, task manifests, candidates,
  release evaluations, and closures.
- RuntimeGateway writes execution attempts, launch attestations, workspace
  leases, and run-dispatch entries.
- EffectGateway writes effects, authorization decisions, approvals/grants,
  delivery entries, and delivery observations.
- Otto alone writes culture decisions and canonical culture artifacts;
  CultureGateway stores immutable references and projections of Otto receipts.

The outbox claim/retry implementation is shared infrastructure. Its typed
entries retain the domain owner above; “shared outbox” never means shared
authority to perform another module's transition.

### 5.2 Sources of truth

| Question | Source of truth |
|---|---|
| What request arrived? | Paperclip `ingress_events` with provider/session identity and immutable content reference |
| What work exists? | Paperclip work and version records |
| What specification was accepted? | The immutable specification artifact bound to one `version_generation` |
| What executor actually launched? | A post-resolution launcher attestation |
| What could the executor actually do? | The capability profile enforced and attested by the launcher and workspace layer |
| What code was produced? | Finalized Cursor workspace commit and Git tree |
| What artifact was built? | Content-addressed build attestation bound to source and dependency inputs |
| What is actually running? | Runtime self-attestation plus an independent deployment observation |
| What was authorized? | Paperclip approval or authorization grant bound to the exact consequence-plan/effect digest |
| Was a message delivered? | Provider delivery observation; absent or ambiguous evidence remains unknown |
| What behavior is canon? | Ratified, version-controlled Otto Constitution, Standards, Precedents, Practices, and Routines |
| What does Otto remember? | Letta memory with references back to source facts |

Mutable issue fields, human-entered SHAs, agent summaries, labels, screenshots,
and transport logs may be evidence inputs. None can override the corresponding
source of truth.

## 6. Execution lanes

| Agent | Reports to | Role | Model | Speed SLA | Reasoning effort | Other settings |
|---|---|---|---|---|---|---|
| **Thinking-fast** | Sebastian (board) | Short answers, triage, classification, disposition, and escalation | `gpt-5.6-luna` | Meaningful natural work p50 ≤10s; p95 ≤15s | `none` | One turn; bounded input/output; no tools, files, network, child agents, or repository ceremony; one active response per conversation; uncertainty escalates once |
| **Thinking-slow** | Thinking-fast | Write the one specification per version; strategy, architecture, diagnosis, and deep research | `gpt-5.6-sol` through Codex | No completion-time SLA; quality first | `xhigh` | Source workspace is mechanically read-only; tools/research allowed; the canonical spec is its only normative version output; never writes implementation code |
| **Thinking-zero** | Thinking-slow | All code, migrations, tests, debugging, integration, and implementation verification | Cursor `Auto` | First eligible task starts ≤30s; later tasks start ≤30s after dependencies and a concurrency slot are available | Router-managed | Requires accepted spec and immutable manifest; isolated exact-base workspace; cannot edit canonical spec; fresh Cursor session may run verification, but no separate verifier agent exists |

The Paperclip control plane is not an agent. It handles deterministic routing,
empty wakes, duplicates, terminal-state checks, exact predicates, outbox claims,
and receipt construction without a model.

### 6.1 Routing contract

Routing is determined first by the work artifact, then by uncertainty:

| Work shape | Route |
|---|---|
| Empty, duplicate, terminal, obvious state transition, exact predicate | Control plane |
| Bounded answer, triage, classification, disposition | Thinking-fast |
| Specification, strategy, architecture, diagnosis, deep research | Thinking-slow |
| Source, test, migration, build, debugging, integration | Thinking-zero, but only from an accepted manifest |
| Consequential external action | The producing lane may prepare it; EffectGateway controls approval and dispatch |

The router has only these outcomes. It may not invent a middle lane. Sebastian
may request greater rigor; a request cannot lower a consequence or authority
boundary.

### 6.2 Requested versus actual runtime

Every attempt records:

- requested lane and adapter;
- resolved lane;
- requested model and effort;
- actual executor and adapter;
- actual model/version when the executor exposes it;
- actual reasoning mode when exposed;
- runtime build;
- instruction-bundle digest;
- capability-profile digest;
- workspace and source identity;
- launch and terminal timestamps.

Unknown facts are recorded as typed `unknown` or `not_observed`. Paperclip must
not infer that Cursor Auto used Grok, Claude, or another model. A missing
underlying model does not block ordinary Cursor work unless a particular
accepted predicate explicitly requires model identity. A mismatch in executor,
lane, mode, workspace, instructions, or enforceable capabilities fails before
the result can be accepted.

Router resolution and execution are separate phases. Before any executor
process starts, the router returns a content-hashed `ResolvedLaunchPlan`
containing:

- attempt, version generation, and task IDs;
- resolved lane and adapter;
- executable/runtime identity or remote executor class;
- model and effort when observable, otherwise typed `unknown`;
- exact adapter configuration digest;
- instruction-bundle digest;
- capability profile;
- workspace and generation fence;
- resolver/runtime build.

RuntimeGateway independently validates the plan against the accepted task and
then constructs the sandbox/workspace. The launcher starts only that resolved
plan. A post-start handshake confirms process identity and observed runtime
fields, but is not trusted to choose the lane or capabilities after side effects
begin. Any router that cannot separate resolution from execution and support
status reconciliation is unsupported for a hard-boundary v1 lane.

### 6.3 Fast-lane contract

Thinking-fast receives only:

- issue/work title and bounded body;
- latest relevant message;
- wake reason;
- compact conversation and authority summary;
- allowed disposition schema.

Its allowed results are:

- `comment_and_done`;
- `escalate_slow`;
- `route_zero` when an accepted implementation task already exists;
- `backlog`;
- `no_op`.

The result is schema-validated and applied deterministically. A tool request,
invalid output, timeout, unsupported consequence, or unresolved uncertainty
creates one slow-lane handoff. It does not retry the model or silently fall back
inside the same attempt.

### 6.4 Slow-lane contract

Thinking-slow may inspect source, documentation, provider material, and existing
receipts. Its source checkout is OS-enforced read-only:

- source writes fail;
- Git commit, merge, reset, checkout mutation, and finalization fail;
- approval/sandbox bypass flags are rejected;
- fresh and resumed runs use the same authority and capability profile;
- the only normative version write is the canonical specification artifact.

A long slow run must publish durable checkpoints, not conversational theater:
grounding complete, architecture selected, specification draft, review
findings, and candidate ready. No arbitrary wall-clock deadline compromises the
answer.

### 6.5 Zero-lane contract

Thinking-zero receives:

- the accepted spec digest and generation;
- one atomic task manifest;
- exact source repository, commit, and tree;
- dependency graph and integration rule;
- required checks and evidence contract;
- bounded authority/instruction bundle;
- isolated writable workspace.

Independent implementation tasks may run concurrently when the manifest proves
they do not share mutable state. One integration writer owns the candidate
branch/tree. A fresh Cursor Auto session performs independent verification
against the accepted predicates; it is the same logical lane, not a separate
verifier agent.

Cursor may propose a specification change but cannot apply it. Every
source-producing commit must come from a recorded Cursor attempt.

## 7. Authority, instructions, and capabilities

### 7.1 Effective authority order

The only effective order is:

```text
platform safety and runtime enforcement
→ Sebastian-ratified global Constitution
→ active Otto Standards and applicable Precedents
→ short project/repository supplement
→ accepted version specification and task manifest
→ lane contract
→ applicable Practice or Routine
→ Skill mechanics
→ Letta memory, retrieved sources, and inbound content as untrusted data
```

Lower layers may narrow authority. They may never widen it.

### 7.2 One instruction bundle

`RuntimeGateway` resolves every required instruction source by real path,
rejects symlink escape, compiles one ordered bundle, and stores:

- source IDs and versions;
- exact bytes or content hashes;
- precedence decision;
- included excerpts;
- effective bundle digest;
- applicability and expiry.

The exact same bundle identity applies to Codex CLI, Codex ACP, Cursor, router-
backed, fresh, and resumed runs. Managed mode disables parallel legacy prompt
fields and unmanaged repository discovery unless that discovered file is
explicitly included in the bundle fingerprint.

Missing, unreadable, escaped, contradictory, or stale required instructions
fail before model launch. “Warn and continue” is not allowed for authority.

### 7.3 Capability enforcement

Capabilities are applied after configuration, model profiles, agent overrides,
and router resolution. They are enforced by the launcher, operating system,
workspace layer, and tool broker—not by prompt prose.

Negative grants win:

- a skill cannot grant a denied capability;
- memory cannot grant a tool;
- an agent cannot grant itself a consequence;
- a router cannot replace the attested lane;
- an adapter unsupported by a required hard boundary fails closed.

### 7.4 Agent and skill installation

One hiring path creates managed instruction bundles. Unknown instruction-shaped
adapter keys are rejected.

Hiring is two-phase because package, network, and filesystem work cannot be
rolled back by a database transaction:

1. create a proposed, inactive agent;
2. install required skills idempotently;
3. record immutable install and instruction-bundle attestations;
4. activate the agent in one database transaction only when every prerequisite
   is present.

Failure leaves no runnable agent. Compensating cleanup removes safe staging
artifacts or records them as orphaned for repair; it never fabricates rollback
of an external install.

Raw wiki, web, email, issue, attachment, and provider content is screened as
untrusted data before durable propagation. Secrets, sensitive customer data,
and embedded instructions do not become canon.

## 8. Durable data model

V1 uses normal relational transactions, constraints, and append-only evidence.
It does not require a global event store, universal replay engine, canonical
CBOR, or a signing key for every database write.

### 8.1 Authoritative records

| Record | Contract |
|---|---|
| `office_identities` | One visible identity and its approved principals, channels, and scopes |
| `channel_principal_bindings` | Verified possession/link ceremony, confidence, scope, expiry/reverification, and revocation for each email/phone/Desktop principal |
| `conversations` | Stable cross-door conversation identity, monotonic head revision, and principal isolation |
| `ingress_events` | Immutable authenticated provider/session event with unique idempotency key and content reference |
| `work_items` | Stable unit of requested work; current display state is derived from attempts, effects, and blockers |
| `versions` | Immutable version identity, predecessor, project, and selected real source base |
| `version_generations` | Monotonic immutable specification generations and accepted spec revision/hash |
| `version_tasks` | Complete, content-addressed accepted manifest with dependencies, lane, capability, checks, artifacts, generation ID, and generation fence |
| `execution_attempts` | One launch attempt with durable attempt ID, generation/conversation fences, launch token/lease epoch, actual runtime, capability, process/workspace identity, timestamps, and terminal outcome |
| `attestations` | Append-only facts about instructions, routing, capabilities, source, checks, build, deployment, health, and runtime |
| `effects` | Exact internal or external consequence intent, conversation/generation fence, and target/action digest |
| `authorization_grants` | Human-approved consequence-plan digest, exact targets/effect set or deterministic constraints, scope, maximum uses, expiry, and revocation |
| `approvals` | Append-only accept/reject/expire decision bound to one exact effect or authorization grant |
| `outbox_entries` | Durable typed dispatch reservation for run launch, channel reply, or external consequence |
| `delivery_observations` | Provider acceptance, delivery, failure, bounce, rejection, or ambiguity |
| `version_closures` | Insert-only terminal closure: `shipped` or explicitly `superseded`, with preserved evidence |
| `culture_proposal_bindings` | Paperclip work/evidence linked to the Otto proposal ID and exact proposed change |
| `culture_decision_observations` | Immutable Otto decision receipt, canonical culture hash, apply/replay/canary observations, and active/rollback projection |

Large specifications, artifacts, logs, message bodies, and receipts live in
immutable content-addressed storage and are referenced by digest. Sensitive
content follows scoped access and retention rules; hashes are not treated as a
substitute for data governance.

### 8.2 Mutable operational coordination

The following may update transactionally because they coordinate current work
rather than rewrite historical truth:

- leases and lease epochs;
- worker heartbeats;
- queue claims;
- projection cursors;
- cached read models;
- session presence;
- health and backpressure state.

An operational update may never alter a completed attempt, approval,
attestation, delivery observation, or version closure.

### 8.3 Existing Paperclip primitives

Existing issues, documents, decompositions, and workspaces remain useful:

- issues are cards over work/version/attempt projections;
- the stable `plan` document is the human-readable specification surface;
- accepted decomposition is a projection of `version_tasks`;
- workspaces are leased materializations at an exact commit/tree;
- activities and receipts render append-only evidence.

They are not independently authoritative locks, policy stores, or release
claims. This removes the mutable issue row from its current role as plan state,
execution lock, run pointer, workspace selector, monitor state, and arbitrary
policy JSON.

### 8.4 Atomicity

The following pairs commit in one database transaction:

- ingress event + recorded acknowledgement;
- accepted work transition + durable attempt ID + fenced run-dispatch entry;
- accepted specification + locked generation;
- complete validated task manifest + all dependency edges;
- effect authorization decision + reservation + effect-outbox entry;
- terminal version closure + release of the one-active-version lock.

A crash between business-state mutation and dispatch must never strand runnable
work or create a second attempt on blind recovery.

Process launch itself is outside the database transaction, so v1 uses a fenced
launch protocol:

1. create the attempt, generation/conversation fences, launch token, workspace
   lease epoch, and run-dispatch entry transactionally;
2. the launcher accepts only the current token and epoch, and the workspace
   broker rejects writes from a stale epoch;
3. persist the external process identity/start receipt before `running`;
4. after an ambiguous crash, query adapter status by attempt token and attach to
   the existing process, mark it terminal/lost, or leave it blocked;
5. never relaunch while the prior token's process outcome is unknown.

Adapters that cannot provide idempotent start/status reconciliation are not
eligible for v1 implementation work.

## 9. State machines

### 9.1 Ingress

```text
received
→ authenticated
→ reserved_and_deduped
→ recorded
→ accepted | rejected | deterministic_terminal
```

Provider replay with the same `(identity, channel, provider_event_id)` returns
the existing result. An invalid signature creates no durable provider-event
reservation, so a forged request cannot consume the real event ID.

### 9.2 Work

```text
received
→ classified
→ accepted | needs_input | rejected
→ active
→ done | blocked | cancelled
```

`done` requires the evidence predicates named by the work contract. A model
return alone cannot create it.

### 9.3 Version

```text
specifying
→ implementing
→ verifying
→ deployable
→ shipped
```

`blocked` is an overlay with named unresolved predicates, not a lifecycle state
that releases the version lock.

An explicit board-authorized `superseded` closure is available when a failed
predecessor must be replaced rather than falsely called shipped. It:

- names the successor;
- preserves every blocker and failed receipt;
- proves no unrecorded candidate is being represented as live;
- records the exact real source base selected for the successor;
- releases the active-version lock without asserting success.

A defective spec creates generation `g+1` of the same version and returns the
derived lifecycle to `specifying`. It does not overwrite generation `g`.

Every task, run-dispatch entry, attempt, workspace lease, integration
reservation, effect, candidate, and closure is bound to a generation ID and
monotonic generation fence. Replacing a generation transactionally:

- increments the active fence;
- revokes unclaimed old-generation dispatch/effect entries;
- requests cancellation of running old-generation attempts;
- revokes their workspace write leases;
- quarantines any later output as historical evidence.

The active generation fence is rechecked at claim, launch, finalization,
integration, effect reservation, candidate binding, release evaluation, and
closure. Old-generation work can never enter the new candidate.

### 9.4 Attempt

```text
queued
→ resolving
→ launch_reserved
→ launch_attested
→ running
→ succeeded | failed | cancelled | lost
```

An attempt reaches `running` only after final router resolution, instruction
identity, capability enforcement, and exact workspace realization. It reaches
`succeeded` only after process success and required workspace/output
postconditions. Adapter return alone is insufficient.

Retries create new attempts. They do not rewrite history.

A timed-out or crashed claim does not imply that the executor process is gone.
Recovery reconciles the durable attempt token and process identity before
creating another attempt. An unknown prior process blocks relaunch and
workspace reuse.

### 9.5 Effect and delivery

```text
prepared
→ authorization_pending
→ authorized | rejected | expired
→ reserved
→ dispatched
→ accepted_by_provider
→ delivered | failed | uncertain
```

`authorized` must cite exactly one immutable decision:

- an approval of this exact effect;
- a still-valid authorization grant whose consequence-plan/effect constraints
  match exactly; or
- a `policy_no_approval_required` decision for a non-consequential internal
  action, with the effective policy digest.

Paperclip can guarantee effectively-once admission and reservation through a
transaction and unique idempotency key. External delivery is provider-
dependent. A timeout, connection reset, `429`, `5xx`, or missing acknowledgement
after possible provider acceptance remains `uncertain` until reconciled unless
the provider's documented contract proves that the response class had no side
effect. For example, a documented pre-send rate-limit rejection may be
retryable rather than uncertain; the adapter must encode that provider fact.

### 9.6 Culture

```text
observation_or_correction
→ proposal
→ rejected | deferred | ratified
→ separate_apply_attempt
→ replay
→ canary
→ natural_monitoring
→ active | revised | rolled_back
```

No discovery or review attempt may apply its own culture change.
From `proposal` onward, these are Paperclip projections of Otto decisions and
receipts, not an independent Paperclip ratification state machine.

## 10. Ingress, conversations, and ordering

### 10.1 Canonical ingress envelope

Every door normalizes to an `IngressEnvelope` containing:

- office identity;
- authenticated principal and confidence;
- channel and provider;
- provider event/message/thread IDs;
- canonical conversation ID;
- received timestamp;
- content and attachment references;
- authentication/signature evidence;
- reply relationship;
- idempotency key;
- redaction and retention class.

Message bodies and attachments are untrusted data. Their content cannot alter
the authority order.

An Inkbox webhook signature proves that Inkbox sent the event; it does not by
itself prove that the human sender is Sebastian. Cross-door continuity requires
an active `channel_principal_binding` established by verified possession:

- Desktop uses the authenticated Paperclip session.
- Email linking requires a challenge to the address plus confirmation in an
  already authenticated Desktop/API session, or an exact board bootstrap
  approval.
- Phone/iMessage linking requires a one-time channel challenge plus confirmation
  in an already authenticated session.
- A changed account, recycled number signal, revoked contact, or expired binding
  triggers reverification.

Provider thread IDs, address-book matches, forwarded headers, and message
content are conversation hints, never principal-binding proof. A valid provider
event from an unbound or low-confidence principal enters an isolated untrusted
inbox/conversation and cannot receive Sebastian's prior continuity.

### 10.2 Conversation ordering

Each admitted message increments a monotonic conversation head revision. A
response-producing attempt records the revision it read. One conversation
permits one active response-producing attempt at a time, but follow-ups are
admitted immediately rather than hidden behind it.

Before a reply or effect is reserved, the producer performs a compare-and-set
against the current conversation revision. If a newer message exists, the old
output is preserved as stale evidence but cannot be delivered; the active
attempt is cancelled, reconciled with the new message, or superseded by a new
attempt with an explicit receipt. Serial processing alone is not treated as
proof that an old answer remains valid.

Different conversations may proceed concurrently within configured capacity.
One integration writer remains exclusive per version.

### 10.3 Backpressure

If Paperclip cannot durably admit a request, the door says it was not recorded.
If it was recorded but cannot yet be accepted, the door returns the stable work
ID and a truthful queued or blocked state. The system never drops work to
preserve a latency number.

## 11. Effect and consequence gateway

The following classes require an exact approval or a still-valid
`authorization_grant` whose bound consequence plan covers the exact effect:

- send or publish;
- deploy or promote;
- spend or enter a paid plan;
- delete material data or remove the last rollback copy;
- change security, credentials, accounts, permissions, or identity;
- make an external commitment;
- access or mutate live customer data;
- activate recurring attention, watchers, or outbound routines;
- change Constitution, Standards, or broadly effective culture.

An approval binds:

- approver;
- office, conversation, work, version, and attempt;
- consequence class;
- exact target;
- canonical serialized action;
- rendered draft/diff/artifact digest;
- expiry;
- provider/deployment destination;
- prior approval it replaces, if any.

Editing any bound field invalidates approval.

A prior workstream authorization is usable only through an
`authorization_grant` created by an exact approval. The grant binds:

- work/version and consequence-plan digest;
- exact targets and allowed effect digests, or deterministic constraints that
  cannot widen the target;
- provider/destination;
- maximum uses or amount;
- expiry and revocation;
- the approval that created it.

EffectGateway consumes a use atomically at reservation. A mismatched, exhausted,
expired, edited, or revoked grant returns the effect to
`authorization_pending`. Conversation prose is never authorization.

The EffectGateway records:

- prepared intent;
- approval or denial;
- outbox reservation;
- dispatch attempt;
- provider ID and response;
- rendered content digest;
- delivery observation;
- reconciliation or compensation.

An ambiguous send remains reserved. It is never automatically replayed. Any
retry or compensating action is a new effect with its own idempotency key and,
where required, approval.

## 12. Receipts and release truth

### 12.1 Claim ladder

Paperclip uses explicit claim levels:

| Claim | Required proof |
|---|---|
| Work exists | Durable ingress/work record |
| Attempt ran | Launch attestation and terminal attempt evidence |
| Candidate passed | Required checks against exact source/tree and artifacts |
| Deployment was requested | Authorized deployment effect and outbox record |
| Artifact was installed | Target observation of installed bytes |
| Version is running | Runtime self-attestation plus target health/identity observation |
| Message was sent to provider | Provider acceptance ID |
| Message was delivered | Provider delivery observation |

A stronger claim cannot be inferred from a weaker one.

### 12.2 Receipt contract

Receipts are server-constructed projections of persisted evidence. Each receipt
contains:

- stable receipt and causal work IDs;
- requested and actual lane;
- actual executor/model/effort fields, including typed unknowns;
- instruction and capability digests;
- source commit/tree and workspace identity;
- checks, timestamps, artifacts, and limitations;
- consequence, authorization evidence, and target;
- provider or deployment observations;
- named blockers and next executable step.

Receipts are immutable at their evidence cursor. Later facts create a later
receipt; they do not edit the historical one.

### 12.3 VersionCoordinator

The VersionCoordinator owns seven commands:

1. `openVersion`
2. `acceptSpec`
3. `replaceSpecGeneration`
4. `acceptTaskManifest`
5. `bindCandidate`
6. `evaluateRelease`
7. `closeVersion`

Every command is idempotent and protected by database constraints and
project-scoped transactions. RuntimeGateway alone owns attempt creation,
resolution, launch, attestation, finalization, and recovery.

### 12.4 Candidate and ship identity

The release chain binds:

```text
accepted spec generation
→ accepted task manifest
→ Cursor workspace commits and trees
→ integrated candidate commit and tree
→ dependency lock and build inputs
→ build artifact digests
→ packaged runtime manifest
→ installed runtime bytes
→ observed process/runtime identity
→ health and acceptance observations
```

The candidate must resolve in the recorded repository and descend from the
selected base through permitted Cursor-produced commits. A 40-hex string that
does not resolve is invalid. Request bodies and environment variables cannot
override attested fields.

`version_closures` are insert-only. Rollback, redeploy, and later failure append
observations. They do not void or rewrite the original closure.

## 13. Otto culture and Letta memory

### 13.1 Boundaries

Paperclip and Otto must not duplicate each other:

- Paperclip owns operational work, attempts, approvals, effects, receipts, and
  release evidence.
- Otto owns version-controlled Constitution, Standards, Precedents, Practices,
  Routines, and Curation changes.
- Letta owns persistent memory and retrieval.
- Paperclip stores the exact Otto culture version and Letta source references
  used by each attempt.

The existing Otto Paperclip/Letta adapter is a candidate integration seam, not
automatically trusted production code.

Otto is the sole authority that decides a Curation proposal and mutates canon.
Paperclip:

1. binds work evidence to an exact Otto proposal ID/digest;
2. collects Sebastian's exact approval when the proposed culture consequence
   requires it;
3. submits the proposal/approval through a durable EffectGateway outbox;
4. records Otto's immutable decision receipt and resulting canon hash;
5. projects apply, replay, canary, monitoring, and rollback observations.

Paperclip never renders `ratified` or `active` from its local approval alone.
After partial failure it reconciles by Otto proposal ID; it does not write a
second decision. If Otto accepted a decision but Paperclip missed the response,
the outbox remains pending/uncertain until the Otto receipt is recovered.

### 13.2 Culture objects

| Object | Contract |
|---|---|
| Constitution | Stable behavioral principles and tie-breakers |
| Standard | What the office rewards, refuses, and does under pressure |
| Precedent | A real conflict, ruling, cost, outcome, future rule, and revisit trigger |
| Accepted specification | One bounded outcome and proof contract for a version |
| Practice | Repeatable behavior with trigger, inputs, outputs, guardrails, evidence, and improvement loop |
| Routine | Ordered Practices with trigger, attention cost, owner, and activation approval |
| Skill | Versioned capability package; never authority |
| Run | One attempt under exact authority, culture, memory, and capability identities |
| Receipt | Evidence-backed claim and limitations |
| Curation proposal | Pattern, source receipts, exact proposed diff, risk, scope, and replay cases |
| Ratification | Accept/reject/defer decision bound to an exact proposal and diff |

Standards changes always require Sebastian. Recurring Routine activation always
requires explicit approval.

### 13.3 Learning loop

```text
run
→ receipt
→ correction or repeated failure cluster
→ exact Curation proposal
→ classify against Standards and Precedents
→ Sebastian approves, rejects, or defers the exact proposal
→ Otto records the authoritative decision and, when approved, mutates canon
→ separate apply run
→ new culture content hash
→ offline replay
→ bounded canary
→ natural-run monitoring
→ retain, revise, or roll back
```

Adapters may return context, work state, artifacts, observations, and proposals.
They may not write Standards, Practices, Routines, or Letta memory directly.

### 13.4 Memory contract

Letta provides bounded continuity:

- source-linked facts;
- conversation summaries;
- prior decisions and corrections;
- retrieval timestamps and freshness;
- explicit conflicts with current source evidence.

Memory cannot approve, route, grant a capability, change culture, or override
Paperclip/Git/provider facts.

If Letta is unavailable:

- deterministic and source-complete work may continue with an explicit
  `memory_unavailable` attestation;
- work that depends on continuity becomes blocked or asks for the missing fact;
- Paperclip never invents a fallback memory store or claims continuity.

If Otto is unavailable, attempts may use the last already-ratified culture
version whose content is locally verifiable. No new culture proposal may be
activated until Otto returns.

## 14. Paperclip Desktop

### 14.1 Product contract

Paperclip Desktop is the canonical office client, not a second Paperclip
server. The Veto production profile connects only to one approved,
authenticated remote Paperclip origin.

The production app must:

- be signed, notarized, and built from a real Git commit;
- expose wrapper version, source commit/tree, build digest, and server/runtime
  compatibility;
- perform health and authenticated-session preflight before showing connected;
- isolate sessions by profile;
- restrict navigation and privileged APIs to the exact approved origin;
- use sandboxing and no unsafe renderer bridge;
- show honest `connected`, `auth_required`, `degraded`, `offline_read_only`, and
  `incompatible` states;
- never silently start an embedded production database;
- keep cached receipts read-only while offline;
- support safe deep links to work, version, approval, run, receipt, Standard,
  and Curation records;
- provide one updater source and a verified rollback artifact.

An embedded local server may exist only in a clearly labeled developer/lab
profile with an isolated non-production data root. It is disabled in the Veto
production profile.

### 14.2 Primary surfaces

The Desktop information architecture has six surfaces:

1. **Inbox / Chat** — the one cross-door conversation and work intake.
2. **Decisions / Approvals** — exact consequential doors awaiting Sebastian.
3. **Work / Versions** — active version, accepted spec, manifest, progress, and
   blockers.
4. **Runs / Receipts** — actual executor, evidence, latency, effects, and
   limitations.
5. **Standards / Curation** — ratified culture, proposals, replays, canaries,
   and monitoring.
6. **Settings / Health** — remote origin, identity, Inkbox, Letta, Otto,
   runtime compatibility, and degraded states.

The UI presents simple current state first and immutable history on demand.

### 14.3 Current app cleanup

The observed July 23 inventory contains:

| Installed app | Observed issue | v1 disposition |
|---|---|---|
| `~/Applications/Paperclip Desktop.app` | Wrapper `3.2.11`; embedded server `2026.707.0`; not proven as the canonical signed v1 source | Candidate only |
| `~/Applications/Paperclip Desktop.previous.app` | Same bundle/version but different bytes and legacy updater source | Retire after rollback preservation |
| `~/Applications/Paperclip Veto Remote.app` | Separate bundle, hard-wired remote origin, older preflight behavior | Retire after canonical remote cutover |

Cleanup is a separate consequence:

1. inventory app bytes, bundle IDs, signing/notarization, profiles, sessions,
   updater sources, and user data;
2. select one version-controlled source home and build one candidate;
3. export or preserve required profile/session state;
4. retain one verified rollback artifact;
5. canary the canonical app against the real remote office;
6. disable old launch paths and observe;
7. ask for explicit deletion approval;
8. only then remove duplicate bundles and stale support files.

Otto Desktop remains an internal Letta/culture lab until the Paperclip
CultureGateway completes a real non-customer issue round-trip with the same
receipts visible in Paperclip Desktop. Archiving it is a later approved cleanup,
not a prerequisite deletion.

## 15. Inkbox channels

### 15.1 Product contract

Inkbox is the identity and communication transport for email, iMessage, and
optionally enabled SMS. One Inkbox identity maps to the one Paperclip office
identity. Inkbox's current model gives an identity one mailbox and tunnel plus
an optional phone number; Paperclip uses those as channel resources, not as a
second agent runtime. See [Inkbox identity and capability model](https://inkbox.ai/docs/get-started/introduction).

V1 requires:

- one explicitly selected Inkbox identity;
- per-identity signing key configured before subscriptions;
- unsigned webhook traffic rejected;
- typed SDK webhook envelopes;
- subscription inventory for `message.received` and `imessage.received`, plus
  outbound delivery/failure events used by receipts; when SMS is enabled, the
  same inventory must include `text.received` and text delivery/failure events;
- stable provider event IDs as replay/dedupe keys;
- verified channel-principal binding scoped to the identity; provider
  sender/contact matching is only a hint;
- one canonical Paperclip conversation mapping;
- bounded attachments and untrusted-content handling;
- outbound idempotency and explicit provider ambiguity;
- no message bodies, phone numbers, credentials, or secrets in operational
  logs.

Inkbox documents that webhook replay reuses the original event ID and provides
separate received/delivery/failure events across mail, text, and iMessage.
Paperclip must use those identities rather than inventing timestamp-based
dedupe. See [Inkbox webhooks](https://inkbox.ai/docs/webhooks) and
[per-identity signing keys](https://inkbox.ai/docs/signing-keys).

### 15.2 Inbound boundary

The channel adapter:

1. verifies the raw request signature;
2. validates the typed event;
3. reserves the provider event ID;
4. resolves the verified channel-principal binding and maps the provider thread
   to that principal's office conversation; an unbound sender remains isolated;
5. commits the ingress event and wake outbox entry together;
6. acknowledges only after durable admission;
7. returns the existing result for replay.

If comment/work creation succeeds but activation fails, recovery retries the
activation path without reposting the message.

### 15.3 Outbound boundary

Outbound email, iMessage, or SMS:

1. binds conversation and current revision, generation fence, source message,
   verified recipient principal, exact rendered body, channel, and expiry;
2. obtains approval when consequential;
3. reserves a durable outbox entry;
4. calls Inkbox with a stable idempotency key where supported;
5. records provider acceptance and provider message ID;
6. consumes delivery/failure/unconfirmed webhooks;
7. remains `uncertain` when the real outcome cannot be established.

Email threading uses the provider's real reply/thread identity. It does not
create a fresh conversation for every response. Inkbox's email surface supports
ongoing inbox/thread history; see [Inkbox email](https://inkbox.ai/docs/capabilities/email).

### 15.4 SMS gate

Parser support is not SMS readiness. Before SMS is considered live:

- a real number is provisioned and bound to the selected identity;
- `text.received` and delivery subscriptions are observed;
- opt-in, STOP, HELP, retention, quiet-hours, and recipient rules are documented
  and tested;
- the applicable US A2P/10DLC path is selected;
- any spend or campaign registration receives separate approval;
- a non-customer test number completes inbound, approved reply, delivery,
  replay, restart, and ambiguity canaries.

Inkbox documents carrier registration, opt-in language, sample-message, rate-
limit, and STOP requirements for production SMS; see
[Inkbox 10DLC registration](https://inkbox.ai/docs/capabilities/phone/10dlc).

Voice and autonomous calling remain out of v1.

## 16. Motion and quality

### 16.1 North star

The primary operating metric is:

> **Durable, accepted outcomes per wall-clock hour, with quality and consequence guardrails visible beside the numerator.**

An outcome qualifies only when it:

- was classified at admission as meaningful, actionable work;
- uses the correct lane;
- has the required receipt;
- has no duplicate mutation;
- does not cross an unauthorized consequence;
- receives a human quality label of `correct` rather than `partial` or
  `incorrect`;
- is not corrected, reversed, or reopened for the same failure within 24 hours
  and the next related human reply.

Paperclip never collapses the whole system into a hidden composite score.
Throughput, latency, quality, rework, and consequence safety remain separately
inspectable.

### 16.2 Cohorts and quality adjudication

Cohort membership is fixed before outcome and records:

- traffic class (`natural`, `benchmark_replay`, `canary`, `probe`, `smoke`,
  `synthetic`, or `deterministic_control`);
- actionable/meaningful predicate and reason;
- source and conversation;
- requested lane;
- rubric version;
- admission timestamp.

The original classification is immutable. A later audit may append a correction
and both values remain visible; it cannot silently remove a slow or incorrect
run from the denominator.

Before cutover, create a baseline of at least 50 meaningful natural fast
assignments using this same query and manually review every inclusion. The
current v0.06/v0.07 observer is not a valid baseline because it mixed probes,
canaries, and an error. Baseline and candidate cohorts use internal operating
work only and do not introduce or expose live customer data.

Also freeze a redacted, non-customer benchmark of at least 50 representative
fast decisions. Run the same benchmark against the baseline and v1 candidate
offline. Benchmark replay measures normalized service capacity but is always
reported as replay, never natural traffic.

Every baseline, benchmark, and first-50 natural v1 outcome receives a human
label:

- `correct`: right route/disposition and usable result without a material edit;
- `partial`: useful but required a changed decision, route, consequence target,
  or acceptance predicate;
- `incorrect`: wrong, unsafe, materially misleading, or reopened for the same
  failure.

Grammar, spelling, and presentation-only edits are not material. The review
records reviewer, rubric version, reason, and linked correction.

The v1 candidate must:

- meet the absolute latency contracts below;
- achieve at least 2× the baseline's correct benchmark outcomes per elapsed
  cohort wall-clock hour;
- have no worse `partial + incorrect` rate than baseline;
- have zero unauthorized consequences and zero duplicate mutations.

The first 20 natural outcomes are an early canary, not the final p95 claim. The
closeout cohort contains at least 50 meaningful natural outcomes; the first 100
continue as post-close stability monitoring with the same immutable query.

### 16.3 Latency contracts

| Boundary | Target |
|---|---:|
| Ingress received to durable `recorded` acknowledgement | p95 ≤2s |
| Meaningful Thinking-fast total | p50 ≤10s; p95 ≤15s |
| Committed fast result to visible Desktop/API projection | p95 ≤2s |
| Committed approved channel reply to provider dispatch attempt | p95 ≤5s |
| End-to-end system-owned fast path, excluding carrier/email transit | p95 ≤20s |
| First eligible Thinking-zero task to launch | ≤30s |
| Slow-lane durable acknowledgement/checkpoint | p95 ≤10s for admission; no completion SLA |

SLA clocks begin at durable eligibility, not at a convenient later log line.
Queue and backpressure time remain visible.

### 16.4 Quality and safety measures

The operating dashboard reports:

- correct disposition and route rate;
- fast escalation precision;
- `correct`, `partial`, and `incorrect` human labels under the fixed rubric;
- reopened/reworked/reverted outcomes;
- time to first durable artifact;
- receipt coverage and false-`done` rate;
- duplicate wake, mutation, effect, and terminal-event groups;
- retries, timeouts, lost attempts, and `uncertain` effects;
- unauthorized consequential actions, target `0`;
- unnecessary approval requests;
- requested versus actual executor mismatches;
- instruction/capability failures;
- culture proposal acceptance and rejection;
- recurrence of a corrected failure over the next 20 comparable natural cases;
- Desktop/channel health and delivery observation completeness.

No-op, duplicate, smoke, probe, canary, synthetic, benchmark replay, and
deterministic-control traffic are tagged at admission and excluded from natural
meaningful-work latency and quality cohorts. Their performance remains visible
in separate reports.

## 17. Migration to v1

### 17.1 Entry gate

The latest audited v0.07 state contains unresolved P0 failures:

- live schema/package mismatch and recurring heartbeat recovery errors;
- recorded candidate not proven as a real Git commit;
- mutable shipped closure;
- specification and executor capabilities described but not mechanically
  enforced;
- router validation based on a spoofable pre-resolution value.

Before v1 implementation starts, Sebastian chooses one honest path:

1. **Close v0.07 correctly:** repair it from durable Cursor-owned source and
   produce an immutable real-source closure; or
2. **Supersede v0.07 explicitly:** freeze its failed audit and historical
   evidence, record a board-authorized `superseded` closure naming v1, and select
   a real Git commit/tree as the v1 migration base.

Neither path may rewrite the old record to look green.

Sebastian selected path 2 on 2026-07-23 by instructing the team to ship this
specification in full. The v0.07 audit remains frozen as failed. The selected v1
migration base is repository `/Users/seb/Code/paperclip-v0.07`, commit
`11f920182fdf908e2476c144505b1e659427015d`, tree
`cc7dd772bdfdc96a44faf04a64fb511a587ef364`. Cursor must commit this accepted
generation and an immutable supersession receipt before producing implementation
changes.

### 17.2 One release, internal proof slices

Cursor may sequence v1 implementation into these internal slices:

| Slice | Proof before the next slice depends on it |
|---|---|
| A. Truthful base | Real repository/commit/tree, migration journal identity, v0.07 blocker preservation |
| B. Office kernel | Relational facts, idempotent admission, atomic manifests, transactional outbox, rebuildable projections |
| C. Runtime boundaries | One instruction bundle, real router resolution, OS capability enforcement, actual launch attestation |
| D. Version and release | Immutable generations, Cursor provenance, exact candidate/build/installed/runtime evidence, immutable closure |
| E. Channels | One identity, Desktop/Inkbox admission, dedupe, delivery observations, uncertainty, approved outbound |
| F. Culture and memory | Otto canon binding, Letta continuity, Curation/ratification/apply/replay/canary |
| G. Integrated cutover | Signed Desktop, natural workload, recovery drills, one office across all doors, legacy paths disabled |

These slices are not releases. None may be called v1 shipped or promoted as a
standalone production version.

### 17.3 Legacy import

Migration imports rather than reinterprets:

- every legacy issue, document, plan, run, workspace, receipt, release label,
  channel reservation, and blocker receives a stable legacy reference;
- contradictory or unverifiable values become typed `unknown`,
  `not_observed`, or blocked facts;
- dirty/uncommitted receiver hardening is evidence, not deployed behavior;
- the old state remains read-only during parity and rollback windows;
- new writes use the v1 kernel first; compatibility projections never become a
  second source of truth.

### 17.4 Cutover order

1. Freeze the exact spec and source base.
2. Prove fresh-database and upgrade-database migration identity.
3. Shadow the OfficeKernel, RuntimeGateway, and projections.
4. Prove lane enforcement with negative tests.
5. Canary the canonical Desktop against the remote office.
6. Canary Inkbox email, then iMessage. Canary SMS only after its independent
   gate is authorized and complete; otherwise prove the explicit
   `sms_unavailable` projection.
7. Attach Otto and Letta with explicit degraded-state tests.
8. Run integrated recovery and consequence drills.
9. Move the selected doors to v1 writes.
10. Disable legacy writers, watchers, duplicate timers, and old app launch
    paths.
11. Observe the rollback window and natural cohort.
12. Request explicit cleanup/deletion approval.

### 17.5 Rollback

Rollback:

- stops new v1 admissions at a transaction boundary;
- preserves every v1 fact, attempt, outbox reservation, approval, and receipt;
- serves the last consistent read model;
- does not replay ambiguous external effects;
- does not resume an executor under weaker instructions or capabilities;
- restores only a verified prior binary/artifact;
- appends a rollback observation to the version record;
- leaves the original closure immutable.

Work recorded during canary is completed, explicitly cancelled, or linked to a
successor attempt. It is never silently dropped.

## 18. Acceptance tests

### 18.1 Office kernel and atomicity

1. Duplicate Desktop, email, and iMessage admission returns one ingress event
   and one stable receipt per provider event ID; the same must hold for SMS when
   enabled.
2. A transaction crash at every admission boundary produces either no recorded
   work or one complete recorded work item plus dispatch outbox entry.
3. A complete task manifest is inserted atomically. One invalid dependency,
   lane, capability, fingerprint, or acceptance predicate inserts zero tasks.
4. Crash before process creation, after process creation, before process-ID
   persistence, and after lease expiry. Two claimants still produce one durable
   attempt token and at most one workspace-writing executor process; recovery
   attaches, proves terminal/absent, or remains blocked rather than blindly
   relaunching.
5. Two concurrent `openVersion` commands produce one version and one
   deterministic conflict.
6. Projection deletion/corruption followed by rebuild produces the same
   visible work, version, attempt, effect, and receipt state.
7. Mutable lease and cursor recovery cannot alter historical attempts or
   evidence.

### 18.2 Instructions and authority

8. Codex CLI, Codex ACP, Cursor, router-backed, fresh, and resumed attempts
   resolve the same required bundle hash for the same work.
9. Missing, unreadable, contradictory, stale, or realpath-escaped required
   instructions fail before model launch.
10. Legacy prompt fields and unmanaged repository discovery cannot create a
    second active authority in managed mode.
11. Inbound prompt injection in email, SMS, issue, attachment, memory, or wiki
    content remains untrusted data.
12. A required-skill installation failure leaves the proposed agent inactive,
    records every staged/orphaned install, and completes idempotent compensation
    or exposes an exact repair action before activation is possible.
13. A skill or Letta memory item cannot widen capability or approve an effect.

### 18.3 Lane enforcement

14. Thinking-fast attempts to access tools, files, network, child agents, or
    repository context and is denied mechanically.
15. Thinking-slow attempts to write source, commit, merge, finalize, or use a
    bypass flag and is denied with unchanged HEAD/tree/status.
16. Thinking-zero cannot launch without an accepted spec generation and task
    manifest.
17. Thinking-zero attempts to edit the canonical spec and fails with unchanged
    bytes/hash.
18. A resolved launch plan that differs from the accepted lane, adapter,
    executable/runtime class, instructions, capabilities, workspace, or
    generation fence fails before any executor process or workspace write
    starts.
19. A post-acceptance Cursor mode/config change is revalidated at dispatch.
20. Unknown underlying Cursor Auto model is recorded as unknown, not guessed.
21. Ambiguous fast work escalates once with the complete original context; a
    second model escalation is a visible failure.
22. Natural fast cohorts exclude deterministic, smoke, probe, canary, and
    synthetic work.

### 18.4 Version and release proof

23. Accepting one spec locks one exact generation. Reopening creates `g+1`
    without editing `g`; claim, launch, finalization, integration, effect
    reservation, candidate binding, and closure races from `g` are rejected
    after the fence changes.
24. Every source-producing commit in the candidate has a recorded Cursor
    workspace and permitted ancestry.
25. Adapter throw, returned non-zero exit, timeout, lost process, dirty
    workspace, wrong base, wrong branch, or wrong output ancestry cannot emit a
    successful finalization attestation.
26. A fabricated 40-hex string, mutable artifact URL, screenshot, issue state,
    or human-entered SHA cannot satisfy candidate identity.
27. A one-character mismatch among spec, manifest, source tree, build artifact,
    installed bytes, runtime manifest, or deployment observation blocks
    closure.
28. Request data and environment variables cannot override build/runtime
    attestations.
29. `version_closures` reject update, void, delete, and conflicting re-close at
    the database boundary.
30. Rollback and redeploy append observations without changing the original
    closure.
31. An explicit `superseded` closure preserves failed predicates and never
    renders as shipped.

### 18.5 Effects and channels

32. Editing an approved target, recipient, body, diff, amount, destination, or
    expiry invalidates the approval.
33. Kill the worker before reservation, after reservation, during provider
    send, and after provider acceptance. Assert no duplicate Paperclip intent
    and explicit `uncertain` wherever provider outcome is ambiguous.
34. An ambiguous outbound effect is never automatically replayed.
35. Provider delivery replay with the original event ID creates no duplicate
    comment, work item, wake, effect, or receipt.
36. If work/comment commit succeeds and activation fails, activation recovery
    does not repost the content.
37. Unsigned or incorrectly signed Inkbox events fail before content parsing or
    durable provider-event reservation; a forged event ID cannot suppress the
    later valid event.
38. Email reply preserves the provider thread and canonical conversation.
39. iMessage reaction/context not correlated to the current event cannot alter
    work.
40. SMS remains blocked until number, subscriptions, opt-in/STOP/HELP,
    applicable 10DLC path, and non-customer canaries pass.
41. Operational logs contain IDs, hashes, and outcomes but no message bodies,
    phone numbers, secrets, or credentials.

### 18.6 Desktop

42. The canonical app passes code-signing, notarization, hardened runtime,
    origin restriction, renderer sandbox, updater, and rollback checks.
43. Health success without a valid authenticated session does not render
    connected.
44. Origin redirect, auth expiry, server incompatibility, offline state, Letta
    outage, and Otto outage render distinct honest states.
45. The production profile cannot silently start or connect to an embedded
    production database.
46. Deep links cannot escape the approved origin or invoke unapproved
    privileged actions.
47. Installed candidate bytes match the recorded build artifact.
48. Old apps remain available for rollback until parity passes; disabling one
    legacy shell cannot delete another profile or session.

### 18.7 Culture and memory

49. A correction fixes current work without changing global canon.
50. Discovery/review cannot apply its own Curation proposal.
51. A Standards change without Sebastian's exact ratification fails.
52. A ratified proposal applies only the reviewed diff in a separate attempt.
53. Replay, canary, and natural monitoring are required before activation.
54. A failed culture canary rolls back the culture version without rewriting
    old attempts.
55. A Letta memory claim conflicting with source evidence loses, and the
    conflict is recorded.
56. Letta outage produces explicit degraded or blocked behavior without a
    shadow memory store.
57. Otto outage cannot activate new culture but may use the last locally
    verified ratified version.

### 18.8 Integrated proof

58. Link Desktop, email, and iMessage through the verified possession ceremony,
    start through each mandatory door, and continue through another; assert one
    identity, conversation, work item, authority history, and receipt trail.
    Spoofed mail, a forwarded thread, an unbound sender, and a simulated recycled
    number remain isolated. Repeat for SMS when enabled.
59. Run serial non-customer canaries through Desktop, email, and iMessage:
    inbound → correct work → correct lane → exact authorization when required →
    outbound provider observation → same receipt everywhere. Repeat through SMS
    when enabled; otherwise require the explicit `sms_unavailable` receipt.
60. Reboot/restart Paperclip, projection workers, RuntimeGateway, Inkbox
    adapter, Letta, and Otto at each durable boundary; assert recovery,
    visibility, and no duplicates.
61. The first 20 meaningful natural fast decisions are an early reviewed
    canary. The first 50 form the closeout cohort and meet p50 ≤10s and p95
    ≤15s, have zero duplicate mutations, and receive the fixed human quality
    label.
62. The fixed 50-case benchmark shows at least 2× baseline correct outcomes per
    elapsed cohort wall-clock hour with no worse partial/incorrect rate. The
    first 50 natural outcomes have zero unauthorized consequences and report
    rework, reversal, false-done, and culture recurrence honestly.
63. Admission cohort fields are immutable and auditable. No synthetic, canary,
    benchmark replay, smoke, probe, deterministic, or reclassified-after-outcome
    traffic is included in natural performance claims.
64. Disabled legacy watchers, timers, receivers, local servers, and app shells
    are absent from the active path; repository deletion alone is not accepted
    as live cleanup proof.
65. A new conversation revision arriving after an attempt starts makes its old
    reply/effect compare-and-set fail; stale output is preserved but not
    delivered.
66. An expired, exhausted, revoked, mismatched, or edited authorization grant
    cannot reserve an effect; a valid use is consumed atomically.
67. Otto deciding a proposal while Paperclip loses the response reconciles to
    the one Otto decision/canon hash and never creates a second Paperclip
    ratification.
68. Each authoritative table/state machine has exactly the domain writer named
    in section 5.1; route-level and heartbeat code cannot duplicate transitions.
69. After a valid pre-launch plan, a post-start process handshake with the wrong
    executable/runtime identity, attempt token, or capability observation
    revokes the workspace lease, blocks result acceptance, and leaves no
    accepted source output.

## 19. Ship gate

Paperclip v1 is complete only when:

- Sebastian accepted this exact specification generation;
- the v0.07 closure-or-supersession gate selected a real Git base;
- all implementation and code-adjacent changes have Cursor provenance;
- fresh and upgrade migrations pass journal/ledger identity checks;
- all required acceptance tests pass with immutable evidence;
- the service starts cleanly with no recurring recovery, schema, duplicate, or
  instruction errors;
- the canonical Desktop app is signed, notarized, installed from the candidate,
  and connected to the authenticated remote office;
- email and iMessage pass real non-customer round trips;
- SMS passes only if its separate provisioning/compliance/spend gates were
  authorized and completed; otherwise v1 must label SMS unavailable rather than
  pretend it works;
- Otto and Letta complete a real non-customer Paperclip issue round-trip and
  degraded modes are proven;
- actual executor/capability attestations match all three lane contracts;
- candidate commit/tree, build artifacts, installed bytes, runtime manifest,
  and observed deployment agree;
- the first meaningful natural cohorts meet the latency, quality, duplicate,
  and consequence gates;
- rollback is exercised against the exact prior artifact;
- Sebastian explicitly approves production deployment;
- legacy cleanup remains a separate approval after the rollback window.

No local test, green CI run, screenshot, candidate hash, app launch, or ticket
state alone satisfies this gate.

## 20. Cursor handoff

After acceptance, Cursor owns all implementation.

Cursor must:

1. start from the exact accepted spec commit and selected real product base;
2. preserve this specification byte-for-byte;
3. create one atomic v1 implementation manifest covering every proof slice;
4. work only in Cursor-managed isolated workspaces;
5. keep one integration writer and explicit dependency edges;
6. record the actual requested/resolved runtime fields without guessing hidden
   models;
7. implement the smallest coherent kernel around existing Paperclip primitives;
8. migrate callers and retire legacy authority paths rather than leaving
   permanent dual systems;
9. return one integrated candidate commit/tree plus the complete verification
   evidence;
10. stop at candidate-ready before deploy, deletion, spending, security change,
    customer-data access, external send, or publication unless Sebastian
    explicitly authorizes that exact consequence.

Codex may review evidence and write a new accepted specification generation if
the design proves defective. Codex does not write implementation code.

## 21. Design rationale

Three architectures were compared:

- a full event-sourced office;
- a lean deep kernel over relational facts;
- signed, content-addressed version and attempt capsules.

The lean kernel is the v1 base.

Full event sourcing would add upcasters, replay compatibility, projection-lag
operations, retention/redaction conflicts, and global sequence concerns.
Universal signed capsules would add key custody, rotation, revocation,
canonical serialization, signing-service availability, and receipt-chain
recovery. Neither mechanism proves that a model, provider, human, or deployment
claim is true; both can sign or replay a false observation.

V1 instead uses:

- database-enforced identity and state constraints;
- append-only attempts, approvals, evidence, observations, and closures;
- content hashes for immutable artifacts;
- ordinary mutable leases and projection cursors;
- transactional outbox admission;
- OS/runtime capability enforcement;
- actual post-resolution launcher attestations;
- explicit unknown and uncertain states;
- deterministic receipt and release predicates.

This is enough structure to make the dangerous states impossible while keeping
the office understandable and operable.

## 22. Grounding references

- [Paperclip v0.07 canonical specification](/Users/seb/Code/paperclip-v0.07/doc/plans/2026-07-22-paperclip-v0.07.md)
- [Paperclip v0.07 implementation audit](/Users/seb/Documents/Codex/2026-07-21/ptj2ewp-vgt-xfc0pbg/outputs/paperclip-v0.07-audit.md)
- [Paperclip v0.07 instruction-system audit](/Users/seb/Documents/Codex/2026-07-21/ptj2ewp-vgt-xfc0pbg/outputs/paperclip-v0.07-agent-instructions-audit-2026-07-23.md)
- [Otto direction and Paperclip integration](/Users/seb/Code/otto/README.md)
- [Otto v1 culture model](</Users/seb/Code/otto/docs/v1/Otto v1 Spec.md>)
- [Otto Standards](/Users/seb/Code/otto/docs/standards.md)
- [Otto Practices](/Users/seb/Code/otto/docs/practices.md)
- [Otto Routines](/Users/seb/Code/otto/docs/routines.md)
- [Otto adapter authority seam](/Users/seb/Code/otto/docs/adapter-seam.md)
- [Inkbox identity model](https://inkbox.ai/docs/get-started/introduction)
- [Inkbox webhook events and replay](https://inkbox.ai/docs/webhooks)
- [Inkbox signing keys](https://inkbox.ai/docs/signing-keys)
- [Inkbox email threads](https://inkbox.ai/docs/capabilities/email)
- [Inkbox 10DLC requirements](https://inkbox.ai/docs/capabilities/phone/10dlc)
