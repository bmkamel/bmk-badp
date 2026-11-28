import {createDevelopmentRunner} from '../src/development-runner.mjs';
import {d1RunStore} from '../src/d1-run-store.mjs';
import {createStaticSandboxExecutor} from '../src/static-sandbox.mjs';

import {renderResult,taskKind} from './chat-result.mjs';

const projectId = 'badp-chat';
const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const encoder = new TextEncoder();
const statement = (db, sql, ...params) => db.prepare(sql).bind(...params);
const internal = (db, owner, id) => statement(db, 'SELECT * FROM chat_tasks WHERE owner=? AND id=?', owner, id).first();

export async function boundedJson(request) {
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') throw Error('invalid_input');
  const reader = request.body?.getReader();
  if (!reader) throw Error('invalid_input');
  const decoder = new TextDecoder('utf-8', {fatal: true});
  let body = '', length = 0;
  try {
    for (;;) {
      const {value, done} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 32_768) {
        await reader.cancel();
        throw Error('input_too_large');
      }
      body += decoder.decode(value, {stream: true});
    }
    return JSON.parse(body+decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

async function requestAdvice(env, task, kind) {
  if (!env.OPENROUTER_API_KEY || task.allow_ai !== 1 ||
    /(?:BEGIN [A-Z ]*PRIVATE KEY|github_pat_|gh[pousr]_|sk-(?:or-|proj-)?|gsk_|Bearer\s+\S+|(?:password|api[_ -]?key|secret|كلمة المرور)\s*[:=])/iu.test(task.prompt)) return null;
  try {
    const permitted = await statement(env.ENGINE_DB,
      "INSERT INTO ai_daily_budget(provider,day,requests,units) VALUES ('openrouter-chat',CAST(unixepoch()/86400 AS INTEGER),1,2048) ON CONFLICT(provider,day) DO UPDATE SET requests=requests+1,units=units+2048 WHERE requests<5 AND units+2048<=10240").run();
    if (permitted.meta.changes !== 1) return null;
    const response = await globalThis.fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(8_000),
      headers: {Authorization: 'Bearer '+env.OPENROUTER_API_KEY, 'Content-Type': 'application/json'},
      body: JSON.stringify({
        model: 'openrouter/free', max_tokens: 550,
        provider: {max_price: {prompt: 0, completion: 0, request: 0}, data_collection: 'deny'},
        messages: [
          {role: 'system', content: 'Draft a concise useful response in the same language as the request. No tools. Never claim any action was executed. For programming, provide a draft or scoped implementation steps. For reports, do not invent facts or measurements. Request category: '+kind},
          {role: 'user', content: task.prompt},
        ],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const draft = data.choices?.[0]?.message?.content;
    return data.usage?.cost === 0 && typeof draft === 'string' && draft.trim() && draft.length <= 6500 ? draft.trim() : null;
  } catch {
    return null;
  }
}

async function execute(env, owner, id) {
  const db = env.ENGINE_DB;
  const attempt = crypto.randomUUID();
  const claim = await statement(db,
    "UPDATE chat_tasks SET state='running', attempt=?, updated_at=unixepoch() WHERE owner=? AND id=? AND state='queued'",
    attempt, owner, id).run();
  if (claim.meta.changes !== 1) return;
  const current = await internal(db, owner, id);
  const active = async () => {
    const row = await internal(db, owner, id);
    if (row?.state !== 'running' || row.attempt !== attempt) throw Error('stale_run');
  };
  const setState = state => statement(db,
    "UPDATE chat_tasks SET state=?, attempt=NULL, updated_at=unixepoch() WHERE owner=? AND id=? AND attempt=? AND state='running'",
    state, owner, id, attempt).run();
  try {
    await statement(db, 'INSERT OR IGNORE INTO projects(id,name) VALUES (?,?)', projectId, 'BADP Chat').run();
    const store = d1RunStore(db);
    const guarded = {...store, async renewLease(...args) {
      await active();
      await store.renewLease(...args);
    }};
    const kind = taskKind(current.prompt);
    const generator = {async generate({phase}) {
      if (phase === 'plan') return {plan: {goal: current.prompt, steps: [
        {id: 'inspect', kind: 'inspect', description: 'Interpret the request and choose its permitted path', dependsOn: []},
        {id: 'test', kind: 'test', description: 'Validate offline static markup', dependsOn: ['inspect']},
        {id: 'preview', kind: 'preview', description: 'Save preview for review', dependsOn: ['test']},
      ]}};
      let metrics;
      if (kind === 'report') {
        const rows = await statement(db, 'SELECT state,count(*) AS total FROM chat_tasks WHERE owner=? AND id<>? GROUP BY state', owner, id).all();
        metrics = Object.fromEntries(rows.results.map(row => [row.state, row.total]));
      }
      const advice = await requestAdvice(env, current, kind);
      const content = renderResult({task:current, kind, advice, metrics});
      return {patches: [{path: 'app/index.html', content}]};
    }};
    const runner = createDevelopmentRunner({model: generator, executor: createStaticSandboxExecutor(), store: guarded});
    const args = {id, projectId, actorId: owner, prompt: current.prompt};
    const outcome = await store.getRun(id, projectId) ? await runner.resume(args) : await runner.start(args);
    await setState(outcome.stage === 'review' ? 'review' : 'blocked');
  } catch (error) {
    if (error?.message === 'run_busy') {
      await setState('queued');
      return true;
    }
    await setState('blocked');
  }
}

export async function chatRoute(request, env, context, headers) {
  const url = new URL(request.url);
  const owner = env.GITHUB_ALLOWED_ID;
  const db = env.ENGINE_DB;
  const reply = (body, status = 200) => Response.json(body, {status, headers});
  const start = id => {
    const work = (async () => {
      for (let tries = 0; tries < 6; tries++) {
        if (!await execute(env, owner, id)) return;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    })().catch(() => {});
    if (context?.waitUntil) context.waitUntil(work);
    else return work;
  };
  if (!db) return reply({error: 'storage_unavailable'}, 503);
  if (request.method === 'POST' && request.headers.get('Origin') !== url.origin) {
    return reply({error: 'origin_not_allowed'}, 403);
  }
  try {
    if (url.pathname === '/api/chat' && request.method === 'GET') {
      const {results} = await statement(db,
        "SELECT id,prompt,attachment_name,state,created_at,updated_at FROM chat_tasks WHERE owner=? ORDER BY created_at DESC,rowid DESC LIMIT 30",
        owner).all();
      const store = d1RunStore(db);
      const latest = await Promise.all(results.map(async row => {
        const run = await store.getRun(row.id, projectId);
        return {...row, kind: taskKind(row.prompt), stage: run?.stage ?? null};
      }));
      return reply({tasks: latest});
    }
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      let payload;
      try { payload = await boundedJson(request); }
      catch (error) { return reply({error: 'invalid_input'}, error.message === 'input_too_large' ? 413 : 400); }
      const {id, prompt, attachment, allowAi} = payload ?? {};
      if (!uuid.test(id ?? '') || typeof prompt !== 'string' || !prompt.trim() || prompt.length > 2000) {
        return reply({error: 'invalid_input'}, 400);
      }
      if (attachment && (typeof attachment.name !== 'string' || attachment.name.length > 120 ||
        !/\.(txt|md|json|csv)$/i.test(attachment.name) || typeof attachment.text !== 'string' ||
        encoder.encode(attachment.text).byteLength > 4000)) return reply({error: 'invalid_attachment'}, 400);
      await statement(db,
        "INSERT OR IGNORE INTO chat_tasks(id,owner,prompt,attachment_name,attachment_text,allow_ai,state) SELECT ?,?,?,?,?,?,'queued' WHERE (SELECT count(*) FROM chat_tasks WHERE owner=? AND created_at/86400=unixepoch()/86400)<12",
        id, owner, prompt.trim(), attachment?.name ?? null, attachment?.text ?? null, allowAi === true ? 1 : 0, owner).run();
      if (!await internal(db, owner, id)) return reply({error: 'daily_limit'}, 429);
      await start(id);
      return reply({id}, 202);
    }
    const match = /^\/api\/chat\/([^/]+)(?:\/(pause|resume|preview))?$/.exec(url.pathname);
    if (!match || !uuid.test(match[1])) return reply({error: 'not_found'}, 404);
    const [, id, action] = match;
    const task = await internal(db, owner, id);
    if (!task) return reply({error: 'not_found'}, 404);
    if (request.method === 'GET' && (!action || action === 'preview')) {
      const store = d1RunStore(db);
      if (action === 'preview') {
        const preview = task.state === 'review' && await store.latestArtifact(id, projectId, 'preview');
        if (!preview) return reply({error: 'not_found'}, 404);
        return new Response(preview.html, {headers: {...headers, 'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"}});
      }
      const run = await store.getRun(id, projectId);
      const test = await store.latestArtifact(id, projectId, 'test');
      return reply({state: task.state, stage: run?.stage, checks: test?.checks ?? []});
    }
    if (request.method === 'POST' && (action === 'pause' || action === 'resume')) {
      const sql = action === 'pause'
        ? "UPDATE chat_tasks SET state='paused',attempt=NULL,updated_at=unixepoch() WHERE owner=? AND id=? AND state IN ('queued','running')"
        : "UPDATE chat_tasks SET state='queued',attempt=NULL,updated_at=unixepoch() WHERE owner=? AND id=? AND (state IN ('paused','queued') OR (state='running' AND updated_at<unixepoch()-120))";
      if ((await statement(db, sql, owner, id).run()).meta.changes !== 1) return reply({error: 'invalid_state'}, 409);
      if (action === 'resume') await start(id);
      return reply({id}, 202);
    }
    return reply({error: 'method_not_allowed'}, 405);
  } catch {
    return reply({error: 'storage_unavailable'}, 503);
  }
}
