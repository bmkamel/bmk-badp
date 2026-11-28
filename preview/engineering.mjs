import {boundedJson} from './chat.mjs';

const valid = /^[a-f0-9-]{36}$/;
export async function engineeringRoute(request, env, headers) {
  const url = new URL(request.url);
  const db = env.ENGINE_DB;
  const owner = env.GITHUB_ALLOWED_ID;
  const reply = (data, status = 200) => Response.json(data, {headers, status});
  if (!db) return reply({error:'storage_unavailable'}, 503);
  try {
    if (request.method === 'GET') {
      const {results} = await db.prepare('SELECT id,kind,status,run_id,pr,merge_sha,evidence FROM engineering_queue WHERE owner=? ORDER BY requested_at DESC LIMIT 15').bind(owner).all();
      return reply({tasks:results});
    }
    if (request.method !== 'POST' || request.headers.get('Origin') !== url.origin) return reply({error:'origin_not_allowed'}, 403);
    const data = await boundedJson(request).catch(() => null);
    if (!data) return reply({error:'invalid_input'},400);
    if (!valid.test(data.id ?? '')) return reply({error:'invalid_input'}, 400);
    if (data.action === 'pause' || data.action === 'resume') {
      const from = data.action === 'pause' ? 'queued' : 'paused';
      const to = data.action === 'pause' ? 'paused' : 'queued';
      const result = await db.prepare('UPDATE engineering_queue SET status=? WHERE owner=? AND id=? AND status=?')
        .bind(to,owner,data.id,from).run();
      return reply({id:data.id}, result.meta.changes === 1 ? 202 : 409);
    }
    if (data.kind !== 'dashboard-theme') return reply({error:'invalid_input'}, 400);
    await db.prepare("INSERT OR IGNORE INTO engineering_queue(id,owner,kind) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM engineering_queue WHERE owner=? AND kind=? AND status IN ('queued','running','paused','verified'))")
      .bind(data.id,owner,data.kind,owner,data.kind).run();
    const recorded = await db.prepare("SELECT id FROM engineering_queue WHERE owner=? AND kind=? AND status IN ('queued','running','paused','verified') ORDER BY requested_at DESC LIMIT 1")
      .bind(owner,data.kind).first();
    return reply(recorded ?? {error:'queue_unavailable'}, recorded ? 202 : 503);
  } catch { return reply({error:'queue_unavailable'}, 503); }
}
