import {createHash} from 'node:crypto';
import {validateSourceProposal} from './source-proposal.mjs';
const digest=p=>createHash('sha256').update(JSON.stringify(p)).digest('hex');
// Trusted injected verifier is responsible for actual isolation; no shell here.
export function createSourceVerification({verify,requiredChecks=['syntax','tests','scope']}={}){
 if(typeof verify!=='function'||!Array.isArray(requiredChecks)||!requiredChecks.length||requiredChecks.some(x=>typeof x!=='string'||!x)||new Set(requiredChecks).size!==requiredChecks.length)throw Error('invalid_verifier');
 const checks=Object.freeze([...requiredChecks]);
 return Object.freeze({async run(input){
 const proposal=validateSourceProposal(input);
 const proposalDigest=digest(proposal);
 const result=await verify(Object.freeze({proposal,proposalDigest,requiredChecks:checks}));
 if(result?.proposalDigest!==proposalDigest||result?.baseCommit!==proposal.baseCommit||result?.isolated!==true||result?.networkDisabled!==true||result?.secretsAbsent!==true||!Array.isArray(result.checks))throw Error('unverified_execution');
 const seen=new Map();
 for(const c of result.checks){if(!c||typeof c.name!=='string'||seen.has(c.name)||typeof c.passed!=='boolean')throw Error('invalid_check');seen.set(c.name,c.passed);}
 if(checks.some(c=>!seen.has(c)))throw Error('missing_check');
 const passed=[...seen.values()].every(Boolean);
 return Object.freeze({proposalDigest,baseCommit:proposal.baseCommit,passed,status:passed?'review-required':'verification-failed',checks:Object.freeze([...seen].map(([name,passed])=>Object.freeze({name,passed})))});
 }});
}
