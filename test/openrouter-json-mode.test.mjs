import test from 'node:test';
import assert from 'node:assert/strict';
import {createOpenRouterFreeTransport} from '../src/openrouter-free.mjs';
test('structured requests require JSON support without relaxing zero price',async()=>{
 const bodies=[];
 const send=createOpenRouterFreeTransport({apiKey:'fixture',publicSourceApproved:true,admission:{reserve:()=>({allowed:true})},fetcher:async(_,opts)=>{bodies.push(JSON.parse(opts.body));return new Response(JSON.stringify({usage:{cost:0},choices:[{finish_reason:'stop',message:{content:'{}'}}]}));}});
 const messages=[{role:'system',content:'Return JSON'},{role:'user',content:'Fixture'}];
 await send({messages,jsonOutput:true});await send({messages});
 assert.deepEqual(bodies[0].response_format,{type:'json_object'});
 assert.equal(bodies[0].provider.require_parameters,true);
 assert.equal(bodies[1].response_format,undefined);
 for(const body of bodies){assert.equal(body.model,'openrouter/free');assert.deepEqual(body.provider.max_price,{prompt:0,completion:0,request:0});assert.equal(body.provider.data_collection,'deny');}
});
