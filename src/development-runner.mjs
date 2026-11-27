import {validatePlan} from './plan.mjs';
import {validatePatches} from './static-sandbox.mjs';

const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value);
const publicRun=run=>({id:run.id,projectId:run.projectId,stage:run.stage,repairs:run.repairs,revision:run.revision});

class StageFailure extends Error{constructor(stage){super('stage_failed');this.stage=stage;}}

// Orchestrates only a bounded, static-app slice. Every output is validated and
// persisted before its state transition; the final state deliberately waits for
// independent review instead of publishing anything.
export function createDevelopmentRunner({model,executor,store,idFactory=()=>crypto.randomUUID()}){
 if(!model||typeof model.generate!=='function'||!executor||typeof executor.execute!=='function'||!store||typeof store.createRun!=='function'||typeof store.advanceRun!=='function'||typeof store.saveArtifact!=='function')throw Error('invalid_runner_dependencies');
 const step=async(run,result)=>store.advanceRun(run,{runId:run.id,projectId:run.projectId,stage:run.stage,result});
 const save=async(run,type,body)=>store.saveArtifact(run,{type,body});
 const block=async(run,stage)=>{
  await save(run,'failure',{stage,code:'operation_failed'});
  const next=await step(run,'fail');
  // A malformed executor result is not a generated-app test failure: do not
  // let a model retry around a broken execution boundary.
  return stage==='test'&&next.stage==='repair'?step(next,'fail'):next;
 };
 async function generatePlan(run,prompt,actorId){
  const output=await model.generate({phase:'plan',prompt,context:{runId:run.id,projectId:run.projectId,actorId}});
  if(!validatePlan(output.plan))throw new StageFailure('plan');
  await save(run,'plan',{plan:output.plan});return output.plan;
 }
 async function generatePatches(run,phase,prompt,context){
  const output=await model.generate({phase,prompt,context});
  let patches;try{patches=validatePatches(output.patches);}catch{throw new StageFailure(phase==='repair'?'repair':'patch');}
  await save(run,'patch',{phase,patches});return patches;
 }
 async function execute(run,patches){
  try{
   const result=await executor.execute({run:publicRun(run),patches});
   if(!result||typeof result.passed!=='boolean'||!Array.isArray(result.checks))throw Error('invalid_executor_result');
   await save(run,'test',{passed:result.passed,checks:result.checks});return result;
  }catch(error){throw new StageFailure('test');}
 }
 return Object.freeze({
  async start({id=idFactory(),projectId,actorId,prompt}){
   if(!validId(id)||!validId(projectId)||!validId(actorId)||typeof prompt!=='string'||!prompt.trim()||prompt.length>4000)throw Error('invalid_start_request');
   let run=await store.createRun({id,projectId,goal:prompt});
   try{
    const plan=await generatePlan(run,prompt.trim(),actorId);run=await step(run,'ok');
    let patches=await generatePatches(run,'patch',prompt.trim(),{plan});run=await step(run,'ok');
    let result=await execute(run,patches);
    while(!result.passed){
     run=await step(run,'fail');
     if(run.stage==='blocked')return publicRun(run);
     patches=await generatePatches(run,'repair',prompt.trim(),{plan,checks:result.checks,patches});
     run=await step(run,'ok');result=await execute(run,patches);
    }
    run=await step(run,'ok');
    if(!result.preview||typeof result.preview!=='object'||Array.isArray(result.preview))throw new StageFailure('preview');
    await save(run,'preview',result.preview);run=await step(run,'ok');
    return publicRun(run);
   }catch(error){
    const stage=error instanceof StageFailure?error.stage:run.stage;
    return publicRun(await block(run,stage));
   }
  }
 });
}
