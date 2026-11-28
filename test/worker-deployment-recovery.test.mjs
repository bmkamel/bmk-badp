import test from 'node:test';
import assert from 'node:assert/strict';
import {rollbackTarget} from '../scripts/worker-deployment-recovery.mjs';

test('rollback targets only the immediate healthy predecessor of the expected active revision', () => {
  const prior={id:'a'.repeat(36),version:'b'.repeat(36),source:'c'.repeat(40)};
  const active='d'.repeat(40);
  const old={id:prior.id,versions:[{version_id:prior.version,percentage:100}]};
  const current={id:'e'.repeat(36),versions:[{version_id:'f'.repeat(36),percentage:100}]};
  assert.equal(rollbackTarget(prior,[current,old],active,active),prior.version);
  assert.equal(rollbackTarget(prior,[current,old],prior.source,active),null);
  assert.equal(rollbackTarget(prior,[current,current,old],active,active),null);
  assert.equal(rollbackTarget(prior,[{...current,versions:[]},old],active,active),null);
});
