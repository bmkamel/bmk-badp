import {validatePlan} from './plan.mjs';
import {validatePatches} from './static-sandbox.mjs';
export function createHybridRunnerAdapter({runtime,publicProjects=[]}={}){
 if(typeof runtime?.generate!=='function'||!Array.isArray(publicProjects))throw Error('invalid_runtime');
 const approved=new Set(publicProjects);
 return Object.freeze({async generate(request){
 const {phase,prompt,context={}}=request;
 if(!['plan','patch','repair'].includes(phase)||typeof prompt!=='string')throw Error('invalid_request');
 const schema=phase==='plan'?'Return JSON only: {"plan":{"goal":"...","steps":[{"id":"1","kind":"inspect","description":"...","dependsOn":[]}]}}. Inspect first, include test, preview last.':'Return JSON only: {"patches":[{"path":"app/index.html","content":"..."}]}. Complete static app, title and main, no scripts or external URLs.';
 const projectId=context.projectId;
 const dataClass=approved.has(projectId)?'public':'private';
 // Never serialize checkpoint context into a cloud prompt.
 const output=await runtime.generate({phase,prompt:schema+'\nGoal: '+prompt,dataClass,context});
 if(typeof output==='string'&&Buffer.byteLength(output)>250000)throw Error('response_limit');
 const value=typeof output==='string'?JSON.parse(output):output;
 if(phase==='plan'){if(!validatePlan(value?.plan))throw Error('invalid_plan');return {plan:value.plan};}
 return {patches:validatePatches(value?.patches)};
 }});
}
