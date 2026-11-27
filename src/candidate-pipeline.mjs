import {createProposalRunner} from './proposal-runner.mjs';
import {readRepositoryContext} from './repository-context.mjs';
import {materializeProposal} from './git-proposal-apply.mjs';
// Operator-owned project mapping. No publication or generated-code execution.
export function createCandidatePipeline({projects,model}){
 if(typeof projects?.get!=='function'||typeof model?.generate!=='function')throw Error('invalid_dependencies');
 let active=false;
 return Object.freeze({async run({projectId,job,paths}){
  if(active)throw Error('candidate_busy');
  active=true;
  try{
   const record=await projects.get(projectId);
   if(!record||record.id!==projectId||record.repository!==job?.repository||record.proposalEnabled!==true||typeof record.cwd!=='string'||!record.cwd)throw Error('candidate_denied');
   const project=Object.freeze({...record});
   const runner=createProposalRunner({projects:{get:async()=>project},localModel:model,
    readContext:({baseSha,paths})=>readRepositoryContext({cwd:project.cwd,baseSha,paths})});
   const proposal=await runner.run({projectId,job,paths});
   const candidate=materializeProposal({cwd:project.cwd,project,job,proposal});
   return Object.freeze({projectId,repository:project.repository,baseSha:proposal.baseSha,headSha:candidate.headSha,proposalDigest:proposal.digest,evidence:candidate.evidence,stage:'candidate_review',published:false});
  }finally{active=false;}
 }});
}
