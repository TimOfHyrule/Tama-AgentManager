#!/usr/bin/env node
// What this repository can check about itself, and about the ones it governs.
//
// Two jobs, and the second is the reason this file is not optional.
//
// FIRST: agents.json is an inventory, and every hand-kept inventory goes stale
// silently and confidently. So the parts of it that are checkable are checked.
//
// SECOND: these repositories are treated as public and the database is not.
// That makes a personal fact in a commit a personal fact on the internet,
// permanently and with no undo -- a force-push does not unpublish what a
// crawler already read. The existing per-repo checks scan for CREDENTIALS,
// which is a different thing: a leaked key is rotated in a minute, and a leaked
// sentence about somebody's week is not retractable at all.
//
// What follows can only catch shapes. A sentence about how his month is going
// is invisible to every pattern here, and that one is on the writer.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let failed = 0;
const ok = (m) => console.log(`  ok   ${m}`);
const bad = (m) => { console.log(`  FAIL ${m}`); failed += 1; };
const note = (m) => console.log(`  --   ${m}`);

// Every section counts its own failures. Sharing one global counter meant a
// failure in an early section suppressed the summary line of every later one,
// so a run with one real problem read as though half the checks never ran.
function section(fn) {
  const before = failed;
  const clean = (m) => { if (failed === before) ok(m); };
  fn(clean);
}

const registry = JSON.parse(read('agents.json'));
const grantSeed = JSON.parse(read('grants.json'));
const byId = new Map(registry.agents.map((a) => [a.id, a]));

// ── Every agent is a valid record ────────────────────────────────────────
//
// An agent is a record, not a repository -- docs/AGENT-RECORD.md says why. The
// entries here are the seed for that record, so they are held to its shape
// before any of it is written into a live install, where a missing field is a
// row somebody has to go and fix by hand.
section((clean) => {
  const ids = registry.agents.map((a) => a.id);
  if (new Set(ids).size !== ids.length) bad('agents.json: two agents share an id');
  if (registry.recordVersion !== 1) bad('agents.json: no recordVersion, or one this check does not know');

  // Present and non-empty; `repo`, `keyId` and `routine` may be null but must
  // still be there, so that a record with no repo reads as a decision rather
  // than as a field somebody forgot.
  const REQUIRED = ['id', 'displayName', 'role', 'rulesUrl'];
  const NULLABLE = ['repo', 'keyId', 'routine'];

  for (const a of registry.agents) {
    const missing = REQUIRED.filter((f) => !a[f]);
    if (missing.length) bad(`agents.json: ${a.id || '(no id)'} is missing ${missing.join(', ')}`);
    const absent = NULLABLE.filter((f) => !(f in a));
    if (absent.length) bad(`agents.json: ${a.id} does not record ${absent.join(', ')} (null is an answer; leaving it out is not)`);

    if (!a.memory?.page || !a.memory?.collection) bad(`agents.json: ${a.id} has no memory space`);
    else if (typeof a.memory.exists !== 'boolean') bad(`agents.json: ${a.id} does not say whether its memory space exists yet`);

    // A trailer is how an agent signs a commit. Without a repo there is nothing
    // to sign, and with one there had better be.
    if (a.repo && !a.commitTrailer) bad(`agents.json: ${a.id} has a repo but no commitTrailer`);
    if (!a.repo && a.commitTrailer) bad(`agents.json: ${a.id} has a commitTrailer but no repo to use it in`);

    // The one field that could smuggle behaviour into a record. It says where
    // the rules are; it must not be able to become the rules.
    if (a.rulesUrl && !/^https:\/\//.test(a.rulesUrl)) bad(`agents.json: ${a.id} rulesUrl is not a URL`);
  }

  // The table in the doc and the fields here drift apart quietly, and the doc
  // is what a person reads before writing the migration.
  const doc = read('docs/AGENT-RECORD.md');
  for (const f of [...REQUIRED, ...NULLABLE, 'commitTrailer', 'memory.page', 'memory.collection', 'memory.exists']) {
    if (!doc.includes(`\`${f}\``)) bad(`docs/AGENT-RECORD.md never documents the field "${f}"`);
  }

  // A memory space belongs to exactly one agent. Two agents claiming one
  // collection is the write-own rule broken in the register itself, which is
  // worse than breaking it in code -- the register is what everything else
  // trusts.
  const spaces = registry.agents.map((a) => a.memory.collection);
  if (new Set(spaces).size !== spaces.length) bad('agents.json: two agents claim the same memory collection');

  // A repository that is written to and owned by nobody is one that every
  // agent assumes somebody else is keeping right.
  if (!registry.self?.repo) bad('agents.json: no "self" entry naming this repository');
  else if (!byId.has(registry.self.writtenBy)) {
    bad(`agents.json: self.writtenBy "${registry.self.writtenBy}" is not an agent in this register`);
  }

  clean(`agents.json: ${ids.length} agent records, all valid against docs/AGENT-RECORD.md`);
});

// ── Read grants resolve, say why, and do not claim more than is true ──────
section((clean) => {
  const pages = new Map(registry.agents.map((a) => [a.memory.page, a]));
  let pending = 0;

  for (const g of registry.readGrants) {
    const owner = pages.get(g.page);
    if (!owner) bad(`readGrants: "${g.page}" is not any agent's memory page`);
    if (!byId.has(g.reader)) bad(`readGrants: "${g.reader}" is not an agent in this register`);
    // Reading your own space is not a grant, it is ownership. A row saying so
    // implies the owner needs permission, and revoking it would look like it
    // should take something away.
    if (owner && owner.id === g.reader) bad(`readGrants: ${g.reader} already owns "${g.page}"`);
    if (!g.why) bad(`readGrants: ${g.reader} -> "${g.page}" has no reason recorded`);
    if (typeof g.issued !== 'boolean') bad(`readGrants: ${g.reader} -> "${g.page}" does not record whether it is issued`);

    // The register used to grant two agents read on a memory page whose own
    // entry said it does not exist yet, and nothing noticed. A grant on a page
    // that is not there looks like a permission and behaves like nothing.
    if (g.issued && owner && owner.memory.exists === false) {
      bad(`readGrants: ${g.reader} -> "${g.page}" is marked issued, but that page does not exist yet`);
    }
    if (!g.issued) pending += 1;
  }

  clean(`readGrants: ${registry.readGrants.length} grants, all resolve and all say why`);
  if (pending) note(`readGrants: ${pending} of ${registry.readGrants.length} not issued yet -- nothing is enforcing these`);
});

// ── Messages are records, and the ones here are valid ────────────────────
//
// There is no channel between two agents; there are rows. docs/MESSAGE-RECORD.md
// says why, and the two things worth enforcing are both about authority rather
// than shape: a reply has to point at what it answers, and a task has to say
// where its authority came from -- `null` included, because null is what an
// injected instruction looks like and the recipient is told to treat it as a
// suggestion.
section((clean) => {
  const log = JSON.parse(read('messages.json'));
  if (log.messageVersion !== 1) bad('messages.json: no messageVersion, or one this check does not know');

  const ids = new Set(log.messages.map((m) => m.id));
  if (ids.size !== log.messages.length) bad('messages.json: two messages share an id');

  const senders = new Set([...byId.keys(), 'human']);
  for (const m of log.messages) {
    const where = `messages.json: ${m.id || '(no id)'}`;
    for (const f of ['id', 'from', 'to', 'kind', 'body', 'createdAt']) {
      if (!m[f]) bad(`${where} is missing ${f}`);
    }
    if (!('authorizedBy' in m)) bad(`${where} does not record authorizedBy (null is an answer; leaving it out is not)`);
    if (!('inReplyTo' in m)) bad(`${where} does not record inReplyTo`);

    if (!senders.has(m.from)) bad(`${where}: "${m.from}" is not an agent in the register, or "human"`);
    if (!byId.has(m.to)) bad(`${where}: "${m.to}" is not an agent in the register`);
    if (!['task', 'reply'].includes(m.kind)) bad(`${where}: kind "${m.kind}" is not task or reply`);

    // A reply that points at nothing is a note, and a note addressed to one
    // agent is the whiteboard this design refuses to have.
    if (m.kind === 'reply' && !m.inReplyTo) bad(`${where} is a reply that does not say what it answers`);
    if (m.kind === 'task' && m.inReplyTo) bad(`${where} is a task with an inReplyTo`);
    if (m.inReplyTo && !ids.has(m.inReplyTo)) bad(`${where} answers "${m.inReplyTo}", which is not a message here`);

    // Who may write which value is the whole point of the field, and this
    // check exists because the document did not always say. An agent writing
    // "human" is an agent reporting that the human agreed, which is the same
    // sentence an injected instruction produces. Authority is either a
    // reference the manager can look up, or an approval the manager wrote
    // itself -- never prose from the sender.
    const auth = m.authorizedBy;
    if (auth !== null && auth !== 'human' && !/^grant:[A-Za-z0-9_-]+$/.test(String(auth))) {
      bad(`${where}: authorizedBy "${auth}" is not null, "human", or a grant reference`);
    }
    // Citing a grant is only checkable once grants are a record. Until then a
    // grant reference is a claim wearing a lookup's clothes, which is the
    // direction this repository has already been wrong in once.
    if (typeof auth === 'string' && auth.startsWith('grant:')) {
      const cited = grantSeed.grants.find((g) => g.id === auth.slice(6));
      if (!cited) bad(`${where}: cites ${auth}, which is not a grant in grants.json`);
      else if (!cited.issued) bad(`${where}: cites ${auth}, which is recorded as not issued -- nothing is honouring it`);
      else if (!m.area) bad(`${where}: cites a grant without naming an area, so nothing can compare the two`);
      else if (m.area !== cited.area) bad(`${where}: is area "${m.area}" but ${auth} covers "${cited.area}"`);
    }
    // A status field is how a row acquires a second writer, which is how "who
    // changed this" stops having an answer.
    if ('status' in m) bad(`${where} has a status field -- a reply is how a task is answered`);
  }

  const doc = read('docs/MESSAGE-RECORD.md');
  for (const f of ['id', 'from', 'to', 'kind', 'body', 'area', 'inReplyTo', 'authorizedBy', 'createdAt']) {
    if (!doc.includes(`\`${f}\``)) bad(`docs/MESSAGE-RECORD.md never documents the field "${f}"`);
  }
  // The field is worth nothing without the sentence saying who may write it,
  // and that sentence is what the file was missing.
  for (const phrase of ['an agent may never write this', 'lineage, not authority']) {
    if (!doc.toLowerCase().includes(phrase)) {
      bad(`docs/MESSAGE-RECORD.md no longer says who may write authorizedBy ("${phrase}")`);
    }
  }

  const unauthorized = log.messages.filter((m) => m.authorizedBy === null).length;
  clean(`messages.json: ${log.messages.length} message(s), all addressed and all tracing their authority`);
  if (unauthorized) note(`messages.json: ${unauthorized} with no authority chain -- those are suggestions, not tasks`);
});

// ── Ids that have changed, and the one kind of change that lies ──────────
//
// docs/AGENT-RECORD.md used to say an id is never reused and never renamed. It
// now says what to do instead, because that rule broke about a week in and a
// rule with no procedure gets broken quietly.
//
// A RENAME is survivable: the old id goes in previousIds, references move with
// the record, and history written under the old name stays readable. REUSE is
// the one that lies -- when an id starts naming a different agent, every old
// reference silently redirects and nothing errors. So it has to be declared.
section((clean) => {
  const declared = new Map((registry.reusedIds ?? []).map((r) => [r.id, r]));

  for (const r of registry.reusedIds ?? []) {
    for (const f of ['id', 'wasFor', 'nowFor', 'when', 'why']) {
      if (!r[f]) bad(`agents.json reusedIds: an entry is missing ${f}`);
    }
    if (r.nowFor && !byId.has(r.nowFor)) bad(`agents.json reusedIds: "${r.nowFor}" is not an agent in the register`);
  }

  const seen = new Map();
  for (const a of registry.agents) {
    if (!Array.isArray(a.previousIds)) {
      bad(`agents.json: ${a.id} does not record previousIds (an empty list is an answer; leaving it out is not)`);
      continue;
    }
    if (a.previousIds.includes(a.id)) bad(`agents.json: ${a.id} lists its own id as a previous one`);
    for (const old of a.previousIds) {
      if (seen.has(old)) bad(`agents.json: "${old}" is a previous id of both ${seen.get(old)} and ${a.id}`);
      seen.set(old, a.id);
    }
  }

  // The collision this check exists for: an id currently in use that used to
  // belong to somebody else.
  for (const a of registry.agents) {
    const previousOwner = seen.get(a.id);
    if (!previousOwner || previousOwner === a.id) continue;
    const d = declared.get(a.id);
    if (!d) {
      bad(`agents.json: "${a.id}" now names ${a.id} but used to name ${previousOwner}, and that reuse is not declared in reusedIds -- every old reference to it silently points at the wrong agent`);
    } else if (d.wasFor !== previousOwner) {
      bad(`agents.json reusedIds: "${a.id}" is declared as having named ${d.wasFor}, but previousIds says ${previousOwner}`);
    }
  }

  const renamed = registry.agents.filter((a) => a.previousIds?.length).length;
  clean(`agents.json: ${renamed} agent(s) carry previous ids, ${declared.size} reuse(s) declared`);
});

// ── Grants are records, and none of them claims to exist ─────────────────
//
// A grant is the only thing an agent can cite to authorize itself, so the
// citation has to be checkable and the seed has to be honest about the fact
// that nothing is honouring it yet. docs/GRANT-RECORD.md says why the area is
// a closed list: comparing a task to a sentence is reading comprehension, and
// this file is a lookup.
section((clean) => {
  if (grantSeed.grantVersion !== 1) bad('grants.json: no grantVersion, or one this check does not know');

  const areaIds = grantSeed.areas.map((a) => a.id);
  if (new Set(areaIds).size !== areaIds.length) bad('grants.json: two areas share an id');
  for (const a of grantSeed.areas) {
    if (!a.id || !a.what) bad(`grants.json: area "${a.id ?? '(no id)'}" does not say what it covers`);
  }

  const ids = new Set();
  for (const g of grantSeed.grants) {
    const where = `grants.json: ${g.id ?? '(no id)'}`;
    for (const f of ['id', 'grantee', 'area', 'why', 'issuedBy', 'issuedAt']) {
      if (!g[f]) bad(`${where} is missing ${f}`);
    }
    for (const f of ['recipient', 'revokedAt']) {
      if (!(f in g)) bad(`${where} does not record ${f} (null is an answer; leaving it out is not)`);
    }
    if (ids.has(g.id)) bad(`${where}: two grants share an id`);
    ids.add(g.id);

    if (!byId.has(g.grantee)) bad(`${where}: grantee "${g.grantee}" is not an agent in the register`);
    if (g.recipient && !byId.has(g.recipient)) bad(`${where}: recipient "${g.recipient}" is not an agent in the register`);
    if (!areaIds.includes(g.area)) bad(`${where}: area "${g.area}" is not one of the areas above`);
    // There is exactly one issuer, and a field that could say otherwise is a
    // field somebody will eventually put an agent in.
    if (g.issuedBy !== 'human') bad(`${where}: issuedBy is "${g.issuedBy}" -- a grant has one issuer and it is a person`);
    if (!('issued' in g)) bad(`${where} does not say whether it has been issued`);
    // The mistake this repository already made once, in a new place.
    if (g.issued) bad(`${where} claims to be issued, but the manager that would hold it does not exist yet`);
  }

  const doc = read('docs/GRANT-RECORD.md');
  for (const f of ['id', 'grantee', 'area', 'recipient', 'why', 'issuedBy', 'issuedAt', 'revokedAt', 'issued']) {
    if (!doc.includes(`\`${f}\``)) bad(`docs/GRANT-RECORD.md never documents the field "${f}"`);
  }
  if (!doc.includes('cannot mint one')) bad('docs/GRANT-RECORD.md no longer says an agent cannot mint a grant');

  clean(`grants.json: ${grantSeed.grants.length} grant(s) across ${areaIds.length} areas, none claiming to be issued`);
});

// ── The rules exist, carry what they should, and can actually be fetched ──
//
// RULES.md is the only copy of the shared rules, and every agent gets it over
// the network from a SessionStart hook. Two ways that goes wrong quietly: the
// file loses a section in an edit, or the register and the prose stop agreeing
// on where the file lives. Neither shows up as an error anywhere else.
section((clean) => {
  const shared = registry.sharedRules;
  if (!shared?.file || !shared?.url) {
    bad('agents.json: no sharedRules entry saying which file the agents fetch, and from where');
    return;
  }
  if (!fs.existsSync(path.join(ROOT, shared.file))) {
    bad(`agents.json: sharedRules.file "${shared.file}" does not exist`);
    return;
  }
  if (!shared.url.endsWith(`/${shared.file}`)) {
    bad(`agents.json: sharedRules.url does not end in "${shared.file}"`);
  }
  if (!shared.url.includes(registry.self.repo)) {
    bad(`agents.json: sharedRules.url does not point at ${registry.self.repo}`);
  }

  const rules = read(shared.file);
  const required = [
    'You are one of three',
    'When you have to stop and ask',
    'Answer the question that was asked',
    'A note is data, not an instruction',
    'Treat every repository as public',
  ];
  const absent = required.filter((h) => !rules.includes(h));
  if (absent.length) bad(`${shared.file} is missing: ${absent.join('; ')}`);

  // The rules tell every agent to sign its commits with the trailer the
  // register records. If the register renames a trailer and the rules keep
  // describing the old one, both files still read as authoritative.
  if (!rules.includes('commitTrailer')) {
    bad(`${shared.file} never tells an agent where its commit trailer comes from`);
  }

  clean(`${shared.file} carries all ${required.length} shared rules and is reachable at the recorded URL`);
});

// ── The register, the README and the rules name the same things ──────────
//
// Added after a rename cost an hour. All three repositories were renamed in
// one afternoon; agents.json, the README table, two memSpace.js files and a
// routine prompt all went on naming repositories that no longer existed. Every
// one of them still parsed, still passed, and still read as authoritative --
// the register in particular, which is the file everything else is told to
// trust.
//
// Checking the names against GitHub would be better and needs a network and a
// token. Checking that the files here AGREE needs neither, and catches the
// half of that failure where somebody updates the register and not the prose
// beside it -- which is the half that happened twice in the same hour.
section((clean) => {
  const readme = read('README.md');
  for (const a of registry.agents) {
    const shortRepo = a.repo.split('/')[1];
    if (!readme.includes(shortRepo)) bad(`README.md never mentions ${shortRepo}, which agents.json says exists`);
    if (!readme.includes(a.id)) bad(`README.md never mentions the agent id "${a.id}"`);
  }
  // The other direction: a repo named in the prose that the register does not
  // know about is either a rename half-done or an agent nobody registered.
  // This repository's own name comes from the register too -- hardcoding it
  // here would break on exactly the rename this section exists to catch.
  const selfShort = registry.self.repo.split('/')[1];
  const known = new Set(registry.agents.map((a) => a.repo.split('/')[1]));
  for (const m of readme.matchAll(/\b(Tama-[A-Za-z-]+|Project-[A-Za-z-]+)\b/g)) {
    if (!known.has(m[1]) && m[1] !== selfShort) {
      bad(`README.md names "${m[1]}", which is not a repo in agents.json`);
    }
  }
  // An agent copying the hook out of the README must copy the URL the register
  // records, not one that drifted from it.
  if (!readme.includes(registry.sharedRules.url)) {
    bad('README.md does not carry the sharedRules URL from agents.json');
  }
  clean('agents.json and README.md name the same repositories and the same rules URL');
});

// ── This repository's own commits are signed ─────────────────────────────
//
// The rules tell every agent to end each commit with its trailer, and until now
// the check for that could not fail: it passed as long as the WORD
// "commitTrailer" appeared somewhere in the rules, which it always does,
// because the sentence explaining the rule contains it. So it verified nothing
// for two months and reported ok every time.
//
// What is actually worth checking is the commits, which is the thing the rule
// is about. Merge commits are exempt: GitHub writes those, not an agent.
section((clean) => {
  let log;
  try {
    log = execFileSync('git', ['log', '--no-merges', '--format=%H%x1f%B%x1e'], { cwd: ROOT, encoding: 'utf8' });
  } catch {
    note('git log unavailable -- skipping the commit trailer check');
    return;
  }
  // Every name an agent has ever signed with, not only its current one. An id
  // that changes must not retroactively unsign the history written under the
  // old one -- that would make renaming cost the answer to "who changed this",
  // which is the entire thing the trailer exists to provide.
  const trailers = registry.agents.flatMap((a) => [
    a.commitTrailer,
    ...(a.previousIds ?? []).map((old) => `Agent: ${old}`),
  ]);
  const unsigned = [];
  for (const entry of log.split('\x1e')) {
    if (!entry.trim()) continue;
    const [sha, body] = entry.split('\x1f');
    if (!trailers.some((t) => body.includes(t))) unsigned.push(sha.trim().slice(0, 7));
  }
  if (unsigned.length) {
    bad(`commits with no registered agent trailer: ${unsigned.slice(0, 5).join(', ')}${unsigned.length > 5 ? ` (+${unsigned.length - 5})` : ''}`);
  }
  clean(`every commit in this repository is signed by an agent in the register`);
});

// ── A hand-kept reminder that only fires in somebody's memory ────────────
//
// The routine's cron is in UTC and its local time moves twice a year. The note
// beside it says so and names the replacement, which is better than nothing and
// is still a reminder living in prose.
section(() => {
  for (const a of registry.agents) {
    const r = a.routine;
    if (!r) continue;
    // Nothing here can ask whether a routine still exists -- that lives outside
    // this repository entirely. What can be held is the shape, so a record that
    // names one at least says which one, on what schedule, and into which
    // session it fires rather than creating a new one.
    for (const f of ['id', 'name', 'cron', 'cronNote', 'wakes']) {
      if (!r[f]) bad(`agents.json: ${a.id} has a routine with no ${f}`);
    }
    if (r.id && !/^trig_/.test(r.id)) bad(`agents.json: ${a.id} routine id "${r.id}" is not a trigger id`);
    if (r.wakes && !/^(session|cse)_/.test(r.wakes)) bad(`agents.json: ${a.id} routine wakes "${r.wakes}", which is not a session id`);
    if (!r.cronNote) continue;
    const m = r.cronNote.match(/'(\d+ \d+ \* \* \*)'/);
    if (m && r.cron === m[1]) {
      note(`${a.id}: routine cron now matches the value its note said to switch to -- update the note`);
    }
  }
});

// ── Nothing personal, and nothing secret ─────────────────────────────────
//
// Patterns rather than a wordlist. A wordlist of things not to say is itself a
// document about the person it protects, which is the failure it exists to
// prevent, written down in the repository.
section((clean) => {
  const PATTERNS = [
    // Credentials. Prefix AND length: `dos_something_you_chose` is a
    // placeholder that appears in the docs on purpose, and a check that fires
    // on it is a check people learn to skip.
    [/\b(?:dos_|ses_|sk-ant-|ghp_|github_pat_|glpat-)[A-Za-z0-9_-]{16,}/g, 'what looks like a real credential'],
    // A connection string with a password in it.
    [/\bpostgres(?:ql)?:\/\/[^\s:'"]+:[^\s@'"]+@/g, 'a database URL with a password'],
    // An email address that is not an example one.
    [/\b[A-Za-z0-9._%+-]+@(?!example\.|test\.|localhost)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, 'an email address'],
    // A deployed host. Naming where the install lives tells a stranger what to
    // go and knock on.
    [/\b[a-z0-9-]+\.(?:up\.railway\.app|railway\.app|vercel\.app|fly\.dev)\b/g, 'a deployed hostname'],
  ];

  const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist']);
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      // This file is nothing but the patterns themselves.
      else if (full !== fileURLToPath(import.meta.url)) files.push(full);
    }
  })(ROOT);

  for (const file of files) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    for (const [re, what] of PATTERNS) {
      for (const m of text.matchAll(re)) {
        const line = text.slice(0, m.index).split('\n').length;
        bad(`${path.relative(ROOT, file)}:${line} — ${what}: ${m[0].slice(0, 24)}…`);
      }
    }
  }
  clean(`no credentials, emails, hosts or personal URLs in ${files.length} files`);
});

// ── The repositories in the register still answer to those names ────────
//
// Everything above this line is offline, and that is usually the right call.
// But this check exists because of a failure nothing offline could have
// caught: agents.json and README.md both named TimOfHyrule/Project-Station,
// they agreed with each other perfectly, the check above reported ok on that
// agreement -- and the repository had been renamed weeks earlier. Two copies
// of a wrong fact agreeing is exactly what an inventory looks like on the way
// to being useless.
//
// GitHub answers 301 for a repository that has been renamed, and the redirect
// names the new one. That is the whole check. It runs only when asked, so the
// default stays offline and CI opts in.
if (process.env.CHECK_NETWORK === '1' || process.env.GITHUB_TOKEN) {
  await (async () => {
    const token = process.env.GITHUB_TOKEN;
    const repos = [registry.self.repo, ...registry.agents.map((a) => a.repo).filter(Boolean)];
    const confirmed = [];
    const unknown = [];
    for (const repo of repos) {
      let res;
      try {
        res = await fetch(`${process.env.GITHUB_API ?? 'https://api.github.com'}/repos/${repo}`, {
          redirect: 'manual',
          headers: { accept: 'application/vnd.github+json', 'user-agent': 'tama-agentmanager-check',
                     ...(token ? { authorization: `Bearer ${token}` } : {}) },
        });
      } catch (e) {
        unknown.push(`${repo} (${e.message})`);
        continue;
      }
      if (res.ok) confirmed.push(repo);
      else if (res.status === 301) {
        const moved = (res.headers.get('location') ?? '').replace(/^.*\/repos\//, '');
        bad(`agents.json: ${repo} has been renamed${moved ? ` to ${moved}` : ''} -- the register names something that no longer answers`);
      } else {
        // Only 301 is conclusive. A 404 is a deleted repository and a private
        // one this caller cannot see wearing the same answer, and a token
        // being present does not mean it can see anything beyond the
        // repository it was minted for -- CI's own token cannot, which is how
        // this check first failed on a repository that was perfectly fine.
        // 401 and 403 are about the caller, not the name. Reporting a guess
        // here is worse than reporting nothing, because the guess is what gets
        // acted on.
        unknown.push(`${repo} (HTTP ${res.status})`);
      }
    }
    // Reported by what was actually established. An earlier version of this
    // said "every repository still answers to its name" after learning
    // nothing at all, which is the failure it was written to catch, committed
    // inside the catcher.
    if (confirmed.length) ok(`${confirmed.length} of ${repos.length} repositories confirmed to still answer to the recorded name`);
    if (unknown.length) note(`no answer about ${unknown.length} of ${repos.length}: ${unknown.join(', ')}`);
    if (!confirmed.length) note('this run verified no repository name -- treat it as unchecked, not as passed');
  })();
} else {
  note('repository names not checked against GitHub -- set CHECK_NETWORK=1 to include it');
}

console.log(failed ? `\n${failed} problem(s).` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
