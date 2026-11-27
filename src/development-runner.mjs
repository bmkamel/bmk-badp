import {validatePlan} from './plan.mjs';
import {validatePatches} from './static-sandbox.mjs';

const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value);
const publicRun=run=>({id:run.id,projectId:run.projectId,stage:run.stage,repairs:run.repairs,revision:run.revision});

export function createDevelopmentRunner({model,executor,store,idFactory=()=>crypto.randomUUID(),heartbeatMs=30000}){
 if(!model||typeof model.generate!=='function'||!executor||typeof executor.execute!=='function'||!store||['createRun','advanceRun','saveArtifact','getRun','latestArtifact','acquireLease','renewLease','releaseLease'].some(k=>typeof store[k]!=='function'))throw Error('invalid_runner_dependencies');
 if(!Number.isSafeInteger(heartbeatMs)||heartbeatMs<1||heartbeatMs>60000)throw Error('invalid_heartbeat');
 const step=(run,result)=>store.advanceRun(run,{runId:run.id,projectId:run.projectId,stage:run.stage,result});
 const save=(run,type,body)=>store.saveArtifact(run,{type,body});
 async function artifact(run,type){const value=await store.latestArtifact(run.id,run.projectId,type);if(!value)throw Error('missing_checkpoint');return value;}
 async function drive(initial,guard){
  let run=initial;
  while(!['review','complete','blocked'].includes(run.stage)){
   try{
    await guard();
    if(run.stage==='plan'){
     const output=await model.generate({phase:'plan',prompt:run.goal,context:{runId:run.id,projectId:run.projectId}});await guard();
     if(!validatePlan(output.plan))throw Error('invalid_plan');
     await save(run,'plan',{plan:output.plan});run=await step(run,'ok');
    }else if(run.stage==='patch'||run.stage==='repair'){
     const plan=(await artifact(run,'plan')).plan;
     const context=run.stage==='repair'?{plan,checks:(await artifact(run,'test')).checks,patches:(await artifact(run,'patch')).patches}:{plan};
     const output=await model.generate({phase:run.stage,prompt:run.goal,context});await guard();
     const patches=validatePatches(output.patches);
     await save(run,'patch',{phase:run.stage,patches});run=await step(run,'ok');
    }else if(run.stage==='test'){
     const patches=(await artifact(run,'patch')).patches;
     const result=await executor.execute({run:publicRun(run),patches});await guard();
     if(!result||typeof result.passed!=='boolean'||!Array.isArray(result.checks)||(result.passed&&(!result.preview||typeof result.preview!=='object')))throw Error('invalid_executor_result');
     await save(run,'test',result);run=await step(run,result.passed?'ok':'fail');
    }else if(run.stage==='preview'){
     const result=await artifact(run,'test');
     if(!result.passed||!result.preview)throw Error('missing_preview');
     await save(run,'preview',result.preview);run=await step(run,'ok');
    }else throw Error('invalid_stage');
   }catch(error){
    if(error?.message==='stale_run')throw error;
    await guard();
    await save(run,'failure',{stage:run.stage,code:'operation_failed'});
    const previous=run.stage;run=await step(run,'fail');
    if(previous==='test'&&run.stage==='repair')run=await step(run,'fail');
   }
  }
  return publicRun(run);
 }
 async function withLease(run){
  if(['review','complete','blocked'].includes(run.stage))return publicRun(run);
  const token=crypto.randomUUID();await store.acquireLease(run.id,run.projectId,token);
  let lost=false,pending=Promise.resolve();
  const renew=()=>{pending=pending.then(async()=>{if(lost)return;try{await store.renewLease(run.id,run.projectId,token);}catch{lost=true;}});return pending;};
  const guard=async()=>{await renew();if(lost)throw Error('stale_run');};
  const timer=setInterval(()=>{void renew();},heartbeatMs);
  try{const current=await store.getRun(run.id,run.projectId);return await drive({...current,leaseToken:token},guard);}
  finally{clearInterval(timer);await pending;await store.releaseLease(run.id,run.projectId,token);}
 }
 return Object.freeze({
  async start({id=idFactory(),projectId,actorId,prompt}){
   if(!validId(id)||!validId(projectId)||!validId(actorId)||typeof prompt!=='string'||!prompt.trim()||prompt.length>4000)throw Error('invalid_start_request');
   return withLease(await store.createRun({id,projectId,goal:prompt}));
  },
  async resume({id,projectId}){
   if(!validId(id)||!validId(projectId))throw Error('invalid_resume_request');
   const run=await store.getRun(id,projectId);if(!run)throw Error('unknown_run');
   return withLease(run);
  }
 });
}
