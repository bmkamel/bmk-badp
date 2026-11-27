import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOpenRouterFreeTransport} from '../src/openrouter-free.mjs';
import {openTransportBudget} from '../src/transport-budget.mjs';
test('OpenRouter reserves dimensions before any network request',async()=>{
 const admission=openTransportBudget(':memory:',{limits:{'openrouter-free':{verifiedFree:true,minuteRequests:1,dailyRequests:1,dailyUnits:10000}}});
 let calls=0;
 const send=createOpenRouterFreeTransport({apiKey:'test-only',publicSourceApproved:true,admission,fetcher:async()=>{calls++;throw Error('mock_network');}});
 const messages=[{role:'system',content:'public'},{role:'user',content:'test'}];
 try{
 await assert.rejects(send({messages}),/mock_network/);
 await assert.rejects(send({messages}),/cloud_quota_denied/);
 assert.equal(calls,1);
 }finally{admission.close();}
});
