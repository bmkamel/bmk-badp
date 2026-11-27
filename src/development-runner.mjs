import {validatePlan} from './plan.mjs';
import {validatePatches} from './static-sandbox.mjs';

const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value);
const publicRun=run=>({id:run.id,projectId:run.projectId,stage:run.stage,repairs:run.repairs,revision:run.revision});

// Recovery is explicit and sequential: the caller must ensure one active
// runner per run. The Worker does not enable this executor yet.
export function createDevelopmentRunner({model,executor,store,idFactory=()=>crypto.randomUUID()}){
 if(!model||typeof model.generate!=='function'||!executor||typeof executor.execute!=='function'||!store||['createRun','advanceRun','saveArtifact','getRun','latestArtifact'].some(k=>typeof store[k]!=='function'))throw Error('invalid_runner_dependencies');
 const step=(run,result)=>store.advanceRun(run,{runId:run.id,projectId:run.projectId,stage:run.stage,result});
 const save=(run,type,body)=>store.saveArtifact(run,{type,body});
 async function artifact(run,type){const value=await store.latestArtifact(run.id,run.projectId,type);if(!value)throw Error('missing_checkpoint');return value;}
 async function drive(initial){
  let run=initial;
  while(!['review','complete','blocked'].includes(run.stage)){
   try{
    if(run.stage==='plan'){
     const output=await model.generate({phase:'plan',prompt:run.goal,context:{runId:run.id,projectId:run.projectId}});
     if(!validatePlan(output.plan))throw Error('invalid_plan');
     await save(run,'plan',{plan:output.plan});run=await step(run,'ok');
    }else if(run.stage==='patch'||run.stage==='repair'){
     const plan=(await artifact(run,'plan')).plan;
     const context=run.stage==='repair'?{plan,checks:(await artifact(run,'test')).checks,patches:(await artifact(run,'patch')).patches}:{plan};
     const output=await model.generate({phase:run.stage,prompt:run.goal,context});
     const patches=validatePatches(output.patches);
     await save(run,'patch',{phase:run.stage,patches});run=await step(run,'ok');
    }else if(run.stage==='test'){
     const patches=(await artifact(run,'patch')).patches;
     const result=await executor.execute({run:publicRun(run),patches});
     if(!result||typeof result.passed!=='boolean'||!Array.isArray(result.checks)||(result.passed&&(!result.preview||typeof result.preview!=='object')))throw Error('invalid_executor_result');
     await save(run,'test',result);run=await step(run,result.passed?'ok':'fail');
    }else if(run.stage==='preview'){
     const result=await artifact(run,'test');
     if(!result.passed||!result.preview)throw Error('missing_preview');
     await save(run,'preview',result.preview);run=await step(run,'ok');
    }else throw Error('invalid_stage');
   }catch(error){
    if(error?.message==='stale_run')throw error;
    await save(run,'failure',{stage:run.stage,code:'operation_failed'});
    const previous=run.stage;run=await step(run,'fail');
    if(previous==='test'&&run.stage==='repair')run=await step(run,'fail');
   }
  }
  return publicRun(run);
 }
 return Object.freeze({
  async start({id=idFactory(),projectId,actorId,prompt}){
   if(!validId(id)||!validId(projectId)||!validId(actorId)||typeof prompt!=='string'||!prompt.trim()||prompt.length>4000)throw Error('invalid_start_request');
   return drive(await store.createRun({id,projectId,goal:prompt}));
  },
  async resume({id,projectId}){
   if(!validId(id)||!validId(projectId))throw Error('invalid_resume_request');
   const run=await store.getRun(id,projectId);if(!run)throw Error('unknown_run');
   return drive(run);
  }
 });
}
