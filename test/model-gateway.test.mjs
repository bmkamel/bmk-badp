import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createModelGateway} from '../src/model-gateway.mjs';
const req={phase:'plan',prompt:'demo',context:{}};
const provider=(id,extra={})=>({id,location:'local',enabled:true,costClass:'free',tasks:['plan'],adapter:{generate:async()=>({id})},...extra});
test('falls back between eligible local providers only',async()=>{
 const g=createModelGateway({providers:[provider('paid',{costClass:'paid'}),provider('broken',{adapter:{generate:async()=>{throw Error('failure')}}}),provider('ok')]});
 assert.deepEqual(await g.generate(req),{id:'ok'});
});
test('cloud requires explicit public classification, verified free and admission',async()=>{
 let calls=0;
 const cloud=provider('cloud',{location:'cloud',verifiedFree:true,adapter:{generate:async()=>{calls++;return {ok:true}}}});
 const g=createModelGateway({providers:[cloud],admission:{reserve:async()=>({allowed:true})}});
 await assert.rejects(g.generate(req),/no_eligible_model/);
 assert.equal(calls,0);
 assert.deepEqual(await g.generate({...req,dataClass:'public'}),{ok:true});
 assert.equal(calls,1);
 for(const p of [cloud,{...cloud,verifiedFree:false}]){
  const denied=createModelGateway({providers:[p]});
  await assert.rejects(denied.generate({...req,dataClass:'public'}),/no_eligible_model/);
 }
});
test('denied quota never invokes cloud',async()=>{
 const g=createModelGateway({providers:[provider('cloud',{location:'cloud',verifiedFree:true})],admission:{reserve:async()=>({allowed:false})}});
 await assert.rejects(g.generate({...req,dataClass:'public'}),/no_eligible_model/);
});
test('serial execution protects constrained laptop and releases lock',async()=>{
 let release;const wait=new Promise(r=>{release=r});
 const g=createModelGateway({providers:[provider('local',{adapter:{generate:async()=>{await wait;return {ok:true}}}})]});
 const first=g.generate(req);
 await assert.rejects(g.generate(req),/gateway_busy/);
 release();await first;assert.deepEqual(await g.generate(req),{ok:true});
});
test('rejects invalid configuration and unsupported phases',async()=>{
 assert.throws(()=>createModelGateway({providers:[provider('same'),provider('same')]}),/invalid_provider/);
 const g=createModelGateway({providers:[provider('local')]});
 await assert.rejects(g.generate({...req,phase:'deploy'}),/invalid_request/);
});
