import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAgentExecution} from '../src/agent-execution.mjs';
const job={repository:'owner/repo',baseSha:'a'.repeat(40),branch:'dev/badp-task',engine:'aider',goal:'Improve documentation'};
const project={id:'p',repository:job.repository,agentExecutionEnabled:true,allowedEngines:['aider','opencode']};
const result={headSha:'b'.repeat(40),artifactId:'artifact-1'};
function fixture(overrides={}){
 return createAgentExecution({projects:{get:async()=>project},backend:{execute:async()=>result},review:async x=>({baseSha:x.baseSha,headSha:x.headSha}),...overrides});
}
test('agent proposal ends at review, never publication',async()=>{
 const runner=fixture({backend:{execute:async spec=>{
 assert.equal(spec.policy.network,'deny');assert.equal(spec.policy.credentials,'none');assert.equal(spec.policy.hostMounts,'none');assert.equal(spec.policy.publish,false);return result;
 }}});
 const r=await runner.run({projectId:'p',job});assert.equal(r.stage,'review');assert.equal(r.published,false);
});
test('rejects disabled or mismatched project before backend',async()=>{
 for(const p of [{...project,agentExecutionEnabled:false},{...project,repository:'other/repo'},{...project,allowedEngines:[]}]){
 const r=fixture({projects:{get:async()=>p},backend:{execute:async()=>assert.fail('execution must not occur')}});
 await assert.rejects(r.run({projectId:'p',job}),/execution_denied/);
 }
});
test('rejects malformed result and mismatched review',async()=>{
 await assert.rejects(fixture({backend:{execute:async()=>({headSha:job.baseSha,artifactId:'x'})}}).run({projectId:'p',job}),/invalid_execution_result/);
 await assert.rejects(fixture({review:async()=>({baseSha:job.baseSha,headSha:'c'.repeat(40)})}).run({projectId:'p',job}),/review_mismatch/);
});
test('serializes execution within one instance and recovers after rejection',async()=>{
 let release;const gate=new Promise(r=>release=r);
 let entered;const ready=new Promise(r=>entered=r);
 const r=fixture({backend:{execute:async()=>{entered();await gate;return result;}}});
 const first=r.run({projectId:'p',job});await ready;
 await assert.rejects(r.run({projectId:'p',job}),/agent_busy/);
 release();await first;assert.equal((await r.run({projectId:'p',job})).stage,'review');
});
