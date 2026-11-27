import {createFreeModelAdapter} from './model-adapter.mjs';

// Local-only adapter. No configurable remote URL, credentials, or cloud fallback.
const models=new Set(['qwen2.5-coder:1.5b','qwen2.5-coder:3b','qwen2.5-coder:7b']);
export function createOllamaAdapter({model='qwen2.5-coder:3b',fetcher=fetch,timeoutMs=180000}={}){
 if(!models.has(model)||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>600000)throw Error('invalid_local_configuration');
 return createFreeModelAdapter({provider:{id:model,enabled:true,costClass:'free',tasks:['plan','patch','repair']},invoke:async ({phase,prompt,context})=>{
  const system=phase==='plan'?'Return JSON only: {"plan":{"goal":"...","steps":[{"id":"1","kind":"inspect","description":"...","dependsOn":[]}]}}. Include inspect first, test, and preview last. Dependencies reference previous steps.':'Return JSON only: {"patches":[{"path":"app/index.html","content":"..."}]}. Return the complete static app. Include title and main. No scripts, external URLs, secrets or deployment.';
  const response=await fetcher('http://127.0.0.1:11434/api/chat',{method:'POST',redirect:'error',signal:AbortSignal.timeout(timeoutMs),headers:{'content-type':'application/json'},body:JSON.stringify({model,stream:false,format:'json',options:{num_ctx:4096,num_predict:2048,temperature:0},messages:[{role:'system',content:system},{role:'user',content:JSON.stringify({phase,prompt,context})}]})});
  if(!response.ok||!response.body)throw Error('local_model_unavailable');
  const reader=response.body.getReader();let size=0;const chunks=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>250000){await reader.cancel();throw Error('local_response_too_large');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(data.done!==true||typeof data.message?.content!=='string')throw Error('invalid_local_response');
  return data.message.content;
 }});
}
