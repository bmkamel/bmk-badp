import {createHash} from 'node:crypto';
import {validateRepositoryJob,validateRepositoryChanges} from './repository-policy.mjs';
const byteLength=s=>Buffer.byteLength(s,'utf8');
// Creates a reviewable artifact only. No filesystem, shell, network or Git writes.
export function createRepositoryProposal({project,job,patches}={}){
 const spec=validateRepositoryJob(job);
 if(!project||typeof project.id!=='string'||! /^[a-zA-Z0-9_-]{1,128}$/.test(project.id)||project.repository!==spec.repository||project.proposalEnabled!==true)throw Error('proposal_denied');
 if(!Array.isArray(patches)||patches.length<1||patches.length>25)throw Error('invalid_patches');
 const entries=patches.map(p=>{
  if(!p||typeof p.content!=='string'||p.content.includes('\0')||Buffer.from(p.content,'utf8').toString('utf8')!==p.content)throw Error('invalid_content');
  const bytes=byteLength(p.content);
  if(bytes>100000)throw Error('invalid_content');
  if(/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:ghp_|github_pat_|sk-proj-)[A-Za-z0-9_-]{16,}/.test(p.content))throw Error('possible_secret');
  return {path:p.path,kind:p.kind,bytes,content:p.content};
 });
 const totals=validateRepositoryChanges(entries);
 entries.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const digest=createHash('sha256').update(JSON.stringify(['badp-proposal-v1',project.id,spec.repository,spec.baseSha,spec.branch,spec.engine,spec.goal,entries])).digest('hex');
 return Object.freeze({projectId:project.id,repository:spec.repository,baseSha:spec.baseSha,branch:spec.branch,engine:spec.engine,stage:'proposal_review',published:false,digest,...totals,patches:Object.freeze(entries.map(p=>Object.freeze(p)))});
}
