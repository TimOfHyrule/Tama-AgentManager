-- The manager does not deliver wakes, and the wake table was shaped as though
-- it did.
--
-- Delivering one means putting a message into a running Claude session, which
-- needs a credential for the whole account on the machine holding it. That is
-- the wrong thing to give a server whose entire design is that it should not
-- have to be trusted with much. So the agents poll instead, on their own
-- schedules, and a wake is a REQUEST that the next poll satisfies.
--
-- `delivered` stays for the rows written before this and stops being written.
-- The outcome column says which of three things happened, because "false"
-- was covering both "we decided not to" and "we tried and could not", and
-- those are not the same answer.
alter table wake add column outcome text
  check (outcome in ('queued', 'suppressed', 'delivered'));

update wake set outcome = case
  when delivered then 'delivered'
  else 'suppressed'
end;
