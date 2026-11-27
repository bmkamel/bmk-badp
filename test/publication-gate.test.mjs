import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicationDigest,authorizeDraftPublication} from '../src/publication-gate.mjs';
function fixture(){
 const project={id:'p',repository:'owner/repo',allowDraftPR:true,sourceDisclosureApproved:true};
 const job={repository:project.repository,baseSha:'a'.repeat(40),branch:'dev/badp-task-1',engine:'aider',goal:'Add test'};
 const review={baseSha:job.baseSha,headSha:'b'.repeat(40),files:1,bytes:20,changes:[{path:'src/a.js',kind:'modify',bytes:20}]};
 const ci={repository:job.repository,headSha:review.headSha,conclusion:'success',runId:'123'};
 const digest=publicationDigest({projectId:project.id,job,review,ci});
 const request={id:'req',projectId:project.id,actorId:'author',action:'publish_draft_pr',digest};
 const approval={requestId:request.id,projectId:project.id,digest,actorId:'reviewer',authorized:true,decision:'approve',expiresAt:200};
 return {project,job,review,ci,request,approval,now:100};
}
test('permits only a draft PR bound to reviewed head and CI',()=>{
 const f=fixture();const r=authorizeDraftPublication(f);assert.equal(r.allowed,true);assert.equal(r.action,'publish_draft_pr');assert.equal(r.headSha,f.review.headSha);
});
test('denies cross-project, expired, self-approved and unapproved disclosure',()=>{
 const f=fixture();
 for(const patch of [{project:{...f.project,id:'other'}},{project:{...f.project,sourceDisclosureApproved:false}},{now:200},{approval:{...f.approval,actorId:'author'}},{approval:{...f.approval,authorized:false}},{request:{...f.request,action:'merge'}}])assert.equal(authorizeDraftPublication({...f,...patch}).allowed,false);
});
test('denies failed CI, different commit, altered goal and altered diff',()=>{
 const f=fixture();
 for(const patch of [{ci:{...f.ci,conclusion:'failure'}},{ci:{...f.ci,headSha:'c'.repeat(40)}},{ci:{...f.ci,runId:'124'}},{job:{...f.job,goal:'Different'}},{review:{...f.review,changes:[{path:'src/b.js',kind:'modify',bytes:20}]}},{review:{...f.review,bytes:21}}])assert.equal(authorizeDraftPublication({...f,...patch}).allowed,false);
});
test('denies missing evidence',()=>{assert.equal(authorizeDraftPublication().allowed,false);});
