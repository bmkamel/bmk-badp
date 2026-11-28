import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transform} from '../scripts/engineering-transform.mjs';

test('engineering transformations are limited to reviewed formatting and keyboard behavior', async () => {
  const source=readFileSync(new URL('../preview/chat-page.mjs',import.meta.url),'utf8');
  const themed=source.includes('@media(prefers-color-scheme:light)') ? source : transform(source,'dashboard-theme');
  assert.match(themed, /prefers-color-scheme:light/);
  const changed=themed.includes('event.isComposing') ? themed : transform(themed,'composer-keyboard');
  const module=await import('data:text/javascript;base64,'+Buffer.from(changed).toString('base64'));
  assert.match(module.chatPage('ar','light'), /dir="rtl" data-theme="light"/);
  assert.match(module.chatScript, /event.isComposing/);
  assert.throws(()=>transform(source,'edit-authentication'));
});
