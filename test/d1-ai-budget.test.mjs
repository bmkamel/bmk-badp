import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {budgetSchema,d1AiBudget} from '../src/d1-ai-budget.mjs';
test('one reservation per UTC day across instances',async()=>{
 const sql=new DatabaseSync(':memory:');
 try{sql.exec(budgetSchema);
 const db={prepare:q=>({bind:(...args)=>({run:()=>({meta:{changes:Number(sql.prepare(q).run(...args).changes)}})})})};
 const req={providerId:'groq',inputBytes:100,maxCompletionTokens:2048};
 const results=await Promise.all([d1AiBudget(db).reserve(req),d1AiBudget(db).reserve(req)]);
 assert.equal(results.filter(x=>x.allowed).length,1);
 assert.equal((await d1AiBudget(db).reserve({...req,inputBytes:9000})).allowed,false);
 assert.equal((await d1AiBudget({prepare(){throw Error('offline');}}).reserve(req)).allowed,false);
 }finally{sql.close();}
});
