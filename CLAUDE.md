# Working in Tama-AgentManager

This repository holds nothing that runs. It holds the register of the three
agents that do, the shared rules they all work under, and the check that keeps
both honest.

If you are here to change something, the two files that matter are:

- **`RULES.md`** — the shared rules, and the only copy of them. Every agent
  fetches this file at session start through a `SessionStart` hook in its own
  repository's `.claude/settings.json`. Editing it changes how three running
  agents behave on their next session, with no deploy and no install. Treat a
  diff here as a behaviour change, because it is one.
- **`agents.json`** — who exists, what each owns, which memory space it writes,
  how it signs a commit, and who may read whose memory.

`docs/MESSAGE-RECORD.md` defines how one agent asks another for something, and
why a message can ask but never authorize. `docs/AGENT-RECORD.md` defines what
an agent is — a record, of which `repo` is
one nullable field. `docs/BOUNDARIES.md` says where a thing goes. `README.md` explains why this is
a repository and not a folder in one of the others.

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
