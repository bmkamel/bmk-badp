import {createDevelopmentRunner} from '../src/development-runner.mjs';
import {d1RunStore} from '../src/d1-run-store.mjs';
import {createStaticSandboxExecutor} from '../src/static-sandbox.mjs';

const projectId = 'badp-r1';
const id = 'static-engine-validation-v1';
const goal = 'Validate the BADP development lifecycle against persistent storage';
const plan = {
  goal,
  steps: [
    {id: 'inspect', kind: 'inspect', description: 'Inspect the static fixture', dependsOn: []},
    {id: 'test', kind: 'test', description: 'Validate the static document', dependsOn: ['inspect']},
    {id: 'preview', kind: 'preview', description: 'Record the review evidence', dependsOn: ['test']},
  ],
};
const model = {
  async generate({phase}) {
    if (phase === 'plan') return {plan};
    return {patches: [{
      path: 'app/index.html',
      content: '<!doctype html><html><head><title>BADP validation</title></head><body><main>BADP validation</main></body></html>',
    }]};
  },
};

export async function developmentRoute(request, env, headers) {
  const reply = (body, status = 200) => Response.json(body, {status, headers});
  if (!env.ENGINE_DB) return reply({error: 'storage_unavailable'}, 503);
  try {
    const store = d1RunStore(env.ENGINE_DB);
    if (request.method === 'GET') {
      const run = await store.getRun(id, projectId);
      if (!run) return reply({stage: 'pending'});
      const test = await store.latestArtifact(id, projectId, 'test');
      return reply({id, stage: run.stage, revision: run.revision, checks: test?.checks ?? []});
    }
    if (request.method !== 'POST') return reply({error: 'method_not_allowed'}, 405);
    if (request.headers.get('Origin') !== new URL(request.url).origin) {
      return reply({error: 'origin_not_allowed'}, 403);
    }

    const runner = createDevelopmentRunner({model, executor: createStaticSandboxExecutor(), store});
    const current = await store.getRun(id, projectId);
    if (current) return reply(await runner.resume({id, projectId}));
    await env.ENGINE_DB.prepare('INSERT OR IGNORE INTO projects (id, name) VALUES (?, ?)')
      .bind(projectId, 'BMK BADP R1').run();
    return reply(await runner.start({id, projectId, actorId: env.GITHUB_ALLOWED_ID, prompt: goal}), 201);
  } catch (error) {
    if (error?.message === 'run_busy' || /UNIQUE constraint failed: development_runs.id/.test(error?.message ?? '')) {
      return reply({error: 'run_busy'}, 409);
    }
    return reply({error: 'development_unavailable'}, 503);
  }
}
