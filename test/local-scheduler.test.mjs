import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runScheduler,withLocalWorkerLock} from '../src/local-scheduler.mjs';
test('single worker lock rejects concurrent owner and releases on error',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'badp-lock-'));const path=join(dir,'worker.sqlite');
 try{
 await withLocalWorkerLock(path,async()=>{await assert.rejects(withLocalWorkerLock(path,async()=>{}),/worker_busy/);});
 await assert.rejects(withLocalWorkerLock(path,async()=>{throw Error('test failure')}),/test failure/);
 assert.equal(await withLocalWorkerLock(path,async()=>42),42);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('drain processes sequentially and continues after failure',async()=>{
 const calls=[];let errors=0;
 await runScheduler({once:true,pending:()=>['a','b','c'],resume:async r=>{calls.push(r);if(r==='b')throw Error('failure');return r;},onError:()=>errors++});
 assert.deepEqual(calls,['a','b','c']);assert.equal(errors,1);
});
test('watch polls and stops without starting another task after abort',async()=>{
 const c=new AbortController();let polls=0;const calls=[];
 await runScheduler({signal:c.signal,intervalMs:1,pending:()=>++polls===1?[]:['a','b'],resume:async r=>{calls.push(r);c.abort();}});
 assert.equal(polls,2);assert.deepEqual(calls,['a']);
});
