import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHybridRunnerAdapter} from '../src/hybrid-runner-adapter.mjs';
test('validates plans and defaults to private',async()=>{
 const plan={goal:'test',steps:['inspect','test','preview'].map((kind,i)=>({id:String(i),kind,description:kind,dependsOn:[]}))};
 let request;
 const adapter=createHybridRunnerAdapter({runtime:{generate:async r=>{request=r;return JSON.stringify({plan});}},publicProjects:['approved']});
 assert.deepEqual(await adapter.generate({phase:'plan',prompt:'test',context:{projectId:'other'}}),{plan});
 assert.equal(request.dataClass,'private');
 await adapter.generate({phase:'plan',prompt:'test',context:{projectId:'approved'}});
 assert.equal(request.dataClass,'public');
});
test('rejects invalid model output',async()=>{
 const adapter=createHybridRunnerAdapter({runtime:{generate:async()=> '{"patches":[{"path":"../secret","content":"x"}]}'}});
 await assert.rejects(adapter.generate({phase:'patch',prompt:'test'}));
 await assert.rejects(adapter.generate({phase:'plan',prompt:'test'}));
});
