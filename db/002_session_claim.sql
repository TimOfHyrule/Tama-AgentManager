-- Which session is an agent's current one.
--
-- It used to be a hand-kept map in an environment variable, and that is the
-- shape of identifier this account has already watched go stale twice in one
-- day. Here it would go stale worse: the manager would wake a chat abandoned
-- weeks ago, that chat would read the inbox and possibly act, and from outside
-- it would look exactly like everything working.
--
-- So nobody declares it. An agent checks in on every wake, carrying its own
-- session, and the most recent claim is the answer. A session somebody
-- abandoned stops checking in and falls out of the running on its own.

-- Which branch a session is on. Not the title -- an agent cannot read its own
-- session title, and a label it cannot obtain is a column that stays null. The
-- branch it can read, and each session has its own.
alter table checkin add column branch text;

-- Append-only, like everything else here. A switch is a new row rather than an
-- edit, so "why did it wake that one" is answered by reading down the table.
create table session_claim (
  id         bigserial   primary key,
  agent      text        not null,
  session    text        not null,
  branch     text,
  claimed_at timestamptz not null default now()
);

create index session_claim_latest on session_claim (agent, claimed_at desc);

create trigger session_claim_append_only
  before update or delete on session_claim
  for each row execute function refuse_mutation();
