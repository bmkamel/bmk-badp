import {openLocalStore} from '../src/local-sqlite.mjs';
import {createDevelopmentRunner} from '../src/development-runner.mjs';
import {createHybridRunnerAdapter} from '../src/hybrid-runner-adapter.mjs';
import {createStaticSandboxExecutor} from '../src/static-sandbox.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';

const dir=mkdtempSync(join(tmpdir(),'badp-fixture-'));
let db;
try {
 db=openLocalStore(join(dir,'state.sqlite'));
 const projectId='cloud-fixture';
 db.ensureProject(projectId);
 const phases=[];
 const runtime={async generate({phase,dataClass}){
  assert.equal(dataClass,'public');
  phases.push(phase);
  if(phase==='plan')return {plan:{goal:'Static fixture',steps:[
   {id:'inspect',kind:'inspect',description:'Inspect fixture',dependsOn:[]},
   {id:'test',kind:'test',description:'Test fixture',dependsOn:['inspect']},
   {id:'preview',kind:'preview',description:'Preview fixture',dependsOn:['test']}
  ]}};
  return {patches:[{path:'app/index.html',content:'<!doctype html><html><head><title>Fixture</title></head><body><main>Fixture</main></body></html>'}]};
 }};
 const adapter=createHybridRunnerAdapter({runtime,publicProjects:[projectId]});
 // Trusted fixture scope, not model-provided context.
 const model={generate:request=>adapter.generate({...request,context:{...request.context,projectId}})};
 const runner=createDevelopmentRunner({model,executor:createStaticSandboxExecutor(),store:db.store});
 const result=await runner.start({projectId,actorId:'fixture',prompt:'Create a static fixture'});
 assert.equal(result.stage,'review');
 assert.deepEqual(phases,['plan','patch']);
 const preview=await db.store.latestArtifact(result.id,projectId,'preview');
 assert.equal(preview.kind,'static-html');
 console.log('cloud_development_fixture_passed');
}finally{db?.close();rmSync(dir,{recursive:true,force:true});}
