// The one page a person looks at, and the only place an approval is written.
//
// It is deliberately small. A board that answers "what is waiting on me, who
// is awake, and what did I authorise" is the whole job; anything else here
// would be a second copy of something the database already says.
import { q } from './db.mjs';
import { agents, areas } from './register.mjs';
import { csrfToken } from './auth.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ago = (t) => {
  if (!t) return 'never';
  const m = Math.round((Date.now() - new Date(t).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};

const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { --bg:#fbfbfa; --fg:#1a1a19; --dim:#6b6b66; --line:#e4e4e0; --card:#fff; --warn:#8a3d00; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#16161a; --fg:#e8e8e6; --dim:#93938c; --line:#2c2c32; --card:#1e1e23; --warn:#ffb27a; }
  }
  * { box-sizing: border-box; }
  body { margin:0; padding:2rem 1rem 4rem; background:var(--bg); color:var(--fg);
         font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Noto Sans TC",sans-serif; }
  main { max-width: 60rem; margin: 0 auto; }
  h1 { font-size:1.3rem; margin:0 0 .25rem; }
  h2 { font-size:1rem; margin:2.5rem 0 .75rem; }
  .dim { color:var(--dim); }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px;
          padding:1rem; margin-bottom:.75rem; }
  .row { display:flex; gap:1rem; align-items:baseline; flex-wrap:wrap; }
  .grow { flex:1; min-width:14rem; }
  button { font:inherit; padding:.4rem .9rem; border-radius:7px; border:1px solid var(--line);
           background:var(--fg); color:var(--bg); cursor:pointer; }
  button.ghost { background:transparent; color:var(--fg); }
  input, select, textarea { font:inherit; padding:.4rem .5rem; border-radius:7px;
           border:1px solid var(--line); background:var(--bg); color:var(--fg); width:100%; }
  label { display:block; font-size:.85rem; color:var(--dim); margin:.6rem 0 .2rem; }
  code { font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;
         background:var(--bg); border:1px solid var(--line); border-radius:4px; padding:.05rem .3rem; }
  .warn { color:var(--warn); }
  .empty { color:var(--dim); font-style:italic; }
  form.inline { display:inline; }
</style></head><body><main>${body}</main></body></html>`;

export function signInPage(note) {
  return page('Agent manager', `
    <h1>Agent manager</h1>
    <p class="dim">Approvals, grants and check-ins for the agents on this account.</p>
    ${note ? `<p class="warn">${esc(note)}</p>` : ''}
    <p style="margin-top:2rem"><a href="/auth/login"><button>Sign in with Google</button></a></p>
    <p class="dim" style="margin-top:2rem">Agents do not sign in. They hold a fleet secret and
    call the API, which is why the approvals live behind this and not in Tamarada.</p>`);
}

export function notConfiguredPage(missing) {
  return page('Agent manager — not configured', `
    <h1>Sign-in is not configured</h1>
    <p>The manager is running and the agents can reach it. Nobody can approve anything
       until these are set:</p>
    <ul>${missing.map((m) => `<li><code>${esc(m)}</code></li>`).join('')}</ul>
    <p class="dim">Until then the only authority an agent can cite is a grant, and grants are
       issued from this page — so nothing can be authorised at all. Messages still arrive and
       wait; they are suggestions until somebody signs in.</p>`);
}

// A message is waiting on a person when nobody has approved it and no live
// grant covers it. Same derivation the inbox uses, so the two cannot disagree.
const PENDING = `
  select m.id, m.from_agent, m.to_agent, m.body, m.area, m.authorized_by,
         m.origin_session, m.created_at
    from agent_message m
    left join approval ap on ap.message_id = m.id
    left join standing_grant g on ('grant:' || g.id) = m.authorized_by
                              and g.revoked_at is null
                              and g.grantee = m.from_agent
                              and g.area = m.area
                              and (g.recipient is null or g.recipient = m.to_agent)
   where m.kind = 'task'
     and ap.id is null and g.id is null
     and not exists (select 1 from agent_message r where r.in_reply_to = m.id)
   order by m.created_at`;

export async function boardPage(session) {
  const csrf = csrfToken(session.email);
  const [pending, live, claims, wakes] = await Promise.all([
    q(PENDING).then((r) => r.rows),
    q(`select id, grantee, area, recipient, why, issued_at from standing_grant
        where revoked_at is null order by issued_at desc`).then((r) => r.rows),
    q(`select sc.agent, sc.session, sc.branch,
              (select c.state from checkin c where c.agent = sc.agent and c.session = sc.session
                order by c.at desc limit 1) as state,
              (select max(c.at) from checkin c where c.agent = sc.agent and c.session = sc.session) as seen
         from session_claim sc
         join (select agent, max(claimed_at) as m from session_claim group by agent) latest
           on latest.agent = sc.agent and latest.m = sc.claimed_at
        order by sc.agent`).then((r) => r.rows),
    q(`select agent, reason, delivered, suppressed_reason, at from wake
        order by at desc limit 8`).then((r) => r.rows),
  ]);

  const hidden = `<input type="hidden" name="csrf" value="${esc(csrf)}">`;

  const pendingHtml = pending.length ? pending.map((m) => `
    <div class="card">
      <div class="row">
        <div class="grow">
          <strong>${esc(m.from_agent)}</strong> <span class="dim">→</span>
          <strong>${esc(m.to_agent)}</strong>
          <span class="dim">· ${esc(ago(m.created_at))}</span>
          ${m.area ? ` <span class="dim">· ${esc(m.area)}</span>` : ''}
        </div>
        <form method="post" action="/approve" class="inline">${hidden}
          <input type="hidden" name="id" value="${esc(m.id)}">
          <button>Approve</button>
        </form>
      </div>
      <p style="margin:.6rem 0 .3rem; white-space:pre-wrap">${esc(m.body)}</p>
      <p class="dim" style="margin:0">Asked from <code>${esc(m.origin_session)}</code>${
        m.authorized_by ? ` · cites <code>${esc(m.authorized_by)}</code> that no live grant matches` : ''}</p>
    </div>`).join('') : '<p class="empty">Nothing is waiting on you.</p>';

  const claimsHtml = claims.length ? claims.map((c) => `
    <div class="card"><div class="row">
      <div class="grow"><strong>${esc(c.agent)}</strong>
        <span class="dim">· ${esc(c.state ?? 'no check-in')} · ${esc(ago(c.seen))}</span></div>
      <div class="dim">${esc(c.branch ?? '')} <code>${esc(c.session)}</code></div>
    </div></div>`).join('')
    : '<p class="empty">No agent has checked in yet.</p>';

  const grantsHtml = live.length ? live.map((g) => `
    <div class="card"><div class="row">
      <div class="grow"><code>${esc(g.id)}</code> — <strong>${esc(g.grantee)}</strong>
        may ask ${esc(g.recipient ?? 'anyone')} about <strong>${esc(g.area)}</strong>
        <div class="dim">${esc(g.why)}</div></div>
      <form method="post" action="/grants/revoke" class="inline">${hidden}
        <input type="hidden" name="id" value="${esc(g.id)}">
        <button class="ghost">Revoke</button>
      </form>
    </div></div>`).join('') : '<p class="empty">No grants issued. Every task waits on you.</p>';

  const wakesHtml = wakes.length ? wakes.map((w) => `
    <div class="card"><div class="row">
      <div class="grow"><strong>${esc(w.agent)}</strong>
        <span class="dim">· ${esc(w.reason)} · ${esc(ago(w.at))}</span></div>
      <div class="${w.delivered ? 'dim' : 'warn'}">${
        w.delivered ? 'delivered' : esc(w.suppressed_reason ?? 'not delivered')}</div>
    </div></div>`).join('') : '<p class="empty">No wakes recorded.</p>';

  const agentOptions = [...agents.keys()].map((a) => `<option>${esc(a)}</option>`).join('');

  return page('Agent manager', `
    <div class="row"><h1 class="grow">Agent manager</h1>
      <form method="post" action="/auth/logout" class="inline">${hidden}
        <button class="ghost">Sign out</button></form></div>
    <p class="dim">${esc(session.email)}</p>

    <h2>Waiting on you${pending.length ? ` (${pending.length})` : ''}</h2>
    <p class="dim">Approving writes a row of its own. It does not edit the agent's message —
       that row keeps one writer, forever.</p>
    ${pendingHtml}

    <h2>Who is awake</h2>
    <p class="dim">An agent's current session is whichever one checked in last. Nobody
       maintains this list; a chat that stops being used stops appearing.</p>
    ${claimsHtml}

    <h2>Standing grants</h2>
    <p class="dim">A grant is what an agent can cite instead of waiting for you. It can cite
       one; it cannot mint one.</p>
    ${grantsHtml}
    <form method="post" action="/grants" class="card">${hidden}
      <div class="row">
        <div class="grow"><label>Agent</label><select name="grantee">${agentOptions}</select></div>
        <div class="grow"><label>May ask</label>
          <select name="recipient"><option value="">anyone</option>${agentOptions}</select></div>
        <div class="grow"><label>About</label>
          <select name="area">${[...areas].map((a) => `<option>${esc(a)}</option>`).join('')}</select></div>
      </div>
      <label>Why (one sentence, and it outlives your memory of issuing it)</label>
      <input name="why" required maxlength="300">
      <p style="margin:.8rem 0 0"><button>Issue grant</button></p>
    </form>

    <h2>Recent wakes</h2>
    <p class="dim">Including the ones that did not happen. A dropped wake with no trace makes a
       busy day and a broken one look identical.</p>
    ${wakesHtml}`);
}
