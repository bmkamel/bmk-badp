import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOllamaAdapter} from '../src/ollama-adapter.mjs';
test('local request uses fixed loopback, bounded context and no redirects',async()=>{
 const a=createOllamaAdapter({fetcher:async(url,opts)=>{
 assert.equal(url,'http://127.0.0.1:11434/api/chat');assert.equal(opts.redirect,'error');
 const b=JSON.parse(opts.body);assert.equal(b.model,'qwen2.5-coder:3b');assert.equal(b.stream,false);assert.equal(b.options.num_ctx,4096);
 return Response.json({done:true,message:{content:'{"plan":{}}'}});
 }});
 assert.deepEqual(await a.generate({phase:'plan',prompt:'demo'}),{plan:{}});
});
test('rejects unapproved model and invalid timeout',()=>{
 assert.throws(()=>createOllamaAdapter({model:'remote:cloud'}),/invalid_local_configuration/);
 assert.throws(()=>createOllamaAdapter({timeoutMs:0}),/invalid_local_configuration/);
});
test('fails closed for unavailable or incomplete model',async()=>{
 for(const response of [new Response('',{status:503}),Response.json({done:false,message:{content:'{}'}})]){
 const a=createOllamaAdapter({fetcher:async()=>response});
 await assert.rejects(a.generate({phase:'plan',prompt:'demo'}));
 }
});
test('rejects oversized response and malformed JSON',async()=>{
 for(const response of [new Response('x'.repeat(250001)),Response.json({done:true,message:{content:'not JSON'}})]){
 const a=createOllamaAdapter({fetcher:async()=>response});
 await assert.rejects(a.generate({phase:'plan',prompt:'demo'}));
 }
});
