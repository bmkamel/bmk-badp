import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGroqTransport} from '../src/groq-transport.mjs';
import {openTransportBudget} from '../src/transport-budget.mjs';
test('Groq failed request consumes quota and blocks next network call',async()=>{
 const admission=openTransportBudget(':memory:',{limits:{groq:{verifiedFree:true,minuteRequests:1,dailyRequests:1,dailyUnits:10000}}});
 let calls=0;
 const send=createGroqTransport({apiKey:'test-only',freePlanVerified:true,publicSourceApproved:true,admission,fetcher:async()=>{calls++;throw Error('mock_network');}});
 const messages=[{role:'system',content:'public'},{role:'user',content:'test'}];
 try{
 await assert.rejects(send({messages}),/mock_network/);
 await assert.rejects(send({messages}),/groq_quota_denied/);
 assert.equal(calls,1);
 }finally{admission.close();}
});
