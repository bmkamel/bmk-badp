import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openHybridRuntime} from '../src/hybrid-runtime.mjs';
test('private prompts stay local and public fallback consumes each provider once',async()=>{
 let g=0,o=0;
 const runtime=openHybridRuntime({database:':memory:',publicSourceApproved:true,limits:Object.fromEntries(['groq','openrouter-free'].map(id=>[id,{verifiedFree:true,minuteRequests:1,dailyRequests:1,dailyUnits:10000}])),groq:{apiKey:'test',freePlanVerified:true,fetcher:async()=>{g++;throw Error('mock');}},openrouter:{apiKey:'test',fetcher:async()=>{o++;throw Error('mock');}},local:{generate:async()=> 'local'}});
 try{
 assert.equal(await runtime.generate({phase:'plan',prompt:'private'}),'local');
 assert.deepEqual([g,o],[0,0]);
 for(let i=0;i<2;i++)assert.equal(await runtime.generate({phase:'plan',prompt:'public',dataClass:'public'}),'local');
 assert.deepEqual([g,o],[1,1]);
 }finally{runtime.close();}
});
