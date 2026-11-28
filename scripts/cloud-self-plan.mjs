import {createGroqTransport} from '../src/groq-transport.mjs';
import {d1AiBudget} from '../src/d1-ai-budget.mjs';
import {planSelfTask} from './self-plan.mjs';
export async function cloudSelfPlan({report,db,apiKey,freePlanVerified=false,fetcher=fetch}){
 const send=createGroqTransport({apiKey,model:'openai/gpt-oss-20b',admission:d1AiBudget(db),freePlanVerified,publicSourceApproved:true,fetcher});
 return planSelfTask({report,model:{generate:async ({prompt,phase})=>{
 if(phase!=='plan')throw Error('planning_only');
 return send({messages:[{role:'system',content:'Return only JSON. Produce a proposal, not execution authority.'},{role:'user',content:prompt}],jsonOutput:true});
 }}});
}
