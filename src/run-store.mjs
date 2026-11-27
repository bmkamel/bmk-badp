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

export function createMemoryRunStore({idFactory=()=>crypto.randomUUID(),clock=()=>Date.now()}={}){
 const runs=new Map(),events=new Map(),artifacts=new Map(),leases=new Map();
 const validLease=run=>run.leaseToken?(leases.get(run.id)?.token===run.leaseToken&&leases.get(run.id).until>clock()):!leases.has(run.id);
 return Object.freeze({
  async createRun({id,projectId,goal}){
   if(typeof id!=='string'||!id||typeof projectId!=='string'||!projectId||typeof goal!=='string'||!goal.trim()||goal.length>4000||runs.has(id))throw Error('invalid_run');
   const run={id,projectId,goal:goal.trim(),stage:'plan',repairs:0,revision:0};
   runs.set(id,run);events.set(id,[]);artifacts.set(id,[]);return clone(run);
  },
  async advanceRun(run,event){
   const current=runs.get(run?.id);
   if(!current||current.projectId!==run.projectId||current.revision!==run.revision||current.stage!==run.stage||!validLease(run))throw Error('stale_run');
   const next={...advance(current,event),revision:current.revision+1};delete next.leaseToken;
   runs.set(next.id,next);events.get(next.id).push({stage:current.stage,outcome:event.result,revision:next.revision});
   return {...clone(next),...(run.leaseToken?{leaseToken:run.leaseToken}:{})};
  },
  async saveArtifact(run,artifact){
   const current=runs.get(run?.id);
   if(!current||current.projectId!==run.projectId||current.revision!==run.revision||current.stage!==run.stage||!validLease(run))throw Error('stale_run');
   const safe=validateArtifact(artifact);const list=artifacts.get(run.id);
   const saved={id:idFactory(),runId:run.id,projectId:run.projectId,...safe};
   list.push(saved);return clone(saved);
  },
  async acquireLease(id,projectId,token){const run=runs.get(id),lease=leases.get(id);if(!run||run.projectId!==projectId||['review','complete','blocked'].includes(run.stage)||(lease&&lease.until>clock()))throw Error('run_busy');leases.set(id,{token,until:clock()+120000});},
  async renewLease(id,projectId,token){const run=runs.get(id),lease=leases.get(id);if(!run||run.projectId!==projectId||!lease||lease.token!==token||lease.until<=clock())throw Error('stale_run');lease.until=clock()+120000;},
  async releaseLease(id,projectId,token){if(runs.get(id)?.projectId===projectId&&leases.get(id)?.token===token)leases.delete(id);},
  async getRun(id,projectId){const run=runs.get(id);return run&&run.projectId===projectId?clone(run):null;},
  async latestArtifact(id,projectId,type){const found=(artifacts.get(id)||[]).filter(item=>item.projectId===projectId&&item.type===type).at(-1);return found?clone(found.body):null;},
  async eventsFor(id){return clone(events.get(id)||[]);},
  async artifactsFor(id){return clone(artifacts.get(id)||[]);}
 });
}
