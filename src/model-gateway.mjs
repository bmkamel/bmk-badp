// Policy metadata is trusted operator configuration, not model output.
// Remote providers remain unavailable until a durable, verified admission service exists.
const phases=new Set(['plan','patch','repair']);
const idOk=s=>typeof s==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(s);
export function createModelGateway({providers,admission=null}){
 if(!Array.isArray(providers)||providers.length===0)throw Error('invalid_providers');
 const ids=new Set();
 const registry=providers.map(p=>{
  if(!p||!idOk(p.id)||ids.has(p.id)||!['local','cloud'].includes(p.location)||!Array.isArray(p.tasks)||!p.tasks.every(t=>phases.has(t))||typeof p.adapter?.generate!=='function')throw Error('invalid_provider');
  ids.add(p.id);
  return Object.freeze({...p,tasks:Object.freeze([...p.tasks])});
 });
 let active=false;
 return Object.freeze({
  async generate(request){
   if(!request||!phases.has(request.phase)||typeof request.prompt!=='string'||!request.prompt.trim()||new TextEncoder().encode(request.prompt).length>4000)throw Error('invalid_request');
   if(active)throw Error('gateway_busy');
   active=true;
   try{
    for(const p of registry){
     if(p.enabled!==true||p.costClass!=='free'||!p.tasks.includes(request.phase))continue;
     if(p.location==='cloud'){
      // Explicit data classification and independently enforced free-only admission.
      if(request.dataClass!=='public'||p.verifiedFree!==true||typeof admission?.reserve!=='function')continue;
      const reservation=await admission.reserve({providerId:p.id,phase:request.phase});
      if(reservation?.allowed!==true)continue;
      // Reservation is consumed even on failure; never refund an ambiguous external call.
     }
     try{return await p.adapter.generate({phase:request.phase,prompt:request.prompt,context:request.context??{}});}
     catch{ /* next eligible provider; no paid fallback */ }
    }
    throw Error('no_eligible_model');
   }finally{active=false;}
  }
 });
}
