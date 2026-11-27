import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readRepositoryContext} from '../src/repository-context.mjs';
test('reads immutable committed text instead of working tree and rejects protected paths',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'badp-context-'));
 const git=(...args)=>execFileSync('git',['-C',cwd,...args],{stdio:['ignore','pipe','pipe']}).toString().trim();
 try{
 git('init','-q');git('config','user.name','Test');git('config','user.email','test@example.invalid');git('config','commit.gpgsign','false');
 mkdirSync(join(cwd,'docs'));writeFileSync(join(cwd,'docs','a.md'),'old');git('add','.');git('commit','-qm','base');const baseSha=git('rev-parse','HEAD');
 writeFileSync(join(cwd,'docs','a.md'),'new');
 assert.equal(readRepositoryContext({cwd,baseSha,paths:['docs/a.md']}).files[0].content,'old');
 assert.throws(()=>readRepositoryContext({cwd,baseSha,paths:['docs/missing.md']}),/unsafe_context_entry/);
 assert.throws(()=>readRepositoryContext({cwd,baseSha,paths:['.git/config']}),/protected_path/);
 }finally{rmSync(cwd,{recursive:true,force:true});}
});
