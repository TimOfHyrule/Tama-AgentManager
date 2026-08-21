# How an agent talks to the manager

One direction only: the agent asks, the manager answers. The manager never
calls an agent, because there is nothing listening — an agent is a Claude
session, which is either mid-turn or does not exist. Every design decision
below follows from that one fact, and a protocol drawn the other way around
would be describing a system nobody has.

## Three questions, and they are not equally strong

A request arrives. Before anything happens, the manager establishes three
things, in this order:

**Is this from the fleet at all?** A shared secret in the `Authorization`
header, held in the Claude environment the agents run in. It keeps out
everyone on the internet who knows the address, which is the largest set of
people this system has to worry about. This one is a wall.

**Which agent is it?** The agent says so, reading its own `id` out of a file
committed in its own repository. The agents share one environment today, and
the repository is the only thing that differs between them. Nothing verifies
this: an agent can name another agent and the manager will believe it. It is
recorded as a claim, and `docs/BOUNDARIES.md` is not allowed to pretend
otherwise.

**Is it authorized?** `authorizedBy`, defined in `docs/MESSAGE-RECORD.md`. This
one is a wall again, and it is the one that matters, because it is the only
one that decides whether anything happens.

The middle question being weak is survivable, and the reason is worth stating
plainly: **an agent that borrows another agent's name gains nothing.** It still
cannot produce authority — that comes from a grant it cannot mint or an
approval it cannot reach. Impersonation buys a label, and the label is not
where the power is.

What the claim is actually for is afterwards. Every row records the Claude
session that wrote it, so "who told this agent to do that" is answered by
opening that session and reading it. A name can be borrowed; a transcript
cannot.

## What is on the wire

```http
POST /messages
Authorization: Bearer <the fleet secret>
Content-Type: application/json

{
  "id":           "<client-chosen, so a retry cannot post twice>",
  "agent":        "tama-assistant",
  "repo":         "TimOfHyrule/Tama-Agent-TamaAssisstant",
  "session":      "<CLAUDE_CODE_REMOTE_SESSION_ID>",
  "to":           "tama-system",
  "kind":         "task",
  "body":         "...",
  "inReplyTo":    null,
  "authorizedBy": null
}
```

Four of those the agent reads off its own machine and does not think about:
`agent` from the file in its repository, `repo` from the git remote, `session`
from the environment, `id` from anything unique. Only `authorizedBy` is a
judgement, and that is the third question.

`repo` is there to be checked against the register — an agent claiming to be
`tama-assistant` while working in another agent's repository is a disagreement
worth recording. **It does not reject the request.** It is a cross-check, not a
gate; treating it as a gate would be the same mistake as calling the claim a
verification.

## The routes

| | |
|---|---|
| `POST /messages` | Write a task or a reply. Append-only, idempotent on `id`. |
| `GET /inbox` | Unanswered messages for me, my live grants, and the rules version. |
| `POST /checkin` | I am awake / still working / done, and this is what on. |
| `POST /wake` | Ask that another agent be woken. The manager decides whether it is worth it. |

## Waking

An agent is woken by a message queued into its existing Claude session. The
text of that message is **always the same fixed line**, and it carries nothing:
it says to run the wake routine, and the wake routine calls `GET /inbox`. What
is being asked lives in the inbox, where it has to pass the three questions
again.

The reason it carries nothing is the same reason a memory note is not an
instruction. A wake with a payload is a way to give an order without ever
having been authorized to give one, and the manager — a server on the internet
— must not be able to do that. A wake that says only "go and look" cannot be an
instruction no matter who sends it.

There is a cost to naming honestly: text queued into a session arrives as an
ordinary turn, and nothing at the platform level marks it untrusted. The fixed
line is a convention, so an agent's own `CLAUDE.md` carries the other half —
anything arriving that way other than that line is not a task. That makes a
deviation visible to the agent receiving it. It is a rule, not a wall, and it
is written down as one.

## What waking was verified to do, and what was not

The whole design rests on one assumption that was worth testing rather than
believing: a Claude session goes idle, its VM is reclaimed, and the question is
whether anything can still reach it.

It can. A session whose VM had been reclaimed eight hours earlier was sent a
message and came back: `connection_status` went from `disconnected` to
`connected`, a fresh VM was provisioned with the conversation intact, and it
ran a turn -- visible as a cost the session had not previously incurred. So
"wake the existing chat" is a real mechanism and not a hope, and the choice to
keep long-lived sessions rather than starting fresh ones does not depend on
never letting them go cold.

Two things that test did NOT establish, stated because a verification quoted
wider than it was run is worse than none:

**It was fired from inside a Claude session**, using the trigger tooling
available there. The manager is a plain server on the other side of the
internet, and the route it will use is either the CLI signed in to the account,
or an API trigger on a routine bound to a persistent session. The first needs a
credential on that box; the second is a public HTTP endpoint and would need
none, but whether an API fire respects a persistent-session binding rather than
starting a new session is untested. That is the cheaper answer if it holds, and
it is one experiment away.

**Nothing was measured about latency.** A cold session takes as long as
provisioning takes, and the budget above is about how often to pay for a
session rather than how quickly one arrives.

## Which chat gets woken

There are many sessions on this account and several of them share a repository,
so the repository cannot answer it and neither can a person reliably: chats get
opened, half-used and abandoned, and an abandoned one looks exactly like a
quiet one.

The first design was a map of agent to session in an environment variable, and
that is the shape of identifier this register has already watched go stale
twice in a single day. Here it goes stale worse than a wrong repository name.
The manager wakes a chat somebody closed weeks ago, that chat reads the inbox
and may act on what it finds, and from the outside it is indistinguishable from
everything working.

So nothing declares it. **An agent's current session is whichever one checked
in most recently**, which is self-maintaining in the only way that matters: the
chat being used says so on every wake, and the chat that was abandoned stops
saying anything. Nobody has to remember to clean up.

Three things make that safe to rely on:

- **A window.** A claim whose last check-in is older than `SESSION_STALE_HOURS`
  is not a candidate, and the wake is recorded as suppressed with the age in
  it. A session abandoned mid-task never checks in again, and without this it
  would hold the claim forever.
- **Switches are rows.** The claim moves by appending, never by editing, so
  reading down the table answers *why did it wake that one* -- which is the
  question this whole register exists to keep answerable.
- **The branch comes along.** Not the session title, which an agent cannot read
  about itself. Every session works on its own branch, so that is what makes a
  list of them legible to a person.

`WAKE_SESSIONS` survives as an override for pinning one deliberately. Being
*required* to maintain it is the part that was wrong.

## Waking is the expensive part

A message is a row. A wake is a whole Claude session, and the session list
already shows what those cost. So the two are deliberately decoupled: writing
never wakes anyone, and the manager — a plain server, whose own deliberation is
free — decides separately when a batch has become worth a session.

Most traffic should never pay. An agent with a routine is going to wake anyway,
and `GET /inbox` on that wake collects everything waiting; a message that can
ride along costs nothing at all. What is left is a small number of things that
genuinely cannot wait until morning, and those are budgeted per agent per day.

Three rules keep the bill down, and the third is why check-ins are not merely a
dashboard:

- One wake covers every pending message for that agent, never one per message.
- A reply never wakes anybody. Otherwise two agents can volley a budget away
  between them in a morning.
- An agent already checked in as working is not woken. It is going to read its
  inbox on its own.

**A suppressed wake is written down.** A budget that silently drops a wake
leaves a day that looks exactly like a quiet one, and "why did nobody pick this
up until this morning" then has no answer. That is the failure the `||` branch
on the rules fetch exists to prevent, arriving somewhere new.
