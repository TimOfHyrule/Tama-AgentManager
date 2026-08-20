-- The manager's own database. docs/BOUNDARIES.md says why this is a third
-- place and not a page in his install: two of the three agents can write to
-- that install, and an approval those agents can write is not an approval.
--
-- Nothing here holds a secret. Keys arrive later as identifiers only.

-- ── Messages ─────────────────────────────────────────────────────────────
--
-- One writer per row, forever. The two constraints below are the two rules in
-- docs/MESSAGE-RECORD.md that were prose until now.
create table agent_message (
  id             text primary key,
  from_agent     text        not null,
  to_agent       text        not null,
  kind           text        not null check (kind in ('task', 'reply')),
  body           text        not null,
  area           text,
  in_reply_to    text        references agent_message (id),
  authorized_by  text,
  origin_session text        not null,
  claimed_repo   text,
  created_at     timestamptz not null default now(),

  -- A reply says what it answers; a task does not pretend to answer anything.
  constraint reply_points_somewhere check (
    (kind = 'reply' and in_reply_to is not null) or
    (kind = 'task'  and in_reply_to is null)
  ),

  -- The wall. `human` is not a value an agent can write here, because it is
  -- not a value anything writes here -- approval is its own row below. What is
  -- left is null (no authority) or a citation the manager can look up.
  constraint authority_is_null_or_a_citation check (
    authorized_by is null or authorized_by ~ '^grant:[A-Za-z0-9_-]+$'
  ),

  -- A citation the manager cannot compare against anything is a claim wearing
  -- a lookup's clothes. Written to fire only on an actual citation, so that a
  -- refused `human` is refused by the constraint that is about `human` and the
  -- error names the real reason.
  constraint a_citation_names_its_area check (
    authorized_by !~ '^grant:' or area is not null
  )
);

create index agent_message_inbox on agent_message (to_agent, created_at desc);
create index agent_message_answers on agent_message (in_reply_to);

-- ── Approvals ────────────────────────────────────────────────────────────
--
-- The person's signature, written by the manager at the moment they approved,
-- in a row of its own so the agent's row keeps exactly one writer.
create table approval (
  id          bigserial   primary key,
  message_id  text        not null unique references agent_message (id),
  approver    text        not null,
  approved_at timestamptz not null default now(),
  note        text
);

-- ── Grants ───────────────────────────────────────────────────────────────
--
-- "grant" is a reserved word, hence the name. docs/GRANT-RECORD.md defines the
-- record; `area` is a closed list so that checking a citation is a string
-- comparison and never reading comprehension.
create table standing_grant (
  id         text        primary key,
  grantee    text        not null,
  area       text        not null,
  recipient  text,
  why        text        not null,
  issued_by  text        not null default 'human' check (issued_by = 'human'),
  issued_at  timestamptz not null default now(),
  revoked_at timestamptz
);

-- ── Check-ins ────────────────────────────────────────────────────────────
--
-- Who is awake and on what. Each agent writes only its own, and nothing here
-- marks anybody else's work done -- that is still derived from whether a reply
-- exists. This answers a different question, one that had no answer at all:
-- is this agent alive right now.
create table checkin (
  id      bigserial   primary key,
  agent   text        not null,
  session text        not null,
  state   text        not null check (state in ('started', 'working', 'ended')),
  what    text,
  learned text,
  at      timestamptz not null default now()
);

create index checkin_latest on checkin (agent, at desc);

-- ── Wakes ────────────────────────────────────────────────────────────────
--
-- Including the ones that did not happen. A budget that drops a wake silently
-- leaves a day that looks exactly like a quiet one.
create table wake (
  id                bigserial   primary key,
  agent             text        not null,
  reason            text        not null,
  delivered         boolean     not null,
  suppressed_reason text,
  at                timestamptz not null default now()
);

create index wake_recent on wake (agent, at desc);

-- ── Audit ────────────────────────────────────────────────────────────────
create table audit (
  id     bigserial   primary key,
  kind   text        not null,
  actor  text,
  detail jsonb       not null default '{}'::jsonb,
  at     timestamptz not null default now()
);

-- ── Append-only, enforced ────────────────────────────────────────────────
--
-- It raises rather than silently ignoring. A refused write that looks like a
-- successful one is the failure mode this whole repository keeps finding.
create or replace function refuse_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'append-only: % on % is refused', tg_op, tg_table_name;
end $$;

create trigger agent_message_append_only
  before update or delete on agent_message
  for each row execute function refuse_mutation();

create trigger approval_append_only
  before update or delete on approval
  for each row execute function refuse_mutation();

create trigger checkin_append_only
  before update or delete on checkin
  for each row execute function refuse_mutation();

create trigger audit_append_only
  before update or delete on audit
  for each row execute function refuse_mutation();

-- standing_grant is deliberately not in that list: revoking sets revoked_at,
-- and a grant that could only be deleted would take the evidence with it.
