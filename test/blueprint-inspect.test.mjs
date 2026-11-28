import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectBlueprint} from '../scripts/blueprint-inspect.mjs';
const doc='### 16. First executable work order: BADP-TASK-001\nObjective: inspect\n### 17. Metrics';
const paths=['src/local-sqlite.mjs','src/development-runner.mjs','scripts/source-live-pilot.mjs','scripts/publish-source-pilot.mjs','.github/workflows/source-live-pilot.yml'];
const files=Object.fromEntries(paths.map(p=>[p,'source']));
test('bounded inspection is deterministic and grants no execution authority',()=>{const a=inspectBlueprint(doc,files,'a'.repeat(40));assert.deepEqual(a,inspectBlueprint(doc,files,'a'.repeat(40)));assert.equal(a.inventory.length,5);assert.equal(a.executionAuthorized,false);assert.equal(a.taskId,'BADP-TASK-001');});
test('missing baseline or source fails closed',()=>{assert.throws(()=>inspectBlueprint('',files,'a'.repeat(40)));assert.throws(()=>inspectBlueprint(doc,{},'a'.repeat(40)));assert.throws(()=>inspectBlueprint(doc,files,'bad'));});
