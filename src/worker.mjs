import {createApi} from './api.mjs';
import {d1Store} from './d1-store.mjs';
import {d1RunStore} from './d1-run-store.mjs';
import {accessIdentity} from './identity.mjs';
// Inference remains disabled until the account's free plan and cost controls
// have been independently verified; an environment label cannot enforce cost.
export default {async fetch(request,env={}) {
 const path=new URL(request.url).pathname;
 if(env.DB && env.ACCESS_ISSUER && env.ACCESS_AUDIENCE && path.startsWith('/api/')) return createApi({identify:accessIdentity({issuer:env.ACCESS_ISSUER,audience:env.ACCESS_AUDIENCE,db:env.DB}),store:d1Store(env.DB),runs:d1RunStore(env.DB)})(request);
 if(request.method==='GET'&&path==='/health')return Response.json({service:'BADP',stage:'preview'},{headers:{'cache-control':'no-store'}});
 return Response.json({error:'not_available'},{status:404,headers:{'cache-control':'no-store'}});
}};
