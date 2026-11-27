import {validateRepositoryJob} from './repository-policy.mjs';
// This is an orchestration boundary, not an OS sandbox. Only an independently
// provisioned isolation backend may implement execute; there is no shell fallback.
export function createAgentExecution({backend,projects,review}={}){
 if(typeof backend?.execute!=='function'||typeof projects?.get!=='function'||typeof review!=='function')throw Error('invalid_execution_dependencies');
 let busy=false;
 return Object.freeze({
  async run({projectId,job}={}){
   if(typeof projectId!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(projectId))throw Error('invalid_project');
   const spec=validateRepositoryJob(job);
   if(busy)throw Error('agent_busy');
   busy=true;
   try{
    const project=await projects.get(projectId);
    if(!project||project.id!==projectId||project.repository!==spec.repository||project.agentExecutionEnabled!==true||!Array.isArray(project.allowedEngines)||!project.allowedEngines.includes(spec.engine))throw Error('execution_denied');
    // Backend must enforce these constraints outside the guest. A boolean
    // returned by an untrusted agent is not evidence of isolation.
    const result=await backend.execute(Object.freeze({projectId,...spec,policy:Object.freeze({
     network:'deny',credentials:'none',hostMounts:'none',publish:false,
     timeoutMs:600000,memoryMiB:4096,maxOutputBytes:300000
    })}));
    if(!result||typeof result.headSha!=='string'||!/^[a-f0-9]{40}$/.test(result.headSha)||result.headSha===spec.baseSha||typeof result.artifactId!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(result.artifactId))throw Error('invalid_execution_result');
    const evidence=await review({projectId,repository:spec.repository,baseSha:spec.baseSha,headSha:result.headSha,artifactId:result.artifactId});
    if(!evidence||evidence.baseSha!==spec.baseSha||evidence.headSha!==result.headSha)throw Error('review_mismatch');
    return Object.freeze({projectId,repository:spec.repository,branch:spec.branch,headSha:result.headSha,artifactId:result.artifactId,stage:'review',published:false,evidence});
   }finally{busy=false;}
  }
 });
}
