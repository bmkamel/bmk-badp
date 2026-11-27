import {createOllamaAdapter} from '../src/ollama-adapter.mjs';
import {createDevelopmentRunner} from '../src/development-runner.mjs';
import {createMemoryRunStore} from '../src/run-store.mjs';
import {createStaticSandboxExecutor} from '../src/static-sandbox.mjs';
const prompt=process.argv.slice(2).join(' ').trim();
if(!prompt){console.error('Usage: node scripts/local-demo.mjs "Create an offline static page"');process.exitCode=2;}
else {
 try{
 const store=createMemoryRunStore();
 const runner=createDevelopmentRunner({model:createOllamaAdapter(),executor:createStaticSandboxExecutor(),store});
 const run=await runner.start({projectId:'local-demo',actorId:'local-operator',prompt});
 console.log(JSON.stringify({run,events:await store.eventsFor(run.id)},null,2));
 if(run.stage!=='review')process.exitCode=1;
 }catch{console.error('Local demo failed; verify Ollama and model availability.');process.exitCode=1;}
}
