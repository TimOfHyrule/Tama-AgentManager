# Connecting an agent to the manager

Four things, once per agent, and only the first is a file that agent has to
own. `docs/PROTOCOL.md` says what travels between them and which parts are
walls; this is the part somebody has to do by hand.

## 1. `.agent.json`, in that agent's own repository

```json
{ "id": "tama-assistant" }
```

One field, and the `id` has to be the one `agents.json` records. This is how the
manager is told which agent is calling, and it lives here because the three
agents share one Claude environment — the repository is the only thing that
differs between them.

It is a claim and not a proof, and the manager treats it as one. Nothing stops
an agent writing another agent's id in this file; what stops that from being
worth anything is that borrowing a name does not borrow any authority. The
manager cross-checks it against the git remote and records the disagreement,
which catches the accident and the lazy version, and not a determined one.

Committing it is correct. It is not a secret, it belongs in a diff, and a new
agent should be one commit away from existing.

## 2. `bin/agent-wake`, copied from this repository

Copy `bin/agent-wake` into the agent's repository. It checks in, then fetches
the inbox, and prints a warning loud enough to stop work if the manager cannot
be reached — because a session that silently fails to reach it behaves exactly
like a session with an empty inbox and no grants.

It is copied rather than fetched and executed. What arrives over the network is
data; what an agent does is set in a tracked file with a diff, and a script the
manager could change is a way for the manager to change how three agents
behave without anyone reviewing it.

## 3. The `SessionStart` hook

The hook already fetches `RULES.md`. Add the wake call after it, in the same
`.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "curl -fsS --max-time 10 https://raw.githubusercontent.com/TimOfHyrule/Tama-AgentManager/main/RULES.md || echo 'WARNING: the shared agent rules could not be fetched from Tama-AgentManager. Do not assume there are none — say so before doing any work.'" },
          { "type": "command", "command": "bash bin/agent-wake" }
        ]
      }
    ]
  }
}
```

A session started fresh runs both. A long-lived session runs them once, at the
beginning of its life, which is the gap the wake routine fills: being woken
runs `bin/agent-wake` again, so the rules and the grants are re-read every time
rather than only on the day the session was created.

## 4. The Claude environment

Two variables and one domain, in the environment those agents run in:

| | |
|---|---|
| `MANAGER_URL` | Where the manager answers. Not committed anywhere — naming where a thing lives tells a stranger what to knock on. |
| `FLEET_SECRET` | The same string the manager holds. This is the wall that keeps the internet out. |

And the manager's host has to be added to that environment's **Allowed
domains**. The default network policy permits a list of package registries and
nothing else, so without this the agents get a `403` with
`x-deny-reason: host_not_allowed` and never reach the manager at all.

One environment shared by three agents is what makes step 1 a claim rather than
a proof: variables belong to the environment, so three agents in one
environment necessarily hold one secret between them. Splitting them into an
environment each is what turns *which agent is this* into a wall, and it is
worth doing on the day a key depends on the answer — not before, when the cost
is three times the setup for a wall nothing is leaning on yet.
