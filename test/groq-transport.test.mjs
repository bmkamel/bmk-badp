import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGroqTransport} from '../src/groq-transport.mjs';
const base={apiKey:'test',freePlanVerified:true,publicSourceApproved:true,admission:{reserve:async()=>({allowed:true})}};
const messages=[{role:'system',content:'JSON only'},{role:'user',content:'Public example'}];
test('uses fixed Groq API and allowlisted model',async()=>{
 const run=createGroqTransport({...base,fetcher:async(url,opts)=>{
 assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');assert.equal(opts.redirect,'error');assert.equal(JSON.parse(opts.body).model,'openai/gpt-oss-120b');
 return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{}'}}]}));
 }});assert.equal(await run({messages}),'{}');
});
test('denies unverified plan, disclosure, model and quota',async()=>{
 for(const patch of [{freePlanVerified:false},{publicSourceApproved:false},{model:'unknown'}])assert.throws(()=>createGroqTransport({...base,...patch}),/groq_not_authorized/);
 const run=createGroqTransport({...base,admission:{reserve:async()=>({allowed:false})},fetcher:async()=>assert.fail('network called')});
 await assert.rejects(run({messages}),/groq_quota_denied/);
});
test('stops on rate limit without retries',async()=>{
 let calls=0;const run=createGroqTransport({...base,fetcher:async()=>{calls++;return new Response('',{status:429});}});
 await assert.rejects(run({messages}),/groq_rate_limit/);assert.equal(calls,1);
});
