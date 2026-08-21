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
  "repo":         "TimOfHyrule/Tama-Agent-SystemAgent",
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
