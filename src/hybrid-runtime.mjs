import {createGroqTransport} from './groq-transport.mjs';
import {createOpenRouterFreeTransport} from './openrouter-free.mjs';
import {openTransportBudget} from './transport-budget.mjs';
const phases=new Set(['plan','patch','repair']);
// Trusted caller must classify the entire prompt as public; context is never forwarded.
export function openHybridRuntime({database,limits,groq,openrouter,local,publicSourceApproved=false}={}){
 if((groq||openrouter)&&publicSourceApproved!==true)throw Error('public_source_not_approved');
 const budget=groq||openrouter?openTransportBudget(database,{limits}):null;
 try{
 const transports=[];
 if(groq)transports.push(createGroqTransport({...groq,admission:budget,publicSourceApproved}));
 if(openrouter)transports.push(createOpenRouterFreeTransport({...openrouter,admission:budget,publicSourceApproved}));
 let busy=false;
 return Object.freeze({
 async generate(request){
 const accept=typeof request?.accept==='function'?request.accept:output=>output;
 if(!phases.has(request?.phase)||typeof request.prompt!=='string'||!request.prompt.trim()||Buffer.byteLength(request.prompt)>4000)throw Error('invalid_request');
 if(busy)throw Error('runtime_busy');
 busy=true;
 try{
 if(request.dataClass==='public'){
 const messages=[{role:'system',content:'Return only a valid JSON object for the requested development artifact. Phase: '+request.phase},{role:'user',content:request.prompt}];
 for(const send of transports){try{const output=await send({messages,jsonOutput:true,phase:request.phase});await accept(output);return output;}catch{}}
 }
 if(typeof local?.generate==='function'){const {accept:ignored,...localRequest}=request;const output=await local.generate(localRequest);await accept(output);return output;}
 throw Error('no_eligible_model');
 }finally{busy=false;}
 },
 close(){if(busy)throw Error('runtime_busy');budget?.close();}
 });
 }catch(e){budget?.close();throw e;}
}
