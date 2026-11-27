import {execFileSync} from 'node:child_process';
import {validateRepositoryChanges} from './repository-policy.mjs';
const sha=/^[a-f0-9]{40}$/;
const decoder=new TextDecoder('utf-8',{fatal:true});
export function reviewGitCommits({cwd,baseSha,headSha}){
 if(typeof cwd!=='string'||!sha.test(baseSha)||!sha.test(headSha)||baseSha===headSha)throw Error('invalid_review');
 // Run only on an operator-provisioned trusted Git repository, never an agent-selected cwd.
 const env={PATH:process.env.PATH??'',SystemRoot:process.env.SystemRoot??'',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',GIT_NO_REPLACE_OBJECTS:'1',GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0'};
 const git=(...args)=>execFileSync('git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-C',cwd,...args],{env,timeout:15000,maxBuffer:2_000_000,stdio:['ignore','pipe','pipe']});
 for(const id of [baseSha,headSha])if(decoder.decode(git('cat-file','-t',id)).trim()!=='commit')throw Error('not_commit');
 git('merge-base','--is-ancestor',baseSha,headSha);
 const raw=decoder.decode(git('diff-tree','-r','--no-commit-id','--no-renames','--raw','--no-abbrev','-z',baseSha,headSha,'--'));
 const fields=raw.split('\0');if(fields.pop()!=='')throw Error('invalid_diff');
 if(fields.length%2!==0||fields.length>50)throw Error('invalid_diff');
 const changes=[];
 for(let i=0;i<fields.length;i+=2){
  const m=/^:([0-7]{6}) ([0-7]{6}) ([a-f0-9]{40}) ([a-f0-9]{40}) ([AM])$/.exec(fields[i]);
  if(!m||m[2]!=='100644'||(m[5]==='M'&&m[1]!=='100644')||(m[5]==='A'&&m[1]!=='000000'))throw Error('unsafe_git_mode_or_status');
  const bytes=Number(decoder.decode(git('cat-file','-s',m[4])).trim());
  const change={path:fields[i+1],kind:m[5]==='A'?'add':'modify',bytes};
  validateRepositoryChanges([change]);
  const body=git('cat-file','blob',m[4]);
  if(body.length!==bytes||body.includes(0))throw Error('binary_or_size_mismatch');
  const content=decoder.decode(body);
  if(/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:ghp_|github_pat_|sk-proj-)[A-Za-z0-9_-]{16,}/.test(content))throw Error('possible_secret');
  changes.push(change);
 }
 return Object.freeze({baseSha,headSha,...validateRepositoryChanges(changes),changes});
}
