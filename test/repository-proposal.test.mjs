import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRepositoryProposal} from '../src/repository-proposal.mjs';
const job={repository:'owner/repo',baseSha:'a'.repeat(40),branch:'dev/badp-task',engine:'aider',goal:'Improve documentation'};
const project={id:'p',repository:job.repository,proposalEnabled:true};
const patch={path:'docs/guide.md',kind:'add',content:'# Guide'};
const make=(extra={})=>createRepositoryProposal({project,job,patches:[patch],...extra});
test('creates deterministic immutable proposal without claiming publication',()=>{
 const a=make(),b=make();
 assert.equal(a.digest,b.digest);assert.equal(a.stage,'proposal_review');assert.equal(a.published,false);assert.equal(a.bytes,7);assert.ok(Object.isFrozen(a.patches[0]));
 assert.notEqual(a.digest,make({patches:[{...patch,content:'# Other'}]}).digest);
 assert.notEqual(a.digest,make({job:{...job,baseSha:'b'.repeat(40)}}).digest);
});
test('rejects unauthorized project and protected paths',()=>{
 assert.throws(()=>make({project:{...project,proposalEnabled:false}}),/proposal_denied/);
 assert.throws(()=>make({project:{...project,repository:'other/repo'}}),/proposal_denied/);
 assert.throws(()=>make({patches:[{...patch,path:'.github/workflows/ci.yml'}]}),/protected_path/);
});
test('rejects duplicate, oversized, malformed and secret-like content',()=>{
 assert.throws(()=>make({patches:[patch,patch]}),/duplicate_path/);
 for(const content of ['x'.repeat(100001),'x\0y','\ud800'])assert.throws(()=>make({patches:[{...patch,content}]}),/invalid_content/);
 assert.throws(()=>make({patches:[{...patch,content:'-----BEGIN PRIVATE KEY-----'}]}),/possible_secret/);
});
test('measures UTF-8 bytes and binds proposal to project',()=>{
 const a=make({patches:[{...patch,content:'مرحبا'}]});assert.equal(a.bytes,10);
 assert.notEqual(a.digest,make({project:{...project,id:'q'},patches:[{...patch,content:'مرحبا'}]}).digest);
});
