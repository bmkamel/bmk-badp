import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openLocalStore} from '../src/local-sqlite.mjs';
test('BADP-TASK-001 durable restart and exclusive lease',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'badp-task-'));
 let db;
 try{
 const file=join(dir,'state.sqlite');
 db=openLocalStore(file);db.ensureProject('badp');
 const run=await db.store.createRun({id:'task-001',projectId:'badp',goal:'Inspect durable lifecycle'});
 await db.store.acquireLease(run.id,run.projectId,'first');
 await assert.rejects(db.store.acquireLease(run.id,run.projectId,'second'),/run_busy/);
 db.close();db=null;
 db=openLocalStore(file);
 assert.equal((await db.store.getRun(run.id,run.projectId)).revision,0);
 await assert.rejects(db.store.acquireLease(run.id,run.projectId,'second'),/run_busy/);
 await db.store.releaseLease(run.id,run.projectId,'first');
 await db.store.acquireLease(run.id,run.projectId,'second');
 await assert.rejects(db.store.advanceRun({...run,leaseToken:'first'},{runId:run.id,projectId:run.projectId,stage:'plan',result:'ok'}),/stale_run/);
 const next=await db.store.advanceRun({...run,leaseToken:'second'},{runId:run.id,projectId:run.projectId,stage:'plan',result:'ok'});
 assert.equal(next.revision,1);
 }finally{db?.close();rmSync(dir,{recursive:true,force:true});}
});
