const phases=new Set(['plan','patch','repair']);
const taskForPhase={plan:'plan',patch:'patch',repair:'repair'};
const bytes=value=>new TextEncoder().encode(value).length;

function safeObject(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_model_output');
 const serialized=JSON.stringify(value);
 if(!serialized||bytes(serialized)>200000)throw Error('invalid_model_output');
 return JSON.parse(serialized);
}

function parseOutput(raw){
 const candidate=raw&&typeof raw==='object'&&typeof raw.response==='string'?raw.response:raw;
 if(typeof candidate==='string'){
  if(bytes(candidate)>200000)throw Error('invalid_model_output');
  try{return safeObject(JSON.parse(candidate));}catch{throw Error('invalid_model_output');}
 }
 return safeObject(candidate);
}

// This adapter admits only an explicitly configured, free-cost provider. It has
// no default provider and never falls back to a paid model.
export function createFreeModelAdapter({provider,invoke}){
 if(!provider||typeof provider.id!=='string'||!provider.id||provider.enabled!==true||provider.costClass!=='free'||!Array.isArray(provider.tasks)||typeof invoke!=='function')throw Error('free_model_required');
 return Object.freeze({
  providerId:provider.id,
  async generate({phase,prompt,context={}}){
   if(!phases.has(phase)||!provider.tasks.includes(taskForPhase[phase]))throw Error('unsupported_model_task');
   if(typeof prompt!=='string'||!prompt.trim()||bytes(prompt)>4000)throw Error('invalid_prompt');
   let safeContext;
   try{safeContext=safeObject(context);}catch{throw Error('invalid_model_context');}
   if(bytes(JSON.stringify(safeContext))>120000)throw Error('invalid_model_context');
   return parseOutput(await invoke({provider:provider.id,phase,prompt:prompt.trim(),context:safeContext}));
  }
 });
}

// Cloudflare binding adapter. The Worker keeps this disabled until an operator
// explicitly configures a verified free-only model in its environment.
export function createCloudflareAiModelAdapter({ai,provider}){
 if(!ai||typeof ai.run!=='function')throw Error('ai_binding_required');
 return createFreeModelAdapter({provider,invoke:async request=>ai.run(request.provider,{
  messages:[
   {role:'system',content:'Return one JSON object only. Generate a conservative static web app plan or complete app/ patch set; do not request network, secrets, workflows, or deployment.'},
   {role:'user',content:JSON.stringify({phase:request.phase,prompt:request.prompt,context:request.context})}
  ]
 })});
}
