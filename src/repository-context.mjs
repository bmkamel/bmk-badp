import {execFileSync} from 'node:child_process';
import {validateRepositoryChanges} from './repository-policy.mjs';
const decoder=new TextDecoder('utf-8',{fatal:true});
// cwd must be provisioned by the operator, not selected by the model.
export function readRepositoryContext({cwd,baseSha,paths}){
 if(typeof cwd!=='string'||typeof baseSha!=='string'||!/^[a-f0-9]{40}$/.test(baseSha)||!Array.isArray(paths)||paths.length<1||paths.length>12)throw Error('invalid_context');
 validateRepositoryChanges(paths.map(path=>({path,kind:'modify',bytes:0})));
 const env={PATH:process.env.PATH??'',SystemRoot:process.env.SystemRoot??'',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',GIT_NO_REPLACE_OBJECTS:'1',GIT_TERMINAL_PROMPT:'0'};
 const git=(...args)=>execFileSync('git',['-C',cwd,...args],{env,timeout:15000,maxBuffer:200000,stdio:['ignore','pipe','pipe']});
 if(decoder.decode(git('cat-file','-t',baseSha)).trim()!=='commit')throw Error('not_commit');
 let total=0;const files=[];
 for(const path of paths){
  const entry=decoder.decode(git('ls-tree','-z',baseSha,'--',path));
  const match=/^100644 blob ([a-f0-9]{40})\t([^\0]+)\0$/.exec(entry);
  if(!match||match[2]!==path)throw Error('unsafe_context_entry');
  const size=Number(decoder.decode(git('cat-file','-s',match[1])).trim());
  if(!Number.isSafeInteger(size)||size<0||size>20000||(total+=size)>60000)throw Error('context_limit');
  const body=git('cat-file','blob',match[1]);
  if(body.length!==size||body.includes(0))throw Error('invalid_context_blob');
  const content=decoder.decode(body);
  if(/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:ghp_|github_pat_|sk-proj-)[A-Za-z0-9_-]{16,}/.test(content))throw Error('possible_secret');
  files.push(Object.freeze({path,content}));
 }
 return Object.freeze({baseSha,files:Object.freeze(files)});
}
