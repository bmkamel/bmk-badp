import test from 'node:test';
import assert from 'node:assert/strict';
import {planSelfTask} from '../scripts/self-plan.mjs';
const report={taskId:'BADP-TASK-001',stage:'inspection',executionAuthorized:false,inventory:Array.from({length:5},(_,i)=>({path:'file'+i})),base:'a'.repeat(40),blueprintDigest:'b'.repeat(64)};
const plan={goal:'Verify lifecycle',steps:['inspect','test','preview'].map((kind,i)=>({id:String(i),kind,description:kind,dependsOn:i?[String(i-1)]:[]}))};
test('model proposal cannot grant execution authority',async()=>{const result=await planSelfTask({report,model:{generate:async req=>{assert.equal(req.phase,'plan');return JSON.stringify({plan,executionAuthorized:true});}}});assert.deepEqual(result.plan,plan);assert.equal(result.executionAuthorized,false);});
test('reject invalid model output and invalid task',async()=>{const model={generate:async()=>JSON.stringify({plan:{}})};await assert.rejects(planSelfTask({report,model}),/invalid_self_plan/);await assert.rejects(planSelfTask({report:{...report,taskId:'other'},model}),/invalid_inspection/);});
