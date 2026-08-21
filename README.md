# Tama Agent Manager

The register, the shared rules, and the manager for three Claude Code agents
that work on one Tamarada account. The rules in `RULES.md` reach those agents on
their own, over the network at session start; see
[How the rules reach an agent](#how-the-rules-reach-an-agent).

For most of this repository's life the first line said **nothing here runs**,
and that was the point: a register that could only be read could not be a
thing that broke. It is no longer true. `server/` is the manager — it holds the
messages the agents send each other, the check-ins that say who is awake, and
the approvals that are the only place authority comes from. It runs beside the
Tamarada rather than inside it, on its own database, for the reason
`docs/BOUNDARIES.md` gives: two of the three agents can write to his Tamarada,
so an approval stored there is an approval those agents can write.

| Agent | Repo | Does |
|---|---|---|
| `tama-system` | Tamarada | Builds Tamarada itself |
| `tama-assistant` | Tama-Agent-TamaAssisstant | Operates a Tamarada over its HTTP API |
| `general-assistant` | Tama-Agent-GeneralAssisstant | Runs the life side on top of it |

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

The records belong in his Tamarada. The copies in
`agents.json` are the seed and the schema, so they can be validated in CI before
anything is written to his live Tamarada. `tama-assistant` writes them there;
`tama-system` does not touch his live Tamarada.

## Agents do not talk to each other

They write messages, and a message is a record too. `docs/MESSAGE-RECORD.md`
defines it. There is deliberately no channel: a private line between two agents
would make them easier to wire together and make *who told this agent to do
that* unanswerable, which is the question this whole repository exists to keep
answerable.

Two properties carry the weight. Messages are **append-only** — a recipient
answers with its own message rather than setting a status on somebody else's
row, so every row still has exactly one writer. And every message records
`authorizedBy`, a chain that ends at a person or does not end: a task with no
chain is a *suggestion*, and the recipient may raise it but not act on it.

That last one is the defence against the real failure. Text from outside reaches
one agent, and one agent can start a session on another. An injected instruction
can only ever produce an unauthorized message, so it stops at the first agent
instead of arriving at his live Tamarada wearing a task's clothes.

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

## The manager

```bash
npm install
FLEET_SECRET=... DATABASE_URL=... npm start
```

Five routes, all of them agent-initiated, because the manager cannot call an
agent — a Claude session is either mid-turn or does not exist.
`docs/PROTOCOL.md` has the wire format and the reasoning; the short version is
three questions asked of every request, and they are not equally strong.

A shared secret says the request came from the fleet at all, and that one is a
wall. The agent then names itself out of a file in its own repository, and
**nothing verifies that** — it is recorded as a claim, cross-checked against the
register, and never treated as proof. Authority is the third question and the
only one that decides whether anything happens: a live grant the agent cited,
or an approval a person wrote. Neither of those passes through the agent
asking.

The weak middle question is survivable because of what it does not buy. An
agent borrowing another agent's name still cannot produce authority, so it
gains a label and no access. What the name is really for is afterwards: every
row carries the Claude session that wrote it, so a question about who asked for
something is answered by opening that session and reading it.

Two things are enforced by the database rather than by anybody remembering
them. Messages, approvals, check-ins and the audit refuse updates and deletes
with an exception rather than silently ignoring them; and `authorized_by` can
only ever hold null or a grant citation, so the value that would mean *a person
agreed* cannot be written by the thing that wants it to be true.

| Route | |
|---|---|
| `POST /messages` | Write a task or a reply. Idempotent on a client-chosen id. |
| `GET /inbox` | Unanswered messages, live grants, and where the rules are. |
| `POST /checkin` | Awake, still working, or done — and on what. |
| `POST /wake` | Ask that an agent be woken. The manager decides whether it is worth a session. |

## The page

One page, and it is the only place an approval is written. It shows what is
waiting on a person, which chat each agent currently is, the standing grants,
and the last few wakes including the ones that were suppressed.

**Nothing that a person does here accepts the fleet secret, and nothing an
agent does accepts the session cookie.** That is the wall the whole design
rests on, so it is tested in both directions rather than assumed: an agent
presenting the fleet secret to the approve route gets bounced to the sign-in
page, and a browser session presenting its cookie to the message route is told
it is not from the fleet.

Signing in is Google's authorization code flow, and the email arrives from
Google's own userinfo endpoint over TLS rather than from a token this server
decodes — there is no signature to verify and no library to keep current. Only
the one recorded account gets in; every cookie signed for anybody else stops
working the moment that variable changes.

Two things follow from the manager answering at a subdomain of the name it
governs, because a browser treats those as one site. The session cookie takes
the `__Host-` prefix, which browsers refuse to set with a `Domain` attribute at
all, so a cookie written on the parent name cannot arrive here. And every
action carries a CSRF token, because `SameSite` does not separate two names a
browser considers the same site.

Approving writes an approval row and never touches the message. Issuing a grant
is the other half — a grant is what an agent cites instead of waiting, so
issuing one is how a whole category of work stops needing a click. Revoking is
immediate and retroactive: a message citing a revoked grant goes back to being
a suggestion on the next read, and the grant row stays, because a grant that
could only be deleted would take with it the evidence that anything was ever
authorised under it.

Waking is the only expensive thing here: a message is a row, a wake is a whole
Claude session. So writing never wakes anybody, and the manager decides
separately — on a budget, never one wake per message, never for a reply, and
never for an agent already checked in as working. **A wake that is suppressed
is written down**, because a dropped wake that leaves no trace makes a busy day
and a broken one look identical.

The environment it needs: `DATABASE_URL` and `FLEET_SECRET`, without which it
refuses to start rather than serving requests it cannot honour. Then
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAIL`, `SESSION_SECRET` and
`PUBLIC_URL` for the page — missing those, the API still runs and the page says
which ones are absent, which is worth knowing because until somebody can sign
in there is no way to authorise anything at all. Optionally
`WAKE_BUDGET_PER_DAY`, `SESSION_STALE_HOURS` and `WAKE_SESSIONS`.

### Deploying it

A service of its own, on its own database, reachable at its own name. The
migrations run at boot from `db/`, `/health` is the healthcheck, and
`railway.json` carries the rest.

Sharing a domain with his Tamarada is fine and sharing anything else is not. A
subdomain is a DNS record; what has to stay separate is the process serving the
request and the database behind it. Point the record straight at the manager
rather than through anything his Tamarada also depends on — the manager is what
should still answer when his Tamarada does not.

One consequence of the shared name: a browser treats `manager.example.com` and
`example.com` as one site, so the session cookie takes the `__Host-` prefix,
which browsers refuse to set with a `Domain` attribute at all. That is what
stops a cookie written on the parent name from arriving here.

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
