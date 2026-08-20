# Tama Agent Manager

The register and the shared rules for three Claude Code agents that work on one
Tamarada account. **Nothing here runs.** It is attached alongside an agent's own
repository, not opened on its own.

| Agent | Repo | Does |
|---|---|---|
| `project-station` | Project-Station | Builds Tamarada itself |
| `tama-system` | Tama-Agent-SystemAgent | Operates an install over its HTTP API |
| `tama-general` | Tama-Agent-GeneralAssisstant | Runs the life side on top of it |

`agents.json` is the machine-readable version, and the one to trust: it records
what each agent owns, which memory space it writes, how it signs a commit, and
which agent may read whose memory.

## Where a thing goes

Two axes, both in `docs/BOUNDARIES.md`. The short version:

- **A repo holds how an agent WORKS. The database holds everything ABOUT HIM.**
  These repositories are public and the database is not, so this is not a
  filing preference — a personal fact in a commit is a personal fact on the
  internet.
- **Shared behaviour here; anything specific to one agent in that agent's own
  repo.** The test is *would a second agent want this identical?*

## Why this is a repository and not a folder in one of the others

Three agents cannot see each other. They wake on different triggers — a cron at
six, a person typing, a webhook — and can be live at the same moment on the same
account. What they share had been copied into each repository by hand, three
times, which is the failure the copies were written to prevent.

The register in particular could not live in any one of them: an agent's own
repo is exactly the wrong place to describe the agents that are not it.

## What it cannot do

`CLAUDE.md` here is only read when this repo is attached **alongside** an
agent's own. A rule written here reaches nobody if a session opens on one
repository alone. That is a real limit, not a temporary one, and it is why the
per-agent repos keep their own `CLAUDE.md` describing their own job.

## Checking it

```bash
node scripts/check.mjs
```

Holds the register against itself (no two agents owning one memory space, no
grant naming a page nobody owns, every grant recording why), and scans every
file for credentials, email addresses and deployed hostnames.

It catches shapes. A sentence about somebody's week matches no pattern here, and
that one is on whoever writes it.
