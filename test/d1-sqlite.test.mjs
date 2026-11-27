import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {d1RunStore} from '../src/d1-run-store.mjs';

test('SQLite-backed D1 contract rejects stale events and artifacts',async()=>{
 const sql=new DatabaseSync(':memory:');
 try{
  sql.exec('PRAGMA foreign_keys=ON');
  for(const f of ['0001_initial.sql','0002_membership.sql','0003_conversations.sql','0004_identity.sql','0005_pipeline.sql','0006_execution_artifacts.sql'])sql.exec(readFileSync(new URL('../db/'+f,import.meta.url),'utf8'));
  sql.exec("INSERT INTO projects(id,name) VALUES ('p','P')");
  const db={prepare(query){return {bind(...args){return {run:async()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}}),first:async()=>sql.prepare(query).get(...args)||null};}};},async batch(statements){sql.exec('BEGIN');try{const out=[];for(const statement of statements)out.push(await statement.run());sql.exec('COMMIT');return out;}catch(error){sql.exec('ROLLBACK');throw error;}}};
  let count=0;const store=d1RunStore(db,{idFactory:()=>`id-${++count}`});
  const run=await store.createRun({id:'r',projectId:'p',goal:'Demo'});
  const event={runId:'r',projectId:'p',stage:'plan',result:'ok'};
  await store.advanceRun(run,event);
  await assert.rejects(store.advanceRun(run,event),/stale_run/);
  await assert.rejects(store.saveArtifact(run,{type:'plan',body:{plan:{}}}),/stale_run/);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM development_events').get().n,1);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM development_artifacts').get().n,0);
 }finally{sql.close();}
});
