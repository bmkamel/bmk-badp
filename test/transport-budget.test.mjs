import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openTransportBudget} from '../src/transport-budget.mjs';
test('atomic windows, rollback and clock regression',()=>{
 let now=0;
 const b=openTransportBudget(':memory:',{clock:()=>now,limits:{groq:{verifiedFree:true,minuteRequests:1,dailyRequests:3,dailyUnits:10}}});
 const req={providerId:'groq',inputBytes:2,maxCompletionTokens:2};
 try{
 assert.equal(b.reserve(req).allowed,true);
 assert.equal(b.reserve(req).allowed,false);
 now=60000;
 assert.equal(b.reserve({...req,inputBytes:9}).allowed,false);
 assert.equal(b.reserve(req).allowed,true);
 now=0;assert.equal(b.reserve(req).allowed,false);
 now=120000;assert.equal(b.reserve(req).allowed,false);
 now=86400000;assert.equal(b.reserve(req).allowed,true);
 assert.equal(b.reserve({providerId:'groq'}).allowed,false);
 }finally{b.close();}
});
test('requires explicit verified free policy',()=>assert.throws(()=>openTransportBudget(':memory:',{limits:{groq:{verifiedFree:false}}}),/invalid_budget_policy/));
