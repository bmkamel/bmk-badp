import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
test('health endpoint',async()=>{const r=await worker.fetch(new Request('https://example.test/health'));assert.equal(r.status,200);assert.equal((await r.json()).service,'BADP')});
test('private API disabled',async()=>assert.equal((await worker.fetch(new Request('https://example.test/api/projects'))).status,404));
test('health rejects writes',async()=>assert.equal((await worker.fetch(new Request('https://example.test/health',{method:'POST'}))).status,404));
