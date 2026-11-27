import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProposalRunner} from '../src/proposal-runner.mjs';
const job={repository:'owner/repo',baseSha:'a'.repeat(40),branch:'dev/badp-task',engine:'aider',goal:'Improve docs'};
const project={id:'p',repository:job.repository,proposalEnabled:true};
const paths=['docs/a.md'];
const req={projectId:'p',job,paths};
const fixture=(overrides={})=>createProposalRunner({projects:{get:async()=>project},readContext:async()=>({baseSha:job.baseSha,files:[{path:paths[0],content:'# Old'}]}),localModel:{generate:async r=>{assert.equal(r.context.files[0].content,'# Old');return {patches:[{path:paths[0],kind:'modify',content:'# New'}]};}},...overrides});
test('runs snapshot to immutable review proposal',async()=>{
 const result=await fixture().run(req);assert.equal(result.stage,'proposal_review');assert.equal(result.published,false);assert.equal(result.patches[0].content,'# New');
});
test('rejects snapshot mismatch before model call',async()=>{
 await assert.rejects(fixture({readContext:async()=>({baseSha:'b'.repeat(40),files:[]}),localModel:{generate:async()=>assert.fail('model called')}}).run(req),/snapshot_mismatch/);
});
test('rejects unauthorized project and changes outside inspected scope',async()=>{
 await assert.rejects(fixture({projects:{get:async()=>null}}).run(req),/proposal_denied/);
 await assert.rejects(fixture({localModel:{generate:async()=>({patches:[{path:'docs/b.md',kind:'add',content:'# New'}]})}}).run(req),/outside_snapshot/);
});
