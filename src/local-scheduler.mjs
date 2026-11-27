import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
// SQLite holds a separate OS-backed write lock for the worker lifetime.
// Crash or exit releases the lock without a stale lock file. Scope: same lock DB.
export async function withLocalWorkerLock(filename,work){
 const db=new DatabaseSync(filename);let locked=false;
 try{
  db.exec('PRAGMA busy_timeout=0');
  try{db.exec('BEGIN IMMEDIATE');locked=true;}catch(e){if(e.errcode===5||e.errcode===6||/locked/i.test(e.message))throw Error('worker_busy');throw e;}
  return await work();
 }finally{try{if(locked)db.exec('ROLLBACK');}finally{db.close();}}
}
export async function runScheduler({pending,resume,once=false,signal,intervalMs=5000,onResult=()=>{},onError=()=>{}}){
 if(typeof pending!=='function'||typeof resume!=='function'||!Number.isSafeInteger(intervalMs)||intervalMs<1||intervalMs>60000)throw Error('invalid_scheduler');
 while(!signal?.aborted){
  const runs=await pending();
  if(!Array.isArray(runs)||runs.length>100)throw Error('invalid_queue');
  for(const run of runs){
   if(signal?.aborted)break;
   try{const result=await resume(run);onResult(result);}catch{onError();}
  }
  if(once||signal?.aborted)return;
  try{await delay(intervalMs,undefined,{signal});}catch(e){if(signal?.aborted)return;throw e;}
 }
}
