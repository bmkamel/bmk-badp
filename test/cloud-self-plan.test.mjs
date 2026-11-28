import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudSelfPlan} from '../scripts/cloud-self-plan.mjs';
const report={taskId:'BADP-TASK-001',stage:'inspection',executionAuthorized:false,inventory:Array.from({length:5},(_,i)=>({path:'file'+i}))};
test('quota denial prevents network access',async()=>{
 let calls=0;
 const db={prepare:()=>({bind:()=>({run:async()=>({meta:{changes:0}})})})};
 await assert.rejects(cloudSelfPlan({report,db,apiKey:'fixture',freePlanVerified:true,fetcher:async()=>{calls++;throw Error('unexpected');}}),/groq_quota_denied/);
 assert.equal(calls,0);
});
