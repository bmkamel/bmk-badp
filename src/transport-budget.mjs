// Separate strict transport admission: explicit limits and atomic multi-window accounting.
import {DatabaseSync} from 'node:sqlite';
const pos=n=>Number.isSafeInteger(n)&&n>0;
export function openTransportBudget(filename,{limits,clock=Date.now}={}){
 const policies=new Map(Object.entries(limits??{}).map(([id,p])=>{
  if(!/^[a-z0-9_-]+$/.test(id)||p?.verifiedFree!==true||!['minuteRequests','dailyRequests','dailyUnits'].every(k=>pos(p[k])))throw Error('invalid_budget_policy');
  return [id,Object.freeze({...p})];
 }));
 if(!policies.size)throw Error('empty_budget_policy');
 const db=new DatabaseSync(filename);
 try{
 db.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
 try{
 const app=db.prepare('PRAGMA application_id').get().application_id;
 if(app!==1111573586&&(app!==0||db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").get().n!==0))throw Error('not_budget_database');
 db.exec('CREATE TABLE IF NOT EXISTS budget(provider TEXT, kind TEXT, bucket INTEGER, used INTEGER NOT NULL CHECK(used>=0), PRIMARY KEY(provider,kind,bucket)); CREATE TABLE IF NOT EXISTS budget_clock(id INTEGER PRIMARY KEY CHECK(id=1), last_ms INTEGER NOT NULL); PRAGMA application_id=1111573586; COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 const read=db.prepare('SELECT used FROM budget WHERE provider=? AND kind=? AND bucket=?');
 const write=db.prepare('INSERT INTO budget VALUES(?,?,?,?) ON CONFLICT(provider,kind,bucket) DO UPDATE SET used=excluded.used');
 return Object.freeze({
 reserve({providerId,inputBytes,maxCompletionTokens}={}){
 const p=policies.get(providerId),now=clock();
 if(!p||!pos(inputBytes)||!pos(maxCompletionTokens)||!Number.isSafeInteger(now)||now<0||!pos(inputBytes+maxCompletionTokens))return {allowed:false};
 let tx=false;
 try{
 db.exec('BEGIN IMMEDIATE');tx=true;
 const last=db.prepare('SELECT last_ms FROM budget_clock WHERE id=1').get()?.last_ms??0;
 if(now<last)throw Error('clock_regression');
 const day=Math.floor(now/86400000),minute=Math.floor(now/60000);
 const rows=[['minute',minute,1,p.minuteRequests],['day',day,1,p.dailyRequests],['units',day,inputBytes+maxCompletionTokens,p.dailyUnits]];
 for(const [kind,bucket,amount,limit] of rows){
 const used=read.get(providerId,kind,bucket)?.used??0;
 if(amount>limit-used)throw Error('quota_exhausted');
 write.run(providerId,kind,bucket,used+amount);
 }
 db.prepare('INSERT INTO budget_clock VALUES(1,?) ON CONFLICT(id) DO UPDATE SET last_ms=excluded.last_ms').run(now);
 db.exec('COMMIT');tx=false;return {allowed:true};
 }catch{if(tx)try{db.exec('ROLLBACK');}catch{}return {allowed:false};}
 },
 close(){db.close();}
 });
 }catch(e){db.close();throw e;}
}
