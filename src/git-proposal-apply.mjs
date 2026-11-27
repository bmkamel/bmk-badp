import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRepositoryProposal} from './repository-proposal.mjs';
import {reviewGitCommits} from './git-review.mjs';
// Trusted repository only. Writes Git objects but never updates a ref or checks out files.
export function materializeProposal({cwd,project,job,proposal}){
 const checked=createRepositoryProposal({project,job,patches:proposal?.patches});
 if(checked.digest!==proposal?.digest)throw Error('proposal_digest_mismatch');
 if(checked.patches.some(p=>p.kind!=='modify'))throw Error('modify_only');
 const dir=mkdtempSync(join(tmpdir(),'badp-index-'));
 const env={PATH:process.env.PATH??'',SystemRoot:process.env.SystemRoot??'',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',GIT_NO_REPLACE_OBJECTS:'1',GIT_TERMINAL_PROMPT:'0',GIT_INDEX_FILE:join(dir,'index'),GIT_AUTHOR_NAME:'BADP Proposal',GIT_AUTHOR_EMAIL:'badp@example.invalid',GIT_COMMITTER_NAME:'BADP Proposal',GIT_COMMITTER_EMAIL:'badp@example.invalid'};
 const git=(args,input)=>execFileSync('git',['-c','core.hooksPath=/dev/null','-c','commit.gpgSign=false','-C',cwd,...args],{env,input,timeout:15000,maxBuffer:2000000,stdio:['pipe','pipe','pipe']}).toString().trim();
 try{
  if(git(['cat-file','-t',checked.baseSha])!=='commit')throw Error('not_commit');
  git(['read-tree',checked.baseSha]);
  for(const p of checked.patches){
   const entry=git(['ls-tree',checked.baseSha,'--',p.path]);
   if(!/^100644 blob [a-f0-9]{40}\t/.test(entry)||entry.split('\t')[1]!==p.path)throw Error('unsafe_base_entry');
   const blob=git(['hash-object','-w','--stdin'],p.content);
   git(['update-index','--cacheinfo','100644',blob,p.path]);
  }
  const tree=git(['write-tree']);
  const headSha=git(['commit-tree',tree,'-p',checked.baseSha,'-m','BADP bounded proposal']);
  const evidence=reviewGitCommits({cwd,baseSha:checked.baseSha,headSha});
  if(evidence.changes.length!==checked.patches.length||evidence.changes.some(c=>!checked.patches.some(p=>p.path===c.path&&p.kind===c.kind&&p.bytes===c.bytes)))throw Error('materialization_mismatch');
  return Object.freeze({headSha,proposalDigest:checked.digest,evidence,published:false});
 }finally{rmSync(dir,{recursive:true,force:true});}
}
