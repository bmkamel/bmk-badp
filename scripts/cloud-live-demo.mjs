import {openLocalStore} from '../src/local-sqlite.mjs';
import {openHybridRuntime} from '../src/hybrid-runtime.mjs';
import {createHybridRunnerAdapter} from '../src/hybrid-runner-adapter.mjs';
import {createDevelopmentRunner} from '../src/development-runner.mjs';
import {createStaticSandboxExecutor} from '../src/static-sandbox.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const provider=process.env.BADP_DEMO_PROVIDER??'openrouter';
if(!['groq','openrouter','hybrid'].includes(provider))throw Error('invalid_provider');
const useGroq=provider!=='openrouter',useRouter=provider!=='groq';
if(useGroq&&process.env.BADP_GROQ_FREE_VERIFIED!=='true')throw Error('groq_free_plan_not_verified');
if(process.env.BADP_FREE_CONFIRMED!=='true'||(useGroq&&!process.env.GROQ_API_KEY)||(useRouter&&!process.env.OPENROUTER_API_KEY))throw Error('demo_not_authorized');
const dir=mkdtempSync(join(tmpdir(),'badp-live-'));
let db,runtime;
try{
 const projectId='public-static-demo';
 db=openLocalStore(join(dir,'state.sqlite'));db.ensureProject(projectId);
 runtime=openHybridRuntime({database:join(dir,'budget.sqlite'),limits:Object.fromEntries([...(useGroq?['groq']:[]),...(useRouter?['openrouter-free']:[])].map(id=>[id,{verifiedFree:true,minuteRequests:2,dailyRequests:2,dailyUnits:16000}])),...(useGroq?{groq:{apiKey:process.env.GROQ_API_KEY,model:'openai/gpt-oss-20b',freePlanVerified:true}}:{}),...(useRouter?{openrouter:{apiKey:process.env.OPENROUTER_API_KEY}}:{}),publicSourceApproved:true});
 const adapter=createHybridRunnerAdapter({runtime,publicProjects:[projectId]});
 const model={async generate(request){
 console.log('phase_started:'+request.phase);
 try{const output=await adapter.generate({...request,context:{projectId}});console.log('phase_validated:'+request.phase);return output;}
 catch(e){const allowed=['no_eligible_model','invalid_plan','invalid_patches','missing_entrypoint','response_limit'];console.error('phase_failed:'+request.phase+':'+(e instanceof SyntaxError?'invalid_json':allowed.includes(e.message)?e.message:'unknown'));throw e;}
 }};
 const runner=createDevelopmentRunner({model,executor:createStaticSandboxExecutor(),store:db.store});
 const result=await runner.start({projectId,actorId:'cloud-demo',prompt:'Create a simple offline HTML page with a title and main heading Hello BADP. No scripts, links or external resources.'});
 console.log(JSON.stringify({stage:result.stage,repairs:result.repairs}));
 if(result.stage!=='review')process.exitCode=1;
}catch{console.error('live_demo_failed');process.exitCode=1;}
finally{runtime?.close();db?.close();rmSync(dir,{recursive:true,force:true});}
