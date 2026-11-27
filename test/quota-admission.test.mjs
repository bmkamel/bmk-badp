import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openQuotaAdmission} from '../src/quota-admission.mjs';
test('quota persists across connections and resets on UTC day',()=>{
 const dir=mkdtempSync(join(tmpdir(),'badp-quota-'));let a,b,now=0;
 try{
 const file=join(dir,'quota.sqlite'),opts={limits:{groq:{verifiedFree:true,dailyRequests:2}},clock:()=>now};
 a=openQuotaAdmission(file,opts);b=openQuotaAdmission(file,opts);
 assert.equal(a.reserve({providerId:'groq'}).allowed,true);
 assert.equal(b.reserve({providerId:'groq'}).allowed,true);
 a.close();a=null;
 assert.equal(b.reserve({providerId:'groq'}).allowed,false);
 assert.equal(b.reserve({providerId:'unknown'}).allowed,false);
 now=86400000;assert.equal(b.reserve({providerId:'groq'}).allowed,true);
 }finally{a?.close();b?.close();rmSync(dir,{recursive:true,force:true});}
});
test('unverified plan rejected',()=>assert.throws(()=>openQuotaAdmission(':memory:',{limits:{groq:{verifiedFree:false,dailyRequests:2}}}),/invalid_policy/));
