import {test} from 'node:test';
import assert from 'node:assert/strict';
import {transition} from '../src/jobs.mjs';
const job={projectId:'a',status:'queued'};
test('starts job',()=>assert.equal(transition(job,'running','a').status,'running'));
test('rejects cross project',()=>assert.throws(()=>transition(job,'running','b')));
test('rejects skipped state',()=>assert.throws(()=>transition(job,'succeeded','a')));
test('terminal state immutable',()=>assert.throws(()=>transition({...job,status:'succeeded'},'queued','a')));
