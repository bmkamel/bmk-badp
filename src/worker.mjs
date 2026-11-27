import {createApi} from './api.mjs';
import {d1Store} from './d1-store.mjs';
import {d1RunStore} from './d1-run-store.mjs';
import {createDevelopmentRunner} from './development-runner.mjs';
import {accessIdentity} from './identity.mjs';
import {createCloudflareAiModelAdapter} from './model-adapter.mjs';
import {createStaticSandboxExecutor} from './static-sandbox.mjs';
function configuredDevelopment(env){
 if(!env.DB||!env.AI||env.ENABLE_DEVELOPMENT_RUNS!=='true'||env.FREE_MODEL_COST_CLASS!=='free'||typeof env.FREE_MODEL_ID!=='string'||!env.FREE_MODEL_ID)return null;
 try{return createDevelopmentRunner({model:createCloudflareAiModelAdapter({ai:env.AI,provider:{id:env.FREE_MODEL_ID,enabled:true,costClass:'free',tasks:['plan','patch','repair']}}),executor:createStaticSandboxExecutor(),store:d1RunStore(env.DB)});}catch{return null;}
}
export default {async fetch(request,env={}) {
 const path=new URL(request.url).pathname;
 if(env.DB && env.ACCESS_ISSUER && env.ACCESS_AUDIENCE && path.startsWith('/api/')) return createApi({identify:accessIdentity({issuer:env.ACCESS_ISSUER,audience:env.ACCESS_AUDIENCE,db:env.DB}),store:d1Store(env.DB),development:configuredDevelopment(env)})(request);
 if(request.method==='GET'&&path==='/health')return Response.json({service:'BADP',stage:'preview'},{headers:{'cache-control':'no-store'}});
 return Response.json({error:'not_available'},{status:404,headers:{'cache-control':'no-store'}});
}};
