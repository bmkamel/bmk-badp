import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOpenRouterFreeTransport} from '../src/openrouter-free.mjs';
const messages=[{role:'system',content:'JSON only'},{role:'user',content:'Public test'}];
const base={apiKey:'test-only',publicSourceApproved:true,admission:{reserve:async()=>({allowed:true})}};
const response=cost=>new Response(JSON.stringify({usage:{cost},choices:[{finish_reason:'stop',message:{content:'{}'}}]}));
test('uses fixed free endpoint and zero price ceiling',async()=>{
 const run=createOpenRouterFreeTransport({...base,fetcher:async(url,opts)=>{
 assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');assert.equal(opts.redirect,'error');
 const body=JSON.parse(opts.body);assert.equal(body.model,'openrouter/free');assert.equal(body.provider.max_price.prompt,0);assert.equal(body.provider.data_collection,'deny');return response(0);
 }});
 assert.equal(await run({messages}),'{}');
});
test('denies missing consent and quota before transport',async()=>{
 assert.throws(()=>createOpenRouterFreeTransport({...base,publicSourceApproved:false}),/cloud_not_authorized/);
 const run=createOpenRouterFreeTransport({...base,admission:{reserve:async()=>({allowed:false})},fetcher:async()=>assert.fail('network called')});
 await assert.rejects(run({messages}),/cloud_quota_denied/);
});
test('rejects cost or missing cost evidence without paid retry',async()=>{
 for(const cost of [0.01,undefined]){
 let calls=0;const run=createOpenRouterFreeTransport({...base,fetcher:async()=>{calls++;return response(cost);}});
 await assert.rejects(run({messages}),/cloud_response_unverified/);assert.equal(calls,1);
 }
});
