import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {reviewGitCommits} from '../src/git-review.mjs';
function fixture(fn){
 const cwd=mkdtempSync(join(tmpdir(),'badp-git-'));
 const git=(...args)=>execFileSync('git',['-C',cwd,...args],{stdio:['ignore','pipe','pipe']}).toString().trim();
 try{
 git('init','-q');git('config','user.name','Test');git('config','user.email','test@example.invalid');git('config','commit.gpgsign','false');
 mkdirSync(join(cwd,'src'));writeFileSync(join(cwd,'src','a.js'),'export const a=1;');git('add','.');git('commit','-qm','base');
 const baseSha=git('rev-parse','HEAD');
 const commit=()=>{git('add','-A');git('commit','-qm','change');return git('rev-parse','HEAD');};
 return fn({cwd,baseSha,commit,git});
 }finally{rmSync(cwd,{recursive:true,force:true});}
}
test('measures actual immutable Git diff',()=>fixture(({cwd,baseSha,commit})=>{
 writeFileSync(join(cwd,'src','a.js'),'export const a=2;');
 const headSha=commit();const result=reviewGitCommits({cwd,baseSha,headSha});
 assert.equal(result.files,1);assert.equal(result.bytes,17);assert.equal(result.changes[0].path,'src/a.js');
}));
test('rejects protected files and deletions',()=>{
 fixture(({cwd,baseSha,commit})=>{writeFileSync(join(cwd,'package.json'),'{}');assert.throws(()=>reviewGitCommits({cwd,baseSha,headSha:commit()}),/protected_path/);});
 fixture(({cwd,baseSha,commit})=>{rmSync(join(cwd,'src','a.js'));assert.throws(()=>reviewGitCommits({cwd,baseSha,headSha:commit()}),/unsafe_git_mode_or_status/);});
});
test('rejects binary content and possible private keys',()=>{
 fixture(({cwd,baseSha,commit})=>{writeFileSync(join(cwd,'src','a.js'),Buffer.from([0,1]));assert.throws(()=>reviewGitCommits({cwd,baseSha,headSha:commit()}),/binary_or_size_mismatch/);});
 fixture(({cwd,baseSha,commit})=>{writeFileSync(join(cwd,'src','a.js'),'-----BEGIN PRIVATE KEY-----');assert.throws(()=>reviewGitCommits({cwd,baseSha,headSha:commit()}),/possible_secret/);});
});
