import test from 'node:test';
import assert from 'node:assert/strict';
import {openHybridRuntime} from '../src/hybrid-runtime.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('invalid primary output falls back to free secondary',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'badp-fallback-'));let runtime;const calls=[];
 const reply=content=>new Response(JSON.stringify({usage:{cost:0},choices:[{finish_reason:'stop',message:{content}}]}));
 const limit={verifiedFree:true,minuteRequests:2,dailyRequests:2,dailyUnits:16000};
 try{
 runtime=openHybridRuntime({database:join(dir,'budget.sqlite'),limits:{groq:limit,'openrouter-free':limit},publicSourceApproved:true,groq:{apiKey:'fixture',freePlanVerified:true,fetcher:async()=>{calls.push('groq');return reply('{}');}},openrouter:{apiKey:'fixture',fetcher:async()=>{calls.push('openrouter');return reply('{"valid":true}');}}});
 const result=await runtime.generate({phase:'plan',prompt:'Public fixture',dataClass:'public',accept:output=>{if(JSON.parse(output).valid!==true)throw Error('invalid');}});
 assert.deepEqual(calls,['groq','openrouter']);assert.equal(JSON.parse(result).valid,true);
 }finally{runtime?.close();rmSync(dir,{recursive:true,force:true});}
});
