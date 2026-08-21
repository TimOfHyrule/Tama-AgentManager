# What an agent is

An agent is a record. It is not a repository.

That sentence is the whole point of this file, and it is a change. Until now an
agent WAS a repository: you selected one by picking a repo, you created one by
creating a repo, and the only list of them was `agents.json` sitting in a fourth
repo describing the other three. That works, for one person, on one account,
using one particular front door.

It stops working at the first of these:

- **A second person.** They have no reason to own a GitHub account, and no way
  to be given ours. Their agents cannot be our repositories.
- **An agent with no code.** A routine and a set of rules is a complete agent.
  There is nothing to put in a repository, so there is nothing to pick.
- **Anything that has to count.** Quotas, audit, revocation, "which agents
  exist right now" — none of them can be answered by a file that a human edits
  and three sessions cache.

So the record moves to the database and the repository stops being the agent.
A repository becomes one optional field on the record: where this agent's code
lives, if it has code.

This does not take the repo picker away. Selecting an agent by choosing its
repository keeps working exactly as it does today, for every agent that has
one. What changes is that the picker is no longer the only thing that knows an
agent exists.

## The record

| Field | | Meaning |
|---|---|---|
| `id` | required | Stable identifier. Everything else points here — see below for what happens when one has to change anyway. |
| `previousIds` | required | Every id this agent has been known by, oldest first. Empty is an answer; leaving it out is not. |
| `displayName` | required | What a person sees in a list. Renaming this is safe; renaming `id` is not. |
| `role` | required | One sentence on what this agent is for. |
| `rulesUrl` | required | Where the agent fetches its shared rules at session start. |
| `repo` | nullable | Where this agent's code lives. `null` is a normal agent, not a broken one. |
| `commitTrailer` | with `repo` | How this agent signs. Required when `repo` is set, meaningless without it. |
| `memory.page` | required | The memory space this agent writes. |
| `memory.collection` | required | Same space, as the database names it. |
| `memory.exists` | required | Whether that space has actually been created yet. |
| `keyId` | nullable | The paired agent key, by id. The handle you revoke. Never the secret. |
| `routine` | nullable | The schedule that wakes this agent, if anything does. |

## Renaming an id, and the worse thing

This file used to say an id is never reused and never renamed, full stop. That
was the right instinct and the wrong sentence, because it described a rule
nothing enforced and gave no answer for the day one has to change — and that
day came about a week in, when all three ids turned out to name *repositories*
rather than jobs, and the repositories had since been renamed out from under
them.

A rule with no procedure gets broken quietly. So:

**Renaming** is survivable and recorded. The old id goes into `previousIds`,
every reference in this repository moves with the record, and a commit trailer
written under the old name stays readable because the record still says who it
was. What a rename must never do is leave two answers in circulation with
nothing connecting them.

**Reuse is the dangerous one**, and it is a different thing entirely. When an id
starts naming a *different* agent, every old reference silently redirects: a
message addressed to one agent now reads as addressed to another, and nothing
errors. It is the one change that turns correct history into wrong history
without touching it.

So a reuse is declared in `reusedIds` in `agents.json`, with what it used to
name, what it names now, and why. `scripts/check.mjs` refuses any id that
collides with another agent's `previousIds` unless that collision is listed
there. The check does not stop you; it stops you doing it by accident.

Both are cheap now and expensive later, and the line is exactly where the
manager's database starts holding rows that point at an id. Before that, a
rename is a search and replace. After it, it is a migration of somebody's live
account.

## What must never be in the record

**Behaviour.** Not the rules, not a system prompt, not a policy, not an
instruction. The record may say *where* the rules are (`rulesUrl`); it may not
contain them.

This is not tidiness. `docs/BOUNDARIES.md` decides by asking *would changing
this without review be dangerous?* — and a field that sets how an agent behaves
is exactly that. Rules live in a repository because a repository has diffs, and
a change to how three running agents behave should be a thing somebody can read
back. A record that carried its own instructions would let behaviour be edited
in an app, silently, by anyone with write access to that row.

It is also the same failure as a memory note that tries to give an order. The
record is data about an agent, in the same way the memory holds what is true.
Neither is a place to put commands.

**Secrets.** `keyId` is an identifier, not a key. The record says which key was
issued so it can be revoked and so an audit line can name who acted. The key
itself never appears here, and never appears in this repository at all.

## Where the records live

In his Tamarada, alongside everything else that is about
that account. One person's agents are rows only they can read, for the same
reason and by the same mechanism as the rest of their data: the key is the
isolation.

This repository keeps `agents.json` as the seed and the schema — the shape a
record has, plus the three that exist today, in a form that can be validated in
CI before anything is written to his live Tamarada. `scripts/check.mjs` holds it to
the table above.

## Who writes them

Not `tama-system`. Creating these rows means writing to his live Tamarada over
the HTTP API, and the register has said from the beginning that this agent never
touches his Tamarada. `tama-assistant` does that, from the seed in this
repository.

That division is worth keeping even though it is slower. The agent that designs
the schema and the agent that writes rows into somebody's live account being
the same agent is how a bad migration happens with nobody in a position to
notice.
