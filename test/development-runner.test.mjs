import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDevelopmentRunner} from '../src/development-runner.mjs';
import {createMemoryRunStore} from '../src/run-store.mjs';
import {createStaticSandboxExecutor} from '../src/static-sandbox.mjs';

const plan={goal:'Create a demo',steps:[{id:'inspect',kind:'inspect',description:'Inspect constraints',dependsOn:[]},{id:'design',kind:'design',description:'Design page',dependsOn:['inspect']},{id:'test',kind:'test',description:'Test static page',dependsOn:['design']},{id:'preview',kind:'preview',description:'Create preview',dependsOn:['test']}]};
const broken=[{path:'app/index.html',content:'<!doctype html><title>Demo</title><h1>Demo</h1>'}];
const fixed=[{path:'app/index.html',content:'<!doctype html><html><head><title>Demo</title></head><body><main><h1>Demo</h1></main></body></html>'},{path:'app/style.css',content:'main{max-width:40rem;margin:auto}'}];

test('prompt to validated plan, bounded repair, and durable preview artifact',async()=>{
 let counter=0;const store=createMemoryRunStore({idFactory:()=>`artifact-${++counter}`});const phases=[];
 const model={generate:async({phase})=>{phases.push(phase);if(phase==='plan')return {plan};return {patches:phase==='patch'?broken:fixed};}};
 const runner=createDevelopmentRunner({model,executor:createStaticSandboxExecutor(),store,idFactory:()=> 'run-1'});
 const result=await runner.start({projectId:'project-1',actorId:'actor-1',prompt:'Create a demo'});
 assert.deepEqual(result,{id:'run-1',projectId:'project-1',stage:'review',repairs:1,revision:6});
 assert.deepEqual(phases,['plan','patch','repair']);
 const artifacts=await store.artifactsFor('run-1');
 assert.equal(artifacts.filter(a=>a.type==='preview').length,1);
 assert.match(artifacts.at(-1).body.html,/<main>/);
 assert.equal((await store.eventsFor('run-1')).length,6);
});

test('repairs stop after two failed attempts',async()=>{
 let repairs=0;const store=createMemoryRunStore({idFactory:()=>`artifact-${++repairs}`});
 const model={generate:async({phase})=>phase==='plan'?{plan}:{patches:broken}};
 const runner=createDevelopmentRunner({model,executor:createStaticSandboxExecutor(),store,idFactory:()=> 'run-2'});
 const result=await runner.start({projectId:'project-2',actorId:'actor-2',prompt:'Create a demo'});
 assert.equal(result.stage,'blocked');assert.equal(result.repairs,2);assert.equal(result.revision,7);
});

test('invalid model plan is blocked before a patch can execute',async()=>{
 const store=createMemoryRunStore({idFactory:()=> 'artifact'});let executed=false;
 const runner=createDevelopmentRunner({model:{generate:async()=>({plan:{}})},executor:{execute:async()=>{executed=true;return {passed:true,checks:[]};}},store,idFactory:()=> 'run-3'});
 const result=await runner.start({projectId:'project-3',actorId:'actor-3',prompt:'Create a demo'});
 assert.equal(result.stage,'blocked');assert.equal(executed,false);
});

test('executor contract failure blocks instead of entering an autonomous repair loop',async()=>{
 const store=createMemoryRunStore({idFactory:()=> 'artifact'});
 const model={generate:async({phase})=>phase==='plan'?{plan}:{patches:fixed}};
 const runner=createDevelopmentRunner({model,executor:{execute:async()=>({passed:true})},store,idFactory:()=> 'run-4'});
 const result=await runner.start({projectId:'project-4',actorId:'actor-4',prompt:'Create a demo'});
 assert.equal(result.stage,'blocked');assert.equal(result.repairs,1);
});

test('resumes an interrupted run from its persisted patch stage',async()=>{
 let n=0;const store=createMemoryRunStore({idFactory:()=>`artifact-${++n}`});
 let run=await store.createRun({id:'resume-1',projectId:'p',goal:'Demo'});
 await store.saveArtifact(run,{type:'plan',body:{plan}});
 run=await store.advanceRun(run,{runId:run.id,projectId:run.projectId,stage:'plan',result:'ok'});
 const phases=[];const model={generate:async({phase})=>{phases.push(phase);return {patches:fixed};}};
 const runner=createDevelopmentRunner({model,executor:createStaticSandboxExecutor(),store});
 const result=await runner.resume({id:'resume-1',projectId:'p'});
 assert.equal(result.stage,'review');assert.deepEqual(phases,['patch']);
 assert.equal((await store.latestArtifact('resume-1','p','preview')).kind,'static-html');
 await assert.rejects(runner.resume({id:'resume-1',projectId:'other'}),/unknown_run/);
});

test('simultaneous resumes do not drive the same run',async()=>{
 const store=createMemoryRunStore();await store.createRun({id:'same',projectId:'p',goal:'Demo'});
 let release;const gate=new Promise(resolve=>{release=resolve;});let started;const ready=new Promise(resolve=>{started=resolve;});
 const model={generate:async({phase})=>{if(phase==='plan'){started();await gate;return {plan};}return {patches:fixed};}};
 const runner=createDevelopmentRunner({model,executor:createStaticSandboxExecutor(),store});
 const first=runner.resume({id:'same',projectId:'p'});await ready;
 await assert.rejects(runner.resume({id:'same',projectId:'p'}),/run_busy/);
 release();assert.equal((await first).stage,'review');
});

test('expired runner cannot persist a late model response',async()=>{
 let now=0;const store=createMemoryRunStore({clock:()=>now});await store.createRun({id:'expired',projectId:'p',goal:'Demo'});
 const runner=createDevelopmentRunner({model:{generate:async()=>{now=120001;return {plan};}},executor:createStaticSandboxExecutor(),store});
 await assert.rejects(runner.resume({id:'expired',projectId:'p'}),/stale_run/);
 assert.equal((await store.getRun('expired','p')).stage,'plan');
 assert.equal((await store.artifactsFor('expired')).length,0);
});

test('heartbeat renews lease while model is pending',async()=>{
 const store=createMemoryRunStore();let renewed;const ready=new Promise(resolve=>{renewed=resolve;});let calls=0;
 const wrapped={...store,renewLease:async(...args)=>{await store.renewLease(...args);if(++calls>=2)renewed();}};
 const runner=createDevelopmentRunner({store:wrapped,heartbeatMs:5,executor:createStaticSandboxExecutor(),model:{generate:async({phase})=>{if(phase==='plan'){await ready;return {plan};}return {patches:fixed};}}});
 const result=await runner.start({projectId:'p',actorId:'a',prompt:'Demo'});
 assert.equal(result.stage,'review');assert.ok(calls>=2);
});
test('heartbeat failure fences model result',async()=>{
 const store=createMemoryRunStore();let failed;const ready=new Promise(resolve=>{failed=resolve;});let calls=0;
 const wrapped={...store,renewLease:async(...args)=>{if(++calls>=2){failed();throw Error('db unavailable');}return store.renewLease(...args);}};
 const runner=createDevelopmentRunner({store:wrapped,heartbeatMs:5,executor:createStaticSandboxExecutor(),model:{generate:async()=>{await ready;return {plan};}}});
 await assert.rejects(runner.start({id:'lost',projectId:'p',actorId:'a',prompt:'Demo'}),/stale_run/);
 assert.equal((await store.getRun('lost','p')).stage,'plan');
 assert.equal((await store.artifactsFor('lost')).length,0);
});
