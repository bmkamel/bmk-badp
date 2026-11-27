import {DatabaseSync} from 'node:sqlite';
const positive=n=>Number.isSafeInteger(n)&&n>0;
// Dedicated BADP quota database; limits are operator supplied, never inferred.
export function openQuotaAdmission(filename,{limits,clock=Date.now}={}){
 if(!limits||typeof limits!=='object')throw Error('invalid_limits');
 const policy=new Map(Object.entries(limits).map(([id,p])=>{
  if(!/^[a-z0-9_-]+$/.test(id)||p?.verifiedFree!==true||!positive(p.dailyRequests))throw Error('invalid_policy');
  return [id,p.dailyRequests];
 }));
 const db=new DatabaseSync(filename);
 try{
 db.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
 try{
 const app=db.prepare('PRAGMA application_id').get().application_id;
 if(app!==1111573585&&(app!==0||db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").get().n!==0))throw Error('not_quota_database');
 db.exec('CREATE TABLE IF NOT EXISTS quota(provider TEXT NOT NULL, day INTEGER NOT NULL, used INTEGER NOT NULL CHECK(used>=0), PRIMARY KEY(provider,day)); PRAGMA application_id=1111573585; COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 const reserve=db.prepare('INSERT INTO quota(provider,day,used) VALUES(?,?,1) ON CONFLICT(provider,day) DO UPDATE SET used=used+1 WHERE used < ?');
 return Object.freeze({
 reserve({providerId}={}){
 const limit=policy.get(providerId),now=clock();
 if(!limit||!Number.isSafeInteger(now)||now<0)return {allowed:false};
 try{return {allowed:Number(reserve.run(providerId,Math.floor(now/86400000),limit).changes)===1};}
 catch{return {allowed:false};}
 },
 close(){db.close();}
 });
 }catch(e){db.close();throw e;}
}
