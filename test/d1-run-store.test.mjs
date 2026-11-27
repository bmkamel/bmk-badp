import {test} from 'node:test';
import assert from 'node:assert/strict';
import {d1RunStore} from '../src/d1-run-store.mjs';

function fakeD1(changes=1){
 const calls=[];
 const db={
  prepare(sql){return {bind(...args){const statement={sql,args,run:async()=>({meta:{changes:1}}),first:async()=>null};calls.push(statement);return statement;}};},
  async batch(statements){calls.push({batch:statements});return [{meta:{changes}},{meta:{changes}}];}
 };
 return {db,calls};
}
test('D1 store persists a run and uses an optimistic batched transition',async()=>{
 const {db,calls}=fakeD1();let n=0;const store=d1RunStore(db,{idFactory:()=>`id-${++n}`});
 const run=await store.createRun({id:'run-1',projectId:'project-1',goal:'Demo'});
 const next=await store.advanceRun(run,{runId:'run-1',projectId:'project-1',stage:'plan',result:'ok'});
 await store.saveArtifact(next,{type:'plan',body:{plan:'saved'}});
 assert.equal(next.stage,'patch');assert.equal(next.revision,1);assert.match(calls.find(c=>c.batch).batch[1].sql,/changes\(\)=1/);assert.equal(calls.at(-1).args[3],'plan');
});
test('D1 store rejects a stale revision',async()=>{
 const {db}=fakeD1(0);const store=d1RunStore(db,{idFactory:()=> 'event-1'});
 await assert.rejects(store.advanceRun({id:'run-1',projectId:'project-1',stage:'plan',repairs:0,revision:0},{runId:'run-1',projectId:'project-1',stage:'plan',result:'ok'}),/stale_run/);
});
