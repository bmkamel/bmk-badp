import {advance} from './pipeline.mjs';

const artifactTypes=new Set(['plan','patch','test','preview','failure']);
const clone=value=>JSON.parse(JSON.stringify(value));
const bytes=value=>new TextEncoder().encode(value).length;

export function validateArtifact({type,body}){
 if(!artifactTypes.has(type)||!body||typeof body!=='object'||Array.isArray(body))throw Error('invalid_artifact');
 let encoded;try{encoded=JSON.stringify(body);}catch{throw Error('invalid_artifact');}
 if(!encoded||bytes(encoded)>500000)throw Error('invalid_artifact');
 return {type,body:JSON.parse(encoded)};
}

export function createMemoryRunStore({idFactory=()=>crypto.randomUUID()}={}){
 const runs=new Map(),events=new Map(),artifacts=new Map();
 return Object.freeze({
  async createRun({id,projectId,goal}){
   if(typeof id!=='string'||!id||typeof projectId!=='string'||!projectId||typeof goal!=='string'||!goal.trim()||goal.length>4000||runs.has(id))throw Error('invalid_run');
   const run={id,projectId,goal:goal.trim(),stage:'plan',repairs:0,revision:0};
   runs.set(id,run);events.set(id,[]);artifacts.set(id,[]);return clone(run);
  },
  async advanceRun(run,event){
   const current=runs.get(run?.id);
   if(!current||current.projectId!==run.projectId||current.revision!==run.revision||current.stage!==run.stage)throw Error('stale_run');
   const next={...advance(current,event),revision:current.revision+1};
   runs.set(next.id,next);events.get(next.id).push({stage:current.stage,outcome:event.result,revision:next.revision});
   return clone(next);
  },
  async saveArtifact(run,artifact){
   const current=runs.get(run?.id);
   if(!current||current.projectId!==run.projectId)throw Error('unknown_run');
   const safe=validateArtifact(artifact);const list=artifacts.get(run.id);
   const saved={id:idFactory(),runId:run.id,projectId:run.projectId,...safe};
   list.push(saved);return clone(saved);
  },
  async getRun(id){return runs.has(id)?clone(runs.get(id)):null;},
  async eventsFor(id){return clone(events.get(id)||[]);},
  async artifactsFor(id){return clone(artifacts.get(id)||[]);}
 });
}
