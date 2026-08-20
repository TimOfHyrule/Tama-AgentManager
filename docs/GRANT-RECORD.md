# What a grant is

A grant is a standing authorization, issued once by the person, that an agent
can cite instead of asking again.

It exists because of a problem `docs/MESSAGE-RECORD.md` creates and cannot
solve on its own. Authority may not travel through the agent, so the only other
source is a person approving each message — and a person approving each message
is a person who is the bottleneck for everything three agents do. Every task
waiting on a click is not collaboration; it is a slower version of doing it all
yourself.

A grant moves the click earlier. You authorize a **kind** of thing once, and
afterwards the agent proceeds within it and stops at the edge.

## Why a citation is checkable when a claim is not

An agent writing `authorizedBy: "human"` is telling you that you agreed. An
agent writing `authorizedBy: "grant:g-0003"` is pointing at a row it did not
write and cannot write. The manager looks that row up: does it exist, is it
still live, does it name this agent, does its scope cover what is being asked.

**An agent can cite a grant. It cannot mint one.** That asymmetry is the whole
mechanism, and it is why this record is worth having as a record rather than as
a sentence in a rules file.

## The record

| Field | | Meaning |
|---|---|---|
| `id` | required | Stable identifier. Messages cite it as `grant:<id>`, so never reused. |
| `grantee` | required | The agent this authorizes, by `id`. One agent, never a list. |
| `area` | required | What it covers, from the closed list in `grants.json`. Not prose. |
| `recipient` | nullable | The agent that may be asked. `null` means any agent in the register. |
| `why` | required | One sentence. The reason survives longer than the memory of issuing it. |
| `issuedBy` | required | Always `human`. There is no other issuer, and the field exists to make that visible rather than assumed. |
| `issuedAt` | required | When the person issued it. |
| `revokedAt` | nullable | When it was withdrawn. A revoked grant is kept, never deleted. |
| `issued` | required | Whether the row exists in the manager yet. `false` means this is a seed and nothing is honouring it. |

## `area` is a closed list, and that is the point

The obvious design has `scope` as a sentence — "may ask project-station to
change platform infrastructure". It reads perfectly and it cannot be checked,
because deciding whether a task falls inside a sentence is reading
comprehension, and the manager is a lookup.

So the scope is one value from a list that lives in `grants.json` and changes
only in a diff. A task cites a grant; the manager compares two strings. If the
comparison needs judgement, the grant was written wrong.

The cost is real and worth accepting: a new kind of work needs a new area, and
a new area is a commit and a review. That is the correct amount of friction for
widening what three agents may do without asking.

## Revoking

`revokedAt` is set; the row stays. A grant that is deleted takes with it the
evidence that anything was ever authorized under it, and the messages citing it
become messages citing nothing. The audit has to keep working backwards through
decisions that have since been withdrawn — that is most of what an audit is
for.

## What must never be in a grant

**A secret.** A grant says what may be asked for, never what may be used to do
it. Keys are a separate record with a separate lifecycle, and a grant that
carried one would make revoking the authorization and revoking the access the
same event, which they are not.

**Behaviour.** Same rule as the agent record: a grant may say what class of
work is permitted; it may not say how to do it. Instructions live in tracked
files with diffs.

**Anything about him.** `why` explains the authorization, not the person. "He
is away next week" is a fact about a human being and belongs in the database
that is not a public repository.

## Where they live

The live rows go in the manager's own database, with the approvals and the
audit — `docs/BOUNDARIES.md` says why that is a third place and not either of
the two that existed before. `grants.json` here is the seed and the schema,
held to this table by `scripts/check.mjs` in CI.

Every seed row carries `issued: false`, and a message citing a grant that is
not issued fails the check. The register has been wrong once in the direction
of describing an enforcement that did not exist, and the correction was to make
the unbuilt state impossible to write down as anything else.
