import {createHash} from 'node:crypto';
import {validateApproval} from './approvals.mjs';
import {validateRepositoryJob,validateRepositoryChanges} from './repository-policy.mjs';
const id=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(s);
const sha=s=>typeof s==='string'&&/^[a-f0-9]{40}$/.test(s);
// Inputs must come from trusted project registry, independent reviewer,
// verified CI service and approval store, not from the coding agent.
export function publicationDigest({projectId,job,review,ci}){
 const j=validateRepositoryJob(job);
 if(!id(projectId)||!review||review.baseSha!==j.baseSha||!sha(review.headSha)||review.headSha===j.baseSha)throw Error('invalid_review');
 const totals=validateRepositoryChanges(review.changes);
 if(review.files!==totals.files||review.bytes!==totals.bytes)throw Error('invalid_review');
 if(!ci||ci.repository!==j.repository||ci.headSha!==review.headSha||ci.conclusion!=='success'||typeof ci.runId!=='string'||!/^\d{1,24}$/.test(ci.runId))throw Error('ci_not_verified');
 const changes=review.changes.map(c=>[c.path,c.kind,c.bytes]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
 return createHash('sha256').update(JSON.stringify(['badp-publication-v1',projectId,j.repository,j.baseSha,j.branch,j.engine,j.goal,review.headSha,changes,ci.runId])).digest('hex');
}
export function authorizeDraftPublication({project,job,review,ci,request,approval,now}={}){
 try{
  if(!project||!id(project.id)||project.repository!==job?.repository||project.allowDraftPR!==true||project.sourceDisclosureApproved!==true)return {allowed:false,reason:'project_not_authorized'};
  const digest=publicationDigest({projectId:project.id,job,review,ci});
  if(!request||!id(request.id)||!id(request.actorId)||request.action!=='publish_draft_pr'||request.projectId!==project.id||request.digest!==digest||!id(approval?.actorId)||!validateApproval(request,approval,now))return {allowed:false,reason:'approval_required'};
  return Object.freeze({allowed:true,action:'publish_draft_pr',repository:job.repository,branch:job.branch,headSha:review.headSha,digest});
 }catch{return {allowed:false,reason:'invalid_evidence'};}
}
