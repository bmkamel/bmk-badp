import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeBoundedSource} from '../scripts/bounded-ai-source.mjs';
const source='export const formatLabel = value => String(value).trim();';
const baseCommit='a'.repeat(40);
const db=changes=>({prepare:()=>({bind:()=>({run:async()=>({meta:{changes}})})})});
const args={source,baseCommit,apiKey:'fixture',freePlanVerified:true};
test('model proposal is bound to source and remains proposal only',async()=>{
 const result=await proposeBoundedSource({...args,db:db(1),fetcher:async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({content:'export function formatLabel(value) { return String(value).trim(); }'})}}]})});
 assert.equal(result.status,'proposal-only');
 assert.equal(result.files[0].path,'src/pilot-format.mjs');
});
test('quota denial prevents model request',async()=>{
 await assert.rejects(proposeBoundedSource({...args,db:db(0),fetcher:async()=>{assert.fail('network called');}}),/groq_quota_denied/);
});
