# Tama Agent Manager

The register and the shared rules for three Claude Code agents that work on one
Tamarada account. **Nothing here runs.** The rules in `RULES.md` reach those
agents on their own, over the network at session start; see
[How the rules reach an agent](#how-the-rules-reach-an-agent).

| Agent | Repo | Does |
|---|---|---|
| `project-station` | Project-Station | Builds Tamarada itself |
| `tama-system` | Tama-Agent-SystemAgent | Operates an install over its HTTP API |
| `tama-general` | Tama-Agent-GeneralAssisstant | Runs the life side on top of it |

`agents.json` is the machine-readable version, and the one to trust: it records
what each agent owns, which memory space it writes, how it signs a commit, and
which agent may read whose memory. The read grants in it are recorded as wanted
and **not one of them has been issued** — the write-own rule is a rule, not yet
a wall.

## An agent is a record, not a repository

`docs/AGENT-RECORD.md` defines the record and says why the change was needed.
The short version: a repository works as the definition of an agent only for
one person, on one account, using one front door. A second person has no reason
to own a GitHub account; an agent that is only a routine and a set of rules has
no code to put anywhere; and quotas, audit and revocation cannot be answered by
a file three sessions cache.

`repo` becomes one nullable field on the record. Picking an agent by picking its
repository keeps working for every agent that has one — it just stops being the
only thing that knows an agent exists.

The records belong in the account's own Tamarada install. The copies in
`agents.json` are the seed and the schema, so they can be validated in CI before
anything is written to a live install. `tama-system` writes them there;
`project-station` does not touch a live install.

## Where a thing goes

Two axes, both in `docs/BOUNDARIES.md`. The short version:

- **A repo holds how an agent WORKS. The database holds everything ABOUT HIM.**
  Every repository here is treated as public and the database is not, so this
  is not a filing preference — a personal fact in a commit is a personal fact
  on the internet.
- **Shared behaviour here; anything specific to one agent in that agent's own
  repo.** The test is *would a second agent want this identical?*

## Why this is a repository and not a folder in one of the others

Three agents cannot see each other. They wake on different triggers — a cron at
six, a person typing, a webhook — and can be live at the same moment on the same
account. What they share had been copied into each repository by hand, three
times, which is the failure the copies were written to prevent.

The register in particular could not live in any one of them: an agent's own
repo is exactly the wrong place to describe the agents that are not it.

## How the rules reach an agent

`RULES.md` is the only copy of the shared rules. Each agent repository fetches
it at session start with a hook in its own `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl -fsS --max-time 10 https://raw.githubusercontent.com/TimOfHyrule/Tama-AgentManager/main/RULES.md || echo 'WARNING: the shared agent rules could not be fetched from Tama-AgentManager. Do not assume there are none — say so before doing any work.'"
          }
        ]
      }
    ]
  }
}
```

Nothing is installed and no version is pinned, so a push to `main` is live in
the next session anyone starts. The `||` branch is not decoration: a fetch that
failed quietly would leave a session behaving exactly as though no rules had
ever been written, which is the failure this replaced.

What it replaced was attaching this repository alongside the agent's own so its
`CLAUDE.md` would load. That worked, and depended on somebody remembering to do
it every time.

The plugin route was tried first — a marketplace here, `extraKnownMarketplaces`
and `enabledPlugins` in each agent's settings — and does not work in a cloud
session: nothing is registered and nothing is installed. Both attempts are in
this repository's history if anyone is tempted to try it again.

## Checking it

```bash
node scripts/check.mjs
```

Holds the register against itself (no two agents owning one memory space, no
grant naming a page nobody owns, no grant claiming to be issued on a page that
does not exist yet), checks that `RULES.md` still carries every rule and that
the URL agents fetch it from is the one recorded here, checks that every commit
in this repository is signed by a registered agent, and scans every file for
credentials, email addresses and deployed hostnames. CI runs it on every push
and pull request.

It catches shapes. A sentence about somebody's week matches no pattern here, and
that one is on whoever writes it.
