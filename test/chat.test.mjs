import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync, readdirSync} from 'node:fs';
import {chatRoute} from '../preview/chat.mjs';
import {chatPage} from '../preview/chat-page.mjs';

test('Arabic chat request runs the real engine and saves safe preview and checks', async () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    const migrations = new URL('../db/', import.meta.url);
    for (const file of readdirSync(migrations).sort()) sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'));
    const env = {GITHUB_ALLOWED_ID: '123', ENGINE_DB: {
      prepare(sql) { return {bind(...params) { return {
        run: async () => ({meta: {changes: Number(sqlite.prepare(sql).run(...params).changes)}}),
        first: async () => sqlite.prepare(sql).get(...params) ?? null,
        all: async () => ({results: sqlite.prepare(sql).all(...params)}),
      }; }}; },
      async batch(inputs) {
        sqlite.exec('BEGIN');
        try {
          const results = [];
          for (const input of inputs) results.push(await input.run());
          sqlite.exec('COMMIT');
          return results;
        } catch (err) { sqlite.exec('ROLLBACK'); throw err; }
      },
    }};
    const origin = 'https://example.com';
    const id = crypto.randomUUID();
    const run = (path, method = 'GET', body, site = origin) => chatRoute(new Request(origin+'/api/chat'+path, {
      method, headers: {Origin: site, 'Content-Type': 'application/json'}, body: body && JSON.stringify(body),
    }), env, null, {});
    const payload = {id, prompt: 'أنشئ صفحة تعريف بالمشروع', attachment: {name: 'brief.md', text: '<script>alert(1)</script>'}};
    assert.equal((await run('', 'POST', payload, 'https://elsewhere.example')).status, 403);
    assert.equal((await run('', 'POST', {...payload, prompt: 'run shell commands'})).status, 422);
    assert.equal((await run('', 'POST', payload)).status, 202);
    assert.equal((await run('', 'POST', payload)).status, 202);
    const tasks = await (await run('')).json();
    assert.equal(tasks.tasks.length, 1);
    assert.equal(tasks.tasks[0].state, 'review');
    const detail = await (await run('/'+id)).json();
    assert.equal(detail.checks.length, 4);
    assert.ok(detail.checks.every(check => check.passed));
    const preview = await run('/'+id+'/preview');
    assert.match(preview.headers.get('Content-Security-Policy'), /sandbox/);
    const markup = await preview.text();
    assert.match(markup, /dir="rtl"/);
    assert.match(markup, /&lt;script&gt;/);
    assert.doesNotMatch(markup, /<script>/);
    const parked = crypto.randomUUID();
    sqlite.prepare("INSERT INTO chat_tasks (id,owner,prompt,state) VALUES (?,?,?,'queued')")
      .run(parked, '123', 'Create an HTML preview');
    assert.equal((await run('/'+parked+'/pause', 'POST')).status, 202);
    assert.equal((await (await run('/'+parked)).json()).state, 'paused');
    assert.equal((await run('/'+parked+'/resume', 'POST')).status, 202);
    assert.equal((await (await run('/'+parked)).json()).state, 'review');
    env.GITHUB_ALLOWED_ID = '456';
    assert.equal((await run('/'+id)).status, 404);
    assert.match(chatPage('ar'), /dir="rtl"/);
  } finally {
    sqlite.close();
  }
});
