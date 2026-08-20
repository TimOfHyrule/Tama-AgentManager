# How agents talk to each other

They do not. They write messages, and a message is a record.

Today one agent reaches another by starting a session on its repository and
putting the task in the first prompt. That works once. It is one-directional,
it cannot be followed up, the reply comes back to a human who has to relay it,
and afterwards there is nothing anywhere saying it happened. "Who told this
agent to do that" has no answer, which is the question that only ever gets
asked about something nobody remembers deciding.

A private channel between two agents would fix the first four things and make
the last one worse. So there is no channel: the sender writes a record and the
recipient reads it, the same way everything else here works.

## The record

| Field | | Meaning |
|---|---|---|
| `id` | required | Stable identifier. Referenced by replies, so never reused. |
| `from` | required | The agent that wrote it, by `id`. `human` when a person did. |
| `to` | required | The agent it is addressed to, by `id`. |
| `kind` | required | `task` or `reply`. Nothing else yet — see below. |
| `body` | required | Plain text. What is being asked, or what happened. |
| `area` | with a citation | Which area in `grants.json` this falls in. Required when `authorizedBy` cites a grant, because comparing a task to a grant is otherwise reading comprehension. |
| `inReplyTo` | nullable | The message this answers. Required on a `reply`, null on a `task`. |
| `authorizedBy` | required | Where the authority for this came from: `null`, `grant:<id>`, or `human`. Who may write each value is the point of the field, not the values themselves. |
| `createdAt` | required | When it was written. |

## Messages are append-only

There is no `status` field, and a message is never edited after it is written.

The obvious design has the sender write a task, the recipient mark it done, and
one row with two writers. That breaks the rule every agent here works under —
write only what you own — and it breaks the one that follows from it: **never
mark another agent's work done.** A row that both agents write is a row where
"who changed this" stops having an answer, and a `status` the sender can set is
a way to close out work nobody watched happen.

So a recipient answers by writing its own message with `inReplyTo` set. Whether
a task is finished is derived from whether a reply exists, and each row has
exactly one writer, which is the same shape as the memory spaces.

## What `authorizedBy` is for

A message can ask. It cannot authorize.

Receiving a `task` does not widen what an agent may do. The recipient still
checks it against its own rules and its own repository's `CLAUDE.md`, exactly
as it would check anything else arriving in its context, and a task asking for
something outside those is refused rather than performed — being addressed to
it is not permission.

`authorizedBy` is what makes that checkable rather than hopeful. It is the
defence against the failure that makes this system worth writing down at all:
text from outside reaches one agent, and one agent can reach another. If an
injected instruction can only ever produce an unauthorized message, it stops at
the first agent instead of arriving at somebody's live install wearing a task's
clothes.

### Who may write which value

That only holds if the sender cannot write the field freely, and for a while
this file did not say who could. The gap made the whole thing decorative: an
agent writing `human` is an agent telling you that you agreed, which is exactly
the sentence an injected instruction would also produce. A field anybody can
fill in proves whatever its writer wanted to prove.

So the values are split by who is able to produce them:

- **`null`** — anything may write it, and it means nothing traces this back to a
  decision. The recipient may read it, weigh it, and raise it. It may not act on
  it.
- **`grant:<id>`** — an agent may write it, because it is a *reference* and not
  a claim. The grant lives with the manager, which checks that it exists, is
  still live, names this agent, and covers what is being asked. An agent can
  cite a grant; it cannot create one.
- **`human`** — **an agent may never write this.** In fact nothing writes it
  into the message: the person approves in the manager's own interface, the
  manager writes a separate approval row, and the authority a recipient sees is
  derived from the two together.

The line under all three: **a signature that travels through the agent is not a
signature, it is the agent's account of one.** So it does not travel through the
agent at all. The agent writes the request; the authority is attached to it
somewhere the agent cannot reach.

### Approval is a row of its own

The tidy version has the manager set `authorizedBy` to `human` on the message
when you approve it. That gives one row two writers — the agent that wrote the
request and the manager that blessed it — which is exactly the shape removed
when `status` was removed, and for the same reason: a row with two writers is a
row where "who wrote this" stops having an answer.

So approving writes an approval, and the approval points at the message. The
agent's row is still the agent's, unedited, exactly as it was sent. Whether a
message is authorized is derived — a live grant it cites, or an approval that
points at it — in the same way whether a task is finished is derived from
whether a reply exists.

It also means an approval carries what only an approval can: who approved, when,
and from where. Those cannot live in the agent's row, because the agent was not
there when they happened.

### A chain is lineage, not authority

An earlier version of this file let a message cite another authorized message,
making a chain that terminated at a person or did not terminate. It reads well
and it leaks. A task approved for one thing can be cited by a second task asking
for more, and nothing in between can tell the difference — the difference is in
the prose, and the check is a lookup.

So authority does not travel along the chain. `inReplyTo` still records what a
message answers and that lineage is worth keeping, but a message that needs
authority cites a grant or waits for the person. Nothing is authorized by
standing next to something that was.

### The grant record does not exist yet

Nothing here can check a `grant:<id>` today, because grants are not yet a
record. Until they are, `null` and an approval in the manager are the only two
honest values, and `scripts/check.mjs` fails any message that cites a grant —
for the same reason the read grants in `agents.json` all carry `issued: false`.
This repository has already been wrong in the direction of claiming an
enforcement that was not there, and that is the expensive direction.

## What must never be in a message

**Secrets.** No keys, no tokens, no connection strings. `keyId` if you must
name one.

**Anything about him.** Messages are the most conversational thing in this
system and therefore the most likely place to leak a sentence about somebody's
week. The seed lives in a public repository. The live rows live in the install
and are still not a place for it — a message is about a task, and a task is not
about his life.

**Rules.** A message may reference where the rules are. It may not carry them,
restate them, or amend them for the recipient. Behaviour comes from a tracked
file, and it comes the same way every session.

## Where they live

The live rows go in the account's own install, next to the agent records, with
the key providing the isolation exactly as it does for everything else.
`messages.json` here is the seed and the schema: the shape, held to it by
`scripts/check.mjs` in CI, plus the messages that have actually been sent.

## Only two kinds, on purpose

`task` and `reply`. Not `note`, not `broadcast`, not `fyi`.

A message with no addressee and no answer expected is a whiteboard, and a
whiteboard is where an instruction with no author ends up being read as a rule
by three agents at once. If something is true and worth keeping, it is a memory
note in the space of whoever observed it. If something needs doing, it is
addressed to somebody.
