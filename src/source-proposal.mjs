import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
const validPath=p=>typeof p==='string'&&/^(src|test)\/[a-z0-9][a-z0-9-]{0,80}\.mjs$/.test(p)&&!/(?:^|\/)(?:con|prn|aux|nul|com[1-9]|lpt[1-9])\.mjs$/.test(p);
// Pure validation only; never executes or writes proposed code.
export function validateSourceProposal({baseCommit,snapshot,allowedPaths,changes}={}){
 if(!/^[a-f0-9]{40}$/.test(baseCommit??'')||!(snapshot instanceof Map)||!Array.isArray(allowedPaths)||!Array.isArray(changes)||changes.length<1||changes.length>8)throw Error('invalid_proposal');
 const allow=new Set(allowedPaths),seen=new Set();let bytes=0;
 const files=changes.map(c=>{
  if(!c||!validPath(c.path)||!allow.has(c.path)||seen.has(c.path)||typeof c.content!=='string'||!snapshot.has(c.path))throw Error('invalid_change');
  const old=snapshot.get(c.path);
  if(typeof old!=='string'||c.beforeSha256!==hash(old)||old===c.content)throw Error('stale_or_empty_change');
  bytes+=Buffer.byteLength(c.content);
  if(bytes>128000||c.content.includes('\0')||/(?:gsk_|sk-or-v1-|ghp_|github_pat_)[a-zA-Z0-9_-]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(c.content))throw Error('unsafe_content');
  seen.add(c.path);
  return Object.freeze({path:c.path,beforeSha256:c.beforeSha256,afterSha256:hash(c.content),content:c.content});
 });
 return Object.freeze({baseCommit,files:Object.freeze(files),status:'proposal-only'});
}
