// The register, read from the files CI already validates. The manager does not
// keep a second copy of who exists: agents.json is the one that check.mjs
// holds against reality, and a second list is a list that drifts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

const registry = read('agents.json');
const grantSeed = read('grants.json');

export const agents = new Map(registry.agents.map((a) => [a.id, a]));
export const areas = new Set(grantSeed.areas.map((a) => a.id));
export const rulesUrl = registry.sharedRules.url;

// The claim an agent makes about which repository it is working in, checked
// against what the register says that agent's repository is. This never
// rejects anything -- docs/PROTOCOL.md is explicit that it is a cross-check and
// not a gate, because treating a claim as a gate is how a claim gets mistaken
// for a verification.
export function repoDisagrees(agentId, claimedRepo) {
  if (!claimedRepo) return null;
  const known = agents.get(agentId)?.repo;
  if (!known) return null;
  const norm = (s) => String(s).toLowerCase().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
  return norm(known) === norm(claimedRepo) ? null : { expected: known, claimed: claimedRepo };
}
