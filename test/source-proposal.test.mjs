import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateSourceProposal} from '../src/source-proposal.mjs';
const path='src/example.mjs',old='export const n=1;',beforeSha256=createHash('sha256').update(old).digest('hex');
const fixture=()=>({baseCommit:'a'.repeat(40),snapshot:new Map([[path,old]]),allowedPaths:[path],changes:[{path,beforeSha256,content:'export const n=2;'}]});
test('validates existing allowlisted source without mutating snapshot',()=>{const f=fixture();const r=validateSourceProposal(f);assert.equal(r.status,'proposal-only');assert.equal(f.snapshot.get(path),old);assert.equal(r.files.length,1);assert.ok(Object.isFrozen(r.files[0]));});
test('rejects stale hashes, unauthorized paths, duplicate edits, secrets and no-op',()=>{
 for(const mutate of [f=>f.changes[0].beforeSha256='0'.repeat(64),f=>f.allowedPaths=[],f=>f.changes[0].path='../secret',f=>f.changes.push({...f.changes[0]}),f=>f.changes[0].content='gsk_'+'x'.repeat(30),f=>f.changes[0].content=old,f=>f.changes[0].content='x'.repeat(128001)]){const f=fixture();mutate(f);assert.throws(()=>validateSourceProposal(f));}
});
