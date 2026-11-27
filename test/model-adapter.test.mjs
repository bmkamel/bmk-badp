import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFreeModelAdapter} from '../src/model-adapter.mjs';

const provider={id:'free-model',enabled:true,costClass:'free',tasks:['plan','patch','repair']};
test('free adapter only invokes an enabled free provider',async()=>{
 const calls=[];const adapter=createFreeModelAdapter({provider,invoke:async request=>{calls.push(request);return '{"plan":{}}';}});
 assert.deepEqual(await adapter.generate({phase:'plan',prompt:'Build a demo',context:{runId:'r'}}),{plan:{}});
 assert.equal(calls[0].provider,'free-model');assert.equal(calls[0].phase,'plan');
});
test('adapter rejects paid, unsupported, and malformed outputs',async()=>{
 assert.throws(()=>createFreeModelAdapter({provider:{...provider,costClass:'paid'},invoke:async()=>({})}),/free_model_required/);
 const adapter=createFreeModelAdapter({provider,invoke:async()=>'{bad'});
 await assert.rejects(adapter.generate({phase:'plan',prompt:'x',context:{}}),/invalid_model_output/);
 await assert.rejects(adapter.generate({phase:'deploy',prompt:'x',context:{}}),/unsupported_model_task/);
});
