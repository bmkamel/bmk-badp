import {createHash} from 'node:crypto';
const digest=p=>createHash('sha256').update(JSON.stringify(p)).digest('hex');
// Trusted caller supplies verifier output, never model-supplied evidence.
export function createReviewEnvelope({proposal,evidence,projectId,currentBase}={}){
 if(typeof projectId!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(projectId)||!proposal||proposal.status!=='proposal-only'||!Array.isArray(proposal.files)||!proposal.files.length||! /^[a-f0-9]{40}$/.test(currentBase??'')||proposal.baseCommit!==currentBase)throw Error('invalid_review_scope');
 if(evidence?.passed!==true||evidence.status!=='review-required'||evidence.baseCommit!==currentBase||evidence.proposalDigest!==digest(proposal)||!Array.isArray(evidence.checks))throw Error('invalid_review_evidence');
 const checks=new Map();
 for(const c of evidence.checks){if(typeof c?.name!=='string'||checks.has(c.name)||c.passed!==true)throw Error('invalid_review_check');checks.set(c.name,true);}
 if(['syntax','tests','scope'].some(c=>!checks.has(c)))throw Error('missing_review_check');
 return Object.freeze({projectId,baseCommit:currentBase,proposalDigest:evidence.proposalDigest,status:'human-review-required',paths:Object.freeze(proposal.files.map(f=>f.path)),checks:Object.freeze([...checks.keys()])});
}
