-- Grant ids are cited by messages, so they are short enough to read in a
-- sentence and ordered so a later one is visibly later. A sequence rather than
-- counting rows: two people issuing at once should not be able to produce the
-- same id, and a revoked grant must not free its number for reuse.
create sequence grant_id_seq;
