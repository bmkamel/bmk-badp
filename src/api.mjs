// Identity must be supplied by a trusted server adapter, never by request headers directly.
export function createApi({identify, store}) {
 return async function handle(request) {
  const reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  const path=new URL(request.url).pathname;
  if(request.method==='GET' && path==='/health') return reply({service:'BADP',stage:'preview'});
  if(request.method!=='GET') return reply({error:'writes_disabled'},405);
  const match=/^\/api\/projects\/([a-zA-Z0-9_-]{1,128})\/jobs$/.exec(path);
  if(path!=='/api/projects' && !match) return reply({error:'not_found'},404);
  try {
   const actor=await identify(request);
   if(!actor || typeof actor.id!=='string' || !actor.id) return reply({error:'unauthenticated'},401);
   if(!match) return reply({projects:await store.projects(actor.id)});
   if(!await store.member(actor.id,match[1])) return reply({error:'not_found'},404);
   return reply({jobs:await store.jobs(actor.id,match[1])});
  } catch { return reply({error:'unavailable'},503); }
 };
}
