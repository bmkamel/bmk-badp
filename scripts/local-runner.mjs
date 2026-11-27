import {runScheduler,withLocalWorkerLock} from '../src/local-scheduler.mjs';
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
 if(!['enqueue','drain','status','watch'].includes(command))throw Error('usage: enqueue <prompt> | drain | watch | status <run-id>');
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
  const controller=new AbortController();
  const stop=()=>controller.abort();
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try{
   await withLocalWorkerLock(join('.badp-local','worker.sqlite'),()=>runScheduler({
    pending:()=>local.pending(projectId),resume:run=>runner.resume(run),
    once:command==='drain',signal:controller.signal,
    onResult:result=>console.log(JSON.stringify(result)),
    onError:()=>{console.error('Run deferred');if(command==='drain')process.exitCode=1;}
   }));
  }finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
 }
}catch{console.error('Local runner failed. Check command, dedicated database and local setup.');process.exitCode=1;}
finally{local?.close();}
