import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
test('migrations and tenant foreign keys',()=>{const db=new DatabaseSync(':memory:');try{db.exec('PRAGMA foreign_keys=ON');for(const f of ['0001_initial.sql','0002_membership.sql','0003_conversations.sql'])db.exec(readFileSync(new URL('../db/'+f,import.meta.url),'utf8'));db.exec("INSERT INTO projects(id,name) VALUES ('a','A'),('b','B'); INSERT INTO conversations(id,project_id,title) VALUES ('c','a','Chat')");assert.throws(()=>db.exec("INSERT INTO messages(id,conversation_id,project_id,role,body) VALUES ('m','c','b','user','x')"));assert.throws(()=>db.exec("INSERT INTO budget_months(month,spent_cents,reserved_cents) VALUES ('2026-11',900,101)"));}finally{db.close()}});
