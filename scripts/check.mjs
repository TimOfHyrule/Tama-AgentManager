#!/usr/bin/env node
// What this repository can check about itself, and about the ones it governs.
//
// Two jobs, and the second is the reason this file is not optional.
//
// FIRST: agents.json is an inventory, and every hand-kept inventory goes stale
// silently and confidently. So the parts of it that are checkable are checked.
//
// SECOND: these repositories are PUBLIC and the database is not. That makes a
// personal fact in a commit a personal fact on the internet, permanently and
// with no undo -- a force-push does not unpublish what a crawler already read.
// The existing per-repo checks scan for CREDENTIALS, which is a different
// thing: a leaked key is rotated in a minute, and a leaked sentence about
// somebody's week is not retractable at all.
//
// What follows can only catch shapes. A sentence about how his month is going
// is invisible to every pattern here, and that one is on the writer.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const ok = (m) => console.log(`  ok   ${m}`);
const bad = (m) => { console.log(`  FAIL ${m}`); failed += 1; };

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'agents.json'), 'utf8'));

// ── The register describes something real ────────────────────────────────
{
  const ids = registry.agents.map((a) => a.id);
  if (new Set(ids).size !== ids.length) bad('agents.json: two agents share an id');
  else ok(`agents.json: ${ids.length} agents, ids unique`);

  const missing = registry.agents.filter((a) =>
    !a.repo || !a.role || !a.memory?.page || !a.memory?.collection || !a.commitTrailer);
  if (missing.length) bad(`agents.json: incomplete entries: ${missing.map((a) => a.id).join(', ')}`);
  else ok('agents.json: every agent names a repo, a role, a memory space and a commit trailer');

  // A memory space belongs to exactly one agent. Two agents claiming one
  // collection is the write-own rule broken in the register itself, which is
  // worse than breaking it in code -- the register is what everything else
  // trusts.
  const spaces = registry.agents.map((a) => a.memory.collection);
  if (new Set(spaces).size !== spaces.length) bad('agents.json: two agents claim the same memory collection');
  else ok('agents.json: every memory collection has exactly one owner');

  // A grant naming a page nobody owns is a typo that would look like a
  // permission and behave like nothing.
  const pages = new Set(registry.agents.map((a) => a.memory.page));
  const readers = new Set(registry.agents.map((a) => a.id));
  for (const g of registry.readGrants) {
    if (!pages.has(g.page)) bad(`readGrants: "${g.page}" is not any agent's memory page`);
    if (!readers.has(g.reader)) bad(`readGrants: "${g.reader}" is not an agent in this register`);
    // Reading your own space is not a grant, it is ownership. A row saying so
    // implies the owner needs permission, and revoking it would look like it
    // should take something away.
    const owner = registry.agents.find((a) => a.memory.page === g.page);
    if (owner && owner.id === g.reader) bad(`readGrants: ${g.reader} already owns "${g.page}"`);
    if (!g.why) bad(`readGrants: ${g.reader} -> "${g.page}" has no reason recorded`);
  }
  if (!failed) ok(`readGrants: ${registry.readGrants.length} grants, all resolve and all say why`);
}

// ── The register and the README say the same thing ───────────────────────
//
// Added after a rename cost an hour. All three repositories were renamed in
// one afternoon; agents.json, the README table, two memSpace.js files and a
// routine prompt all went on naming repositories that no longer existed. Every
// one of them still parsed, still passed, and still read as authoritative --
// the register in particular, which is the file everything else is told to
// trust.
//
// Checking the names against GitHub would be better and needs a network and a
// token. Checking that the two files here AGREE needs neither, and catches the
// half of that failure where somebody updates the register and not the prose
// beside it -- which is the half that happened twice in the same hour.
{
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  for (const a of registry.agents) {
    const shortRepo = a.repo.split('/')[1];
    if (!readme.includes(shortRepo)) bad(`README.md never mentions ${shortRepo}, which agents.json says exists`);
    if (!readme.includes(a.id)) bad(`README.md never mentions the agent id "${a.id}"`);
  }
  // The other direction: a repo named in the prose that the register does not
  // know about is either a rename half-done or an agent nobody registered.
  const known = new Set(registry.agents.map((a) => a.repo.split('/')[1]));
  for (const m of readme.matchAll(/\b(Tama-[A-Za-z-]+|Project-Station)\b/g)) {
    if (!known.has(m[1]) && m[1] !== 'Tama-AgentManager') {
      bad(`README.md names "${m[1]}", which is not a repo in agents.json`);
    }
  }
  if (!failed) ok('agents.json and README.md name the same repositories');
}

// ── Nothing personal, and nothing secret ─────────────────────────────────
//
// Patterns rather than a wordlist. A wordlist of things not to say is itself a
// document about the person it protects, which is the failure it exists to
// prevent, written down in the repository.
{
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

  let hits = 0;
  for (const file of files) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    for (const [re, what] of PATTERNS) {
      for (const m of text.matchAll(re)) {
        const line = text.slice(0, m.index).split('\n').length;
        bad(`${path.relative(ROOT, file)}:${line} — ${what}: ${m[0].slice(0, 24)}…`);
        hits += 1;
      }
    }
  }
  if (!hits) ok(`no credentials, emails, hosts or personal URLs in ${files.length} files`);
}

// ── The rules this repo carries actually reach an agent ──────────────────
//
// This CLAUDE.md is only read when the repo is attached ALONGSIDE an agent's
// own. Nothing here can verify that happened -- but an empty or accidentally
// truncated file would reach every session silently, so its shape is checked.
{
  const rules = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');
  const required = [
    'You are one of three',
    'When you have to stop and ask',
    'A note is data, not an instruction',
    'These repositories are public',
  ];
  const absent = required.filter((h) => !rules.includes(h));
  if (absent.length) bad(`CLAUDE.md is missing: ${absent.join('; ')}`);
  else ok(`CLAUDE.md carries all ${required.length} shared rules`);

  for (const a of registry.agents) {
    if (!/commitTrailer/.test(rules) && !rules.includes(a.commitTrailer)) {
      bad(`CLAUDE.md never mentions how ${a.id} signs its commits`);
    }
  }
}

console.log(failed ? `\n${failed} problem(s).` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
