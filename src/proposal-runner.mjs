import {validateRepositoryJob} from './repository-policy.mjs';
import {createRepositoryProposal} from './repository-proposal.mjs';
// Trusted registry and snapshot reader are required. No remote model or shell fallback.
export function createProposalRunner({projects,readContext,localModel}){
 if(typeof projects?.get!=='function'||typeof readContext!=='function'||typeof localModel?.generate!=='function')throw Error('invalid_dependencies');
 let active=false;
 return Object.freeze({async run({projectId,job,paths}){
  const spec=validateRepositoryJob(job);
  if(active)throw Error('proposal_busy');
  active=true;
  try{
   const project=await projects.get(projectId);
   if(!project||project.id!==projectId||project.repository!==spec.repository||project.proposalEnabled!==true)throw Error('proposal_denied');
   const snapshot=await readContext({projectId,repository:spec.repository,baseSha:spec.baseSha,paths});
   if(snapshot?.baseSha!==spec.baseSha||!Array.isArray(snapshot.files)||snapshot.files.length!==paths.length||snapshot.files.some((f,i)=>f.path!==paths[i]||typeof f.content!=='string'))throw Error('snapshot_mismatch');
   // Local model must be independently configured; source files are untrusted data.
   const output=await localModel.generate({phase:'patch',prompt:spec.goal,context:{kind:'repository-proposal',baseSha:spec.baseSha,files:snapshot.files}});
   const proposal=createRepositoryProposal({project,job:spec,patches:output?.patches});
   // Initial scope: only modify files explicitly read from the immutable base.
   if(proposal.patches.some(p=>p.kind!=='modify'||!paths.includes(p.path)))throw Error('outside_snapshot');
   return proposal;
  }finally{active=false;}
 }});
}
