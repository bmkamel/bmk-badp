import {createApi} from './api.mjs';
import {d1Store} from './d1-store.mjs';
import {accessIdentity} from './identity.mjs';
export default {async fetch(request,env={}) {
 const path=new URL(request.url).pathname;
 if(env.DB && env.ACCESS_ISSUER && env.ACCESS_AUDIENCE && path.startsWith('/api/')) return createApi({identify:accessIdentity({issuer:env.ACCESS_ISSUER,audience:env.ACCESS_AUDIENCE,db:env.DB}),store:d1Store(env.DB)})(request);
 if(request.method==='GET'&&path==='/health')return Response.json({service:'BADP',stage:'preview'},{headers:{'cache-control':'no-store'}});
 return Response.json({error:'not_available'},{status:404,headers:{'cache-control':'no-store'}});
}};
