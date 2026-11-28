export const budgetSchema='CREATE TABLE IF NOT EXISTS ai_daily_budget (provider TEXT NOT NULL, day INTEGER NOT NULL, requests INTEGER NOT NULL, units INTEGER NOT NULL, PRIMARY KEY(provider,day))';
export function d1AiBudget(db){
 if(!db?.prepare)throw Error('budget_storage_required');
 return Object.freeze({async reserve({providerId,inputBytes,maxCompletionTokens}={}){
 const units=inputBytes+maxCompletionTokens;
 if(providerId!=='groq'||!Number.isSafeInteger(inputBytes)||inputBytes<1||!Number.isSafeInteger(maxCompletionTokens)||maxCompletionTokens<1||maxCompletionTokens>2048||!Number.isSafeInteger(units)||units>8000)return {allowed:false};
 try{
 const result=await db.prepare("INSERT INTO ai_daily_budget(provider,day,requests,units) VALUES (?,CAST(unixepoch()/86400 AS INTEGER),1,?) ON CONFLICT(provider,day) DO NOTHING").bind(providerId,units).run();
 return {allowed:result?.meta?.changes===1};
 }catch{return {allowed:false};}
 }});
}
