import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRepositoryProposal} from '../src/repository-proposal.mjs';
import {materializeProposal} from '../src/git-proposal-apply.mjs';
test('materializes reviewed commit without touching refs or working tree',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'badp-apply-'));
 const git=(...args)=>execFileSync('git',['-C',cwd,...args],{stdio:['ignore','pipe','pipe']}).toString().trim();
 try{
 git('init','-q');git('config','user.name','Test');git('config','user.email','test@example.invalid');git('config','commit.gpgsign','false');
 mkdirSync(join(cwd,'docs'));writeFileSync(join(cwd,'docs','a.md'),'old');git('add','.');git('commit','-qm','base');
 const baseSha=git('rev-parse','HEAD');
 const project={id:'p',repository:'owner/repo',proposalEnabled:true};
 const job={repository:project.repository,baseSha,branch:'dev/badp-task',engine:'aider',goal:'Improve docs'};
 const proposal=createRepositoryProposal({project,job,patches:[{path:'docs/a.md',kind:'modify',content:'new'}]});
 assert.throws(()=>materializeProposal({cwd,project,job,proposal:{...proposal,digest:'bad'}}),/proposal_digest_mismatch/);
 const result=materializeProposal({cwd,project,job,proposal});
 assert.equal(git('rev-parse','HEAD'),baseSha);
 assert.equal(git('status','--porcelain'),'');
 assert.equal(readFileSync(join(cwd,'docs','a.md'),'utf8'),'old');
 assert.equal(git('show',result.headSha+':docs/a.md'),'new');
 assert.equal(result.evidence.files,1);assert.equal(result.published,false);
 }finally{rmSync(cwd,{recursive:true,force:true});}
});
