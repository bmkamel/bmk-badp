// Free-plan eligibility is an operator-verified prerequisite, not inferred from API success.
const models=new Set(['openai/gpt-oss-120b','openai/gpt-oss-20b']);
export function createGroqTransport({apiKey,model='openai/gpt-oss-120b',admission,freePlanVerified=false,publicSourceApproved=false,fetcher=fetch}={}){
 if(typeof apiKey!=='string'||!apiKey.trim()||!models.has(model)||freePlanVerified!==true||publicSourceApproved!==true||typeof admission?.reserve!=='function')throw Error('groq_not_authorized');
 let busy=false;
 return async ({messages,jsonOutput=false}={})=>{
  if(busy)throw Error('groq_busy');
  if(!Array.isArray(messages)||messages.length!==2||messages[0]?.role!=='system'||messages[1]?.role!=='user'||messages.some(m=>typeof m.content!=='string')||Buffer.byteLength(JSON.stringify(messages))>16000)throw Error('invalid_messages');
  if(/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:gsk_|ghp_|github_pat_|sk-proj-|sk-or-v1-)[A-Za-z0-9_-]{16,}/.test(JSON.stringify(messages)))throw Error('possible_secret');
  busy=true;
  try{
   const permit=await admission.reserve({providerId:'groq',model,phase:'patch',maxCompletionTokens:2048,inputBytes:Buffer.byteLength(JSON.stringify(messages))});
   if(permit?.allowed!==true)throw Error('groq_quota_denied');
   const r=await fetcher('https://api.groq.com/openai/v1/chat/completions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(90000),headers:{authorization:'Bearer '+apiKey,'content-type':'application/json'},body:JSON.stringify({model,messages:messages.map(m=>({role:m.role,content:m.content})),max_completion_tokens:2048,temperature:0,stream:false,...(jsonOutput===true?{response_format:{type:'json_object'},reasoning_effort:'low',reasoning_format:'hidden'}:{})})});
   if(r.status===429)throw Error('groq_rate_limit');
   if(!r.ok||!r.body)throw Error('groq_unavailable');
   const reader=r.body.getReader();let length=0;const chunks=[];
   try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>350000){await reader.cancel();throw Error('groq_response_limit');}chunks.push(value);}}finally{reader.releaseLock();}
   const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
   if(data.choices?.[0]?.finish_reason!=='stop'||typeof data.choices[0].message?.content!=='string')throw Error('invalid_groq_response');
   return data.choices[0].message.content;
  }finally{busy=false;}
 };
}
