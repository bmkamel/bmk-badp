import {openLocalStore} from '../src/local-sqlite.mjs';
import {openHybridRuntime} from '../src/hybrid-runtime.mjs';
import {createHybridRunnerAdapter} from '../src/hybrid-runner-adapter.mjs';
import {createDevelopmentRunner} from '../src/development-runner.mjs';
import {createStaticSandboxExecutor} from '../src/static-sandbox.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
if(process.env.BADP_FREE_CONFIRMED!=='true'||!process.env.OPENROUTER_API_KEY)throw Error('demo_not_authorized');
const dir=mkdtempSync(join(tmpdir(),'badp-live-'));
let db,runtime;
try{
 const projectId='public-static-demo';
 db=openLocalStore(join(dir,'state.sqlite'));db.ensureProject(projectId);
 runtime=openHybridRuntime({database:join(dir,'budget.sqlite'),limits:{'openrouter-free':{verifiedFree:true,minuteRequests:2,dailyRequests:2,dailyUnits:16000}},openrouter:{apiKey:process.env.OPENROUTER_API_KEY},publicSourceApproved:true});
 const adapter=createHybridRunnerAdapter({runtime,publicProjects:[projectId]});
 const model={generate:request=>adapter.generate({...request,context:{projectId}})};
 const runner=createDevelopmentRunner({model,executor:createStaticSandboxExecutor(),store:db.store});
 const result=await runner.start({projectId,actorId:'cloud-demo',prompt:'Create a simple offline HTML page with a title and main heading Hello BADP. No scripts, links or external resources.'});
 console.log(JSON.stringify({stage:result.stage,repairs:result.repairs}));
 if(result.stage!=='review')process.exitCode=1;
}catch{console.error('live_demo_failed');process.exitCode=1;}
finally{runtime?.close();db?.close();rmSync(dir,{recursive:true,force:true});}
