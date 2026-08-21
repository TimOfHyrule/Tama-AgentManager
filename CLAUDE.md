# Working in Tama-AgentManager

This repository holds the register of three agents, the shared rules they all
work under, the check that keeps both honest, and — since the manager landed —
the one service in this system that runs.

`server/` is that service. It holds messages, check-ins, grants and approvals in
its own database, beside the Tamarada rather than inside it. Editing it is
editing something live, in a way editing the register is not.

If you are here to change something, the two files that matter are:

- **`RULES.md`** — the shared rules, and the only copy of them. Every agent
  fetches this file at session start through a `SessionStart` hook in its own
  repository's `.claude/settings.json`. Editing it changes how three running
  agents behave on their next session, with no deploy and no install. Treat a
  diff here as a behaviour change, because it is one.
- **`agents.json`** — who exists, what each owns, which memory space it writes,
  how it signs a commit, and who may read whose memory.
- **`grants.json`** — the standing authorizations, and the closed list of areas
  they are drawn from. A grant is the only thing an agent can cite to authorize
  itself, so widening that list is a diff and a review, never a dropdown.

`docs/MESSAGE-RECORD.md` defines how one agent asks another for something, and
why a message can ask but never authorize. `docs/AGENT-RECORD.md` defines what
an agent is — a record, of which `repo` is
one nullable field. `docs/GRANT-RECORD.md` defines a grant, and why a citation is checkable when a
claim is not. `docs/PROTOCOL.md` defines what an agent and the manager say to
each other, and which of the three questions it asks are walls and which is
only a claim. `docs/BOUNDARIES.md` says where a thing goes — including the
third place, which is the manager, and why an approval cannot live in his
Tamarada. `README.md` explains why this is a repository and not a folder in one
of the others.

## Before you push

```bash
node scripts/check.mjs
```

It holds the register against itself and against the prose beside it, checks
that `RULES.md` still carries every rule it is supposed to, checks that this
repository's own commits are signed, and scans every file for credentials,
email addresses and deployed hostnames. CI runs the same command on every push
and pull request.

## The rules apply to you too

`RULES.md` is not documentation about other agents. It is the file you are
working under while you are in here, including the parts about signing commits,
about asking less, and about never putting anything personal in a commit.
Read it.
