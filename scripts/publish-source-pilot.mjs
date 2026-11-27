import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {validateSourceProposal} from '../src/source-proposal.mjs';
import {createReviewEnvelope} from '../src/review-envelope.mjs';
const path='src/pilot-format.mjs';
const base=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const old=readFileSync(path,'utf8');
const {proposal,evidence}=JSON.parse(readFileSync(process.env.BADP_PILOT_OUTPUT,'utf8'));
const validated=validateSourceProposal({baseCommit:base,snapshot:new Map([[path,old]]),allowedPaths:[path],changes:proposal.files});
createReviewEnvelope({proposal:validated,evidence,projectId:'badp-source-pilot',currentBase:base});
const token=process.env.GH_TOKEN,repo=process.env.GITHUB_REPOSITORY;
if(!token||repo!=='bmkamel/bmk-badp'||!/^\d+$/.test(process.env.GITHUB_RUN_ID??''))throw Error('invalid_publish_scope');
async function api(endpoint,method='GET',body){
 const res=await fetch('https://api.github.com/repos/'+repo+endpoint,{method,redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!res.ok)throw Error('github_publish_http_'+res.status);
 return res.json();
}
if((await api('/git/ref/heads/main')).object.sha!==base)throw Error('stale_base');
const branch='badp/pilot-'+process.env.GITHUB_RUN_ID;
await api('/git/refs','POST',{ref:'refs/heads/'+branch,sha:base});
const file=await api('/contents/'+path+'?ref='+encodeURIComponent(branch));
await api('/contents/'+path,'PUT',{message:'BADP: normalize pilot labels',content:Buffer.from(validated.files[0].content).toString('base64'),sha:file.sha,branch});
const pr=await api('/pulls','POST',{title:'BADP verified source pilot',head:branch,base:'main',body:'Isolated pilot checks passed. Review digest: '+evidence.proposalDigest,draft:false});
console.log('source_pilot_pr:'+pr.number);
