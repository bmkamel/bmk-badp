import {validatePlan} from '../src/plan.mjs';
export async function planSelfTask({report,model}){
 if(report?.taskId!=='BADP-TASK-001'||report.stage!=='inspection'||report.executionAuthorized!==false||!Array.isArray(report.inventory)||report.inventory.length!==5||!model?.generate)throw Error('invalid_inspection');
 const prompt='Plan BADP-TASK-001 only: inspect durable task lifecycle, prevent duplicate completed tasks, preserve state on restart, reject stale leases, verify failure and retry. No changes to policy, credentials, billing or external projects. Return JSON {plan:{goal:string,steps:[{id:string,kind:inspect|design|patch|test|preview,description:string,dependsOn:string[]}]}}. Begin with inspect, include test, end with preview. Source inventory: '+report.inventory.map(x=>x.path).join(', ');
 const accept=raw=>{const value=JSON.parse(raw);if(!validatePlan(value.plan))throw Error('invalid_self_plan');return value.plan;};
 const raw=await model.generate({phase:'plan',dataClass:'public',prompt,accept});
 return {taskId:report.taskId,base:report.base,blueprintDigest:report.blueprintDigest,plan:accept(raw),executionAuthorized:false};
}
