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
      const {results} = await db.prepare(`SELECT * FROM (
        SELECT id,kind,recipe,status,run_id,pr,merge_sha,evidence,requested_at,NULL AS reason,NULL AS research,NULL AS provider FROM engineering_queue WHERE owner=?
        UNION ALL SELECT id,kind,NULL,status,run_id,pr,merge_sha,evidence,requested_at,reason,research,provider FROM engineering_model_tasks WHERE owner=?
        ) ORDER BY requested_at DESC LIMIT 30`).bind(owner,owner).all();
      const intake = await db.prepare('SELECT id,command,status,run_id,summary FROM engineering_intake WHERE owner=? ORDER BY requested_at DESC LIMIT 15').bind(owner).all();
      const control = await db.prepare('SELECT paused FROM engineering_control WHERE id=1').first();
      const inspection = await db.prepare('SELECT day,base_sha,observed_sha,source_status,run_id FROM engineering_inspections ORDER BY day DESC LIMIT 1').first();
      const usage=await db.prepare(`SELECT u.task_id,u.run_id,u.provider,u.outcome,u.prompt_tokens,u.completion_tokens,u.reported_cost
        FROM engineering_usage u JOIN engineering_model_tasks t ON t.id=u.task_id
        WHERE t.owner=? ORDER BY u.recorded_at DESC LIMIT 30`).bind(owner).all();
      return reply({tasks:results,intake:intake.results,usage:usage.results,paused:control?.paused!==0,inspection});
    }
    if (request.method !== 'POST' || request.headers.get('Origin') !== url.origin) return reply({error:'origin_not_allowed'}, 403);
    const data = await boundedJson(request).catch(() => null);
    if (!data) return reply({error:'invalid_input'},400);
    if (data.action === 'pause-system' || data.action === 'resume-system') {
      await db.prepare('UPDATE engineering_control SET paused=?,updated_at=unixepoch() WHERE id=1')
        .bind(data.action==='pause-system'?1:0).run();
      return reply({ok:true},202);
    }
    if (!valid.test(data.id ?? '')) return reply({error:'invalid_input'}, 400);
    if (data.action==='inspect') {
      const command=data.command;
      if(typeof command!=='string'||!command.trim()||command.length>2000) return reply({error:'invalid_input'},400);
      const scoped=/(واجهة|واجهات|لوحة|interface|dashboard|landing|theme|language)/iu.test(command);
      const status=scoped?'queued':'needs_scope';
      await db.prepare(`INSERT OR IGNORE INTO engineering_intake(id,owner,command,status)
        SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM engineering_intake WHERE owner=? AND requested_at>unixepoch()-86400)<20`)
        .bind(data.id,owner,command,status,owner).run();
      const record=await db.prepare('SELECT id,command,status FROM engineering_intake WHERE owner=? AND id=?').bind(owner,data.id).first();
      if(!record) return reply({error:'daily_limit'},429);
      return record.command===command ? reply({id:record.id,status:record.status},202) : reply({error:'invalid_state'},409);
    }
    if (data.action === 'pause' || data.action === 'resume') {
      const from = data.action === 'pause' ? 'queued' : 'paused';
      const to = data.action === 'pause' ? 'paused' : 'queued';
      const result = await db.prepare('UPDATE engineering_queue SET status=? WHERE owner=? AND id=? AND status=?')
        .bind(to,owner,data.id,from).run();
      if(result.meta.changes===1) return reply({id:data.id},202);
      for(const table of ['engineering_model_tasks','engineering_intake']) {
        const changed=await db.prepare('UPDATE '+table+' SET status=? WHERE owner=? AND id=? AND status=?').bind(to,owner,data.id,from).run();
        if(changed.meta.changes===1) return reply({id:data.id},202);
      }
      return reply({error:'invalid_state'},409);
    }
    if (data.kind !== 'dashboard-theme') return reply({error:'invalid_input'}, 400);
    await db.prepare("INSERT OR IGNORE INTO engineering_queue(id,owner,kind) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM engineering_queue WHERE owner=? AND kind=? AND status IN ('queued','running','paused','verified'))")
      .bind(data.id,owner,data.kind,owner,data.kind).run();
    const recorded = await db.prepare("SELECT id FROM engineering_queue WHERE owner=? AND kind=? AND status IN ('queued','running','paused','verified') ORDER BY requested_at DESC LIMIT 1")
      .bind(owner,data.kind).first();
    return reply(recorded ?? {error:'queue_unavailable'}, recorded ? 202 : 503);
  } catch { return reply({error:'queue_unavailable'}, 503); }
}
