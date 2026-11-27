import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {openLocalStore} from '../src/local-sqlite.mjs';
import {createModelGateway} from '../src/model-gateway.mjs';
import {createOllamaAdapter} from '../src/ollama-adapter.mjs';
import {createDevelopmentRunner} from '../src/development-runner.mjs';
import {createStaticSandboxExecutor} from '../src/static-sandbox.mjs';
const [command,...args]=process.argv.slice(2);
let local;
try{
 if(!['enqueue','drain','status'].includes(command))throw Error('usage: enqueue <prompt> | drain | status <run-id>');
 const projectId='local-demo';
 mkdirSync('.badp-local',{recursive:true,mode:0o700});
 local=openLocalStore(join('.badp-local','state.sqlite'));
 local.ensureProject(projectId);
 const store=local.store;
 if(command==='enqueue'){
  const prompt=args.join(' ').trim();if(!prompt||prompt.length>4000)throw Error('invalid_prompt');
  const run=await store.createRun({id:crypto.randomUUID(),projectId,goal:prompt});
  console.log(JSON.stringify({id:run.id,stage:run.stage}));
 }else if(command==='status'){
  const run=await store.getRun(args[0],projectId);if(!run)throw Error('unknown_run');
  console.log(JSON.stringify({id:run.id,stage:run.stage,repairs:run.repairs,revision:run.revision}));
 }else{
  const model=createModelGateway({providers:[{id:'ollama',location:'local',enabled:true,costClass:'free',tasks:['plan','patch','repair'],adapter:createOllamaAdapter()}]});
  const runner=createDevelopmentRunner({model,executor:createStaticSandboxExecutor(),store});
  for(const run of local.pending(projectId)){
   try{console.log(JSON.stringify(await runner.resume(run)));}catch{console.error('Run deferred: '+run.id);process.exitCode=1;}
  }
 }
}catch{console.error('Local runner failed. Check command, dedicated database and local setup.');process.exitCode=1;}
finally{local?.close();}
