// Explicit zero-price router, no paid fallback. Requires trusted admission and
// public-source approval. An API key is supplied only by the operator at runtime.
export function createOpenRouterFreeTransport({apiKey,admission,publicSourceApproved=false,fetcher=fetch}={}){
 if(typeof apiKey!=='string'||!apiKey.trim()||typeof admission?.reserve!=='function'||publicSourceApproved!==true)throw Error('cloud_not_authorized');
 let busy=false;
 return async ({messages})=>{
  if(busy)throw Error('cloud_busy');
  if(!Array.isArray(messages)||messages.length!==2||messages[0]?.role!=='system'||messages[1]?.role!=='user'||messages.some(m=>typeof m.content!=='string')||Buffer.byteLength(JSON.stringify(messages))>100000)throw Error('invalid_messages');
  if(/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:ghp_|github_pat_|sk-proj-|sk-or-v1-)[A-Za-z0-9_-]{16,}/.test(JSON.stringify(messages)))throw Error('possible_secret');
  busy=true;
  try{
   const permit=await admission.reserve({providerId:'openrouter-free',phase:'patch'});
   if(permit?.allowed!==true)throw Error('cloud_quota_denied');
   const r=await fetcher('https://openrouter.ai/api/v1/chat/completions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(90000),headers:{authorization:'Bearer '+apiKey,'content-type':'application/json'},body:JSON.stringify({model:'openrouter/free',messages:messages.map(m=>({role:m.role,content:m.content})),max_tokens:2048,temperature:0,stream:false,provider:{max_price:{prompt:0,completion:0,request:0},data_collection:'deny'}})});
   if(!r.ok||!r.body)throw Error('cloud_unavailable');
   const reader=r.body.getReader();let length=0;const chunks=[];
   try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>400000){await reader.cancel();throw Error('cloud_response_limit');}chunks.push(value);}}finally{reader.releaseLock();}
   const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
   if(data.usage?.cost!==0||data.choices?.[0]?.finish_reason!=='stop'||typeof data.choices[0].message?.content!=='string')throw Error('cloud_response_unverified');
   return data.choices[0].message.content;
  }finally{busy=false;}
 };
}
