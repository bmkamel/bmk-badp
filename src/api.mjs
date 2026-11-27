// Identity must be supplied by a trusted server adapter, never by request headers directly.
async function readJsonBounded(request,limit){
 if(!request.body)throw Error('empty_body');
 const reader=request.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('body_too_large');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
export function createApi({identify, store, development=null, runs=null}) {
 return async function handle(request) {
  const reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  const path=new URL(request.url).pathname;
  if(request.method==='GET' && path==='/health') return reply({service:'BADP',stage:'preview'});
  const match=/^\/api\/projects\/([a-zA-Z0-9_-]{1,128})\/jobs$/.exec(path);
  const runMatch=/^\/api\/projects\/([a-zA-Z0-9_-]{1,128})\/runs$/.exec(path);
  const detail=/^\/api\/projects\/([a-zA-Z0-9_-]{1,128})\/runs\/([a-zA-Z0-9_-]{1,128})(\/preview)?$/.exec(path);
  if(path!=='/api/projects' && !match && !runMatch && !detail) return reply({error:'not_found'},404);
  try {
   const actor=await identify(request);
   if(!actor || typeof actor.id!=='string' || !actor.id) return reply({error:'unauthenticated'},401);
   if(request.method==='GET'&&detail){
    if(!runs||!await store.member(actor.id,detail[1]))return reply({error:'not_found'},404);
    const run=await runs.getRun(detail[2],detail[1]);
    if(!run)return reply({error:'not_found'},404);
    if(!detail[3])return reply({run:{id:run.id,projectId:run.projectId,stage:run.stage,repairs:run.repairs,revision:run.revision}});
    if(run.stage!=='review'&&run.stage!=='complete')return reply({error:'not_found'},404);
    const preview=await runs.latestArtifact(run.id,run.projectId,'preview');
    if(!preview||preview.kind!=='static-html'||typeof preview.html!=='string')return reply({error:'not_found'},404);
    return new Response(preview.html,{headers:{'content-type':'text/html; charset=utf-8','content-security-policy':"sandbox; default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'",'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
   }
   if(request.method==='POST'&&runMatch){
    if(!development)return reply({error:'writes_disabled'},405);
    if(typeof store.developer!=='function'||!await store.developer(actor.id,runMatch[1]))return reply({error:'not_found'},404);
    const size=Number(request.headers.get('content-length')||0);if(!Number.isSafeInteger(size)||size<0||size>5000)return reply({error:'invalid_request'},400);
    if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return reply({error:'invalid_request'},400);
    let body;try{body=await readJsonBounded(request,5000);}catch{return reply({error:'invalid_request'},400);}
    if(!body||typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>4000)return reply({error:'invalid_request'},400);
    const run=await development.start({id:crypto.randomUUID(),projectId:runMatch[1],actorId:actor.id,prompt:body.prompt});
    return reply({run},200);
   }
   if(request.method!=='GET') return reply({error:'writes_disabled'},405);
   if(!match) return runMatch||detail?reply({error:'not_found'},404):reply({projects:await store.projects(actor.id)});
   if(!await store.member(actor.id,match[1])) return reply({error:'not_found'},404);
   return reply({jobs:await store.jobs(actor.id,match[1])});
  } catch { return reply({error:'unavailable'},503); }
 };
}
