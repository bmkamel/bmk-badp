import {execFileSync} from 'node:child_process';
import {createOpenRouterFreeTransport} from '../src/openrouter-free.mjs';
import {d1AiBudget} from '../src/d1-ai-budget.mjs';
import {planSelfTask} from './self-plan.mjs';

const token = process.env.CF_TOKEN;
const apiKey = process.env.OPENROUTER_API_KEY;
if (!token || !apiKey) {
  console.log('Advisory unavailable: D1 or OpenRouter credential is unconfigured');
  process.exit(0);
}
const endpoint = 'https://api.cloudflare.com/client/v4/accounts/bae249433042911808956a8d6f145ba2/d1/database/c52bcd53-f510-4340-9a96-30eef4127345/query';
const db = {prepare(sql) { return {bind(...params) { return {async run() {
  const response = await fetch(endpoint, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: {Authorization: 'Bearer '+token, 'Content-Type': 'application/json'},
    body: JSON.stringify({sql, params}),
  });
  if (!response.ok) throw Error('advisory_storage_unavailable');
  const json = await response.json();
  if (!json.success || !json.result?.[0]?.success) throw Error('advisory_storage_unavailable');
  return json.result[0];
}}; }}; }};
const report = JSON.parse(execFileSync(process.execPath, ['scripts/blueprint-inspect.mjs'], {encoding: 'utf8'}));
const send = createOpenRouterFreeTransport({apiKey, admission: d1AiBudget(db), publicSourceApproved: true});
try {
  const advice = await planSelfTask({report, model: {generate: ({prompt}) => send({
    messages: [{role: 'system', content: 'Return a JSON object. Your plan is advisory and cannot authorize changes.'},
      {role: 'user', content: prompt}], jsonOutput: true,
  })}});
  await db.prepare('INSERT INTO self_cycle_plans(task_id,base_sha,blueprint_digest,plan_json) VALUES (?,?,?,?) ON CONFLICT(task_id,base_sha) DO NOTHING')
    .bind(advice.taskId, advice.base, advice.blueprintDigest, JSON.stringify(advice.plan)).run();
  console.log('Verified zero-price advisory plan saved to D1 for '+advice.base);
} catch (error) {
  const reasons = new Set(['cloud_quota_denied', 'cloud_unavailable', 'cloud_response_unverified', 'invalid_self_plan', 'advisory_storage_unavailable']);
  console.log('Advisory deferred: '+(reasons.has(error?.message) ? error.message : 'provider_or_validation_failure'));
}
