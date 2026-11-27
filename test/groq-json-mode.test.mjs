import test from 'node:test';
import assert from 'node:assert/strict';
import {createGroqTransport} from '../src/groq-transport.mjs';
test('JSON mode requested only for structured calls',async()=>{
 const bodies=[];
 const send=createGroqTransport({apiKey:'fixture',freePlanVerified:true,publicSourceApproved:true,admission:{reserve:()=>({allowed:true})},fetcher:async(_,opts)=>{bodies.push(JSON.parse(opts.body));return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{}'}}]}));}});
 const messages=[{role:'system',content:'Return JSON'},{role:'user',content:'Fixture'}];
 await send({messages,jsonOutput:true});await send({messages});
 assert.deepEqual(bodies[0].response_format,{type:'json_object'});
 assert.equal(bodies[0].reasoning_format,'hidden');
 assert.equal(bodies[1].response_format,undefined);
});
