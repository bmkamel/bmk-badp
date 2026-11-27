// Identity must be supplied by a trusted server adapter, never by request headers directly.
export function createApi({identify, store, development=null}) {
 return async function handle(request) {
  const reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  const path=new URL(request.url).pathname;
  if(request.method==='GET' && path==='/health') return reply({service:'BADP',stage:'preview'});
  const match=/^\/api\/projects\/([a-zA-Z0-9_-]{1,128})\/jobs$/.exec(path);
  const runMatch=/^\/api\/projects\/([a-zA-Z0-9_-]{1,128})\/runs$/.exec(path);
  if(path!=='/api/projects' && !match && !runMatch) return reply({error:'not_found'},404);
  try {
   const actor=await identify(request);
   if(!actor || typeof actor.id!=='string' || !actor.id) return reply({error:'unauthenticated'},401);
   if(request.method==='POST'&&runMatch){
    if(!development)return reply({error:'writes_disabled'},405);
    if(typeof store.developer!=='function'||!await store.developer(actor.id,runMatch[1]))return reply({error:'not_found'},404);
    const size=Number(request.headers.get('content-length')||0);if(!Number.isSafeInteger(size)||size<0||size>5000)return reply({error:'invalid_request'},400);
    let body;try{body=await request.json();}catch{return reply({error:'invalid_request'},400);}
    if(!body||typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>4000)return reply({error:'invalid_request'},400);
    const run=await development.start({id:crypto.randomUUID(),projectId:runMatch[1],actorId:actor.id,prompt:body.prompt});
    return reply({run},202);
   }
   if(request.method!=='GET') return reply({error:'writes_disabled'},405);
   if(!match) return reply({projects:await store.projects(actor.id)});
   if(!await store.member(actor.id,match[1])) return reply({error:'not_found'},404);
   return reply({jobs:await store.jobs(actor.id,match[1])});
  } catch { return reply({error:'unavailable'},503); }
 };
}
