import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openLocalStore} from '../src/local-sqlite.mjs';
import {createDevelopmentRunner} from '../src/development-runner.mjs';
import {createStaticSandboxExecutor} from '../src/static-sandbox.mjs';
test('reopen persisted queue, resume checkpoint, isolate projects',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'badp-'));const file=join(dir,'state.sqlite');let local;
 try{
  local=openLocalStore(file);local.ensureProject('p');local.ensureProject('q');
  const run=await local.store.createRun({id:'r',projectId:'p',goal:'demo'});
  const plan={goal:'demo',steps:[{id:'i',kind:'inspect',description:'inspect',dependsOn:[]},{id:'t',kind:'test',description:'test',dependsOn:['i']},{id:'v',kind:'preview',description:'preview',dependsOn:['t']}]};
  await local.store.saveArtifact(run,{type:'plan',body:{plan}});
  await local.store.advanceRun(run,{runId:'r',projectId:'p',stage:'plan',result:'ok'});
  local.close();local=null;local=openLocalStore(file);
  assert.equal(await local.store.getRun('r','q'),null);
  assert.equal(local.pending('q').length,0);
  assert.equal(local.pending('p').length,1);
  const phases=[];
  const runner=createDevelopmentRunner({store:local.store,executor:createStaticSandboxExecutor(),model:{generate:async({phase})=>{phases.push(phase);return {patches:[{path:'app/index.html',content:'<title>Demo</title><main>Demo</main>'}]};}}});
  assert.equal((await runner.resume(local.pending('p')[0])).stage,'review');
  assert.deepEqual(phases,['patch']);assert.equal(local.pending('p').length,0);
  assert.equal((await local.store.latestArtifact('r','p','preview')).kind,'static-html');
 }finally{local?.close();rmSync(dir,{recursive:true,force:true});}
});
test('rejects unrelated databases without applying migrations',()=>{
 const dir=mkdtempSync(join(tmpdir(),'badp-'));const file=join(dir,'other.sqlite');
 try{const db=new DatabaseSync(file);db.exec('CREATE TABLE unrelated(id TEXT)');db.close();
 assert.throws(()=>openLocalStore(file),/not_badp_database/);
 const check=new DatabaseSync(file);try{assert.equal(check.prepare('PRAGMA user_version').get().user_version,0);assert.equal(check.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='projects'").get().n,0);}finally{check.close();}
 }finally{rmSync(dir,{recursive:true,force:true});}
});
