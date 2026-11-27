import {advance} from './pipeline.mjs';
import {validateArtifact} from './run-store.mjs';

const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value);
const makeId=()=>crypto.randomUUID();

// D1 implementation uses optimistic revisions. The conditional event insert is
// batched with the update, so a stale writer cannot record an orphan event.
export function d1RunStore(db,{idFactory=makeId}={}){
 if(!db||typeof db.prepare!=='function'||typeof db.batch!=='function')throw Error('d1_batch_required');
 return Object.freeze({
  async createRun({id,projectId,goal}){
   if(!validId(id)||!validId(projectId)||typeof goal!=='string'||!goal.trim()||goal.length>4000)throw Error('invalid_run');
   const run={id,projectId,goal:goal.trim(),stage:'plan',repairs:0,revision:0};
   await db.prepare('INSERT INTO development_runs(id,project_id,goal,stage,repairs,revision) VALUES (?,?,?,?,?,?)').bind(run.id,run.projectId,run.goal,run.stage,run.repairs,run.revision).run();
   return run;
  },
  async advanceRun(run,event){
   if(!run||!validId(run.id)||!validId(run.projectId)||!Number.isSafeInteger(run.revision)||run.revision<0)throw Error('invalid_run');
   const next=advance(run,event),nextRevision=run.revision+1,eventId=idFactory();
   if(!validId(eventId))throw Error('invalid_event_id');
   const update=db.prepare('UPDATE development_runs SET stage=?,repairs=?,revision=? WHERE id=? AND project_id=? AND revision=?').bind(next.stage,next.repairs,nextRevision,run.id,run.projectId,run.revision);
   const eventInsert=db.prepare('INSERT INTO development_events(id,run_id,project_id,stage,outcome) SELECT ?,?,?,?,? WHERE changes()=1').bind(eventId,run.id,run.projectId,run.stage,event.result);
   const results=await db.batch([update,eventInsert]);
   if(results?.[0]?.meta?.changes!==1)throw Error('stale_run');
   return {...next,revision:nextRevision};
  },
  async saveArtifact(run,artifact){
   if(!run||!validId(run.id)||!validId(run.projectId))throw Error('invalid_run');
   const safe=validateArtifact(artifact),id=idFactory();if(!validId(id))throw Error('invalid_artifact_id');
   const result=await db.prepare('INSERT INTO development_artifacts(id,run_id,project_id,type,content_json) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM development_runs WHERE id=? AND project_id=? AND revision=? AND stage=?)').bind(id,run.id,run.projectId,safe.type,JSON.stringify(safe.body),run.id,run.projectId,run.revision,run.stage).run();
   if(result?.meta?.changes!==1)throw Error('stale_run');
   return {id,runId:run.id,projectId:run.projectId,...safe};
  },
  async getRun(id,projectId){
   if(!validId(id)||!validId(projectId))return null;
   const row=await db.prepare('SELECT id,project_id AS projectId,goal,stage,repairs,revision,created_at AS createdAt FROM development_runs WHERE id=? AND project_id=?').bind(id,projectId).first();
   return row||null;
  },
  async latestArtifact(id,projectId,type){
   if(!validId(id)||!validId(projectId)||!['plan','patch','test','preview','failure'].includes(type))return null;
   const row=await db.prepare('SELECT content_json FROM development_artifacts WHERE run_id=? AND project_id=? AND type=? ORDER BY rowid DESC LIMIT 1').bind(id,projectId,type).first();
   return row?JSON.parse(row.content_json):null;
  }
 });
}
