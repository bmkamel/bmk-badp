import test from 'node:test';import assert from 'node:assert/strict';import {authRoute,authenticated} from '../preview/auth-routes.mjs';const origin='https://badp-r1-preview.bmkamel.workers.dev';test('unconfigured routes fail closed',async()=>{assert.equal((await authRoute(new Request(origin+'/auth/github'),{})).status,503);assert.equal(await authenticated(new Request(origin+'/dashboard',{headers:{Cookie:'__Host-badp-session=fake'}}),{}),false);assert.equal(await authRoute(new Request(origin+'/'),{}),null);});
import {DatabaseSync} from 'node:sqlite';
import {schema} from '../preview/auth-state.mjs';

test('the callback uses the initiating attempt when two OAuth tabs are open', async () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    for (const sql of schema) sqlite.exec(sql);
    const env = {
      GITHUB_CLIENT_ID: 'test', GITHUB_CLIENT_SECRET: 'test',
      SESSION_SECRET: 'x'.repeat(32), GITHUB_ALLOWED_ID: '123',
      AUTH_DB: {prepare(sql) { return {bind(...args) { return {
        run: async () => sqlite.prepare(sql).run(...args),
        first: async () => sqlite.prepare(sql).get(...args) ?? null,
      }; }}; }},
    };
    const start = async () => {
      const response = await authRoute(new Request(origin+'/auth/github'), env);
      const state = new URL(response.headers.get('Location')).searchParams.get('state');
      return {state, cookie: response.headers.get('Set-Cookie').split(';')[0]};
    };
    const first = await start();
    const second = await start();
    const request = new Request(origin+'/auth/github/callback?code=test&state='+first.state, {
      headers: {Cookie: first.cookie+'; '+second.cookie},
    });
    const provider = async url => url.endsWith('/user')
      ? Response.json({id: 123})
      : Response.json({access_token: 'example'});
    const callback = await authRoute(request, env, provider);
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get('Location'), '/dashboard');
    const session = callback.headers.getSetCookie().find(cookie => cookie.startsWith('__Host-badp-session='));
    assert.equal(await authenticated(new Request(origin+'/dashboard', {
      headers: {Cookie: session.split(';')[0]},
    }), env), true);
    assert.match(await (await authRoute(request, env, provider)).text(), /invalid_oauth_transaction/);
  } finally {
    sqlite.close();
  }
});
