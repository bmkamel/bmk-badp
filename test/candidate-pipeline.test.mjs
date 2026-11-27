import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCandidatePipeline} from '../src/candidate-pipeline.mjs';
test('integrated immutable snapshot, model proposal, Git candidate and independent review',async()=>{
 const cwd=mkdtempSync(join(tmpdir(),'badp-candidate-'));
 const git=(...args)=>execFileSync('git',['-C',cwd,...args],{stdio:['ignore','pipe','pipe']}).toString().trim();
 try{
 git('init','-q');git('config','user.name','Test');git('config','user.email','test@example.invalid');git('config','commit.gpgsign','false');
 mkdirSync(join(cwd,'docs'));writeFileSync(join(cwd,'docs','a.md'),'old');git('add','.');git('commit','-qm','base');
 const baseSha=git('rev-parse','HEAD'),project={id:'p',repository:'owner/repo',proposalEnabled:true,cwd};
 const job={repository:project.repository,baseSha,branch:'dev/badp-task',engine:'aider',goal:'Improve docs'};
 const pipeline=createCandidatePipeline({projects:{get:async()=>project},model:{generate:async r=>{
 assert.equal(r.context.files[0].content,'old');
 return {patches:[{path:'docs/a.md',kind:'modify',content:'new'}]};
 }}});
 const result=await pipeline.run({projectId:'p',job,paths:['docs/a.md']});
 assert.equal(result.stage,'candidate_review');assert.equal(result.published,false);assert.equal(result.evidence.files,1);
 assert.equal(git('rev-parse','HEAD'),baseSha);assert.equal(git('status','--porcelain'),'');
 assert.equal(git('show',result.headSha+':docs/a.md'),'new');
 await assert.rejects(pipeline.run({projectId:'other',job,paths:['docs/a.md']}),/candidate_denied/);
 }finally{rmSync(cwd,{recursive:true,force:true});}
});
