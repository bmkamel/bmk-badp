// Pure admission policy for proposed repository changes. Not an execution sandbox.
const allowedRoots=new Set(['src','test','docs']);
const allowedExtensions=new Set(['.mjs','.js','.ts','.tsx','.jsx','.json','.md','.css','.html']);
export function validateRepositoryChanges(changes){
 if(!Array.isArray(changes)||changes.length<1||changes.length>25)throw Error('invalid_changes');
 const seen=new Set();let total=0;
 for(const entry of changes){
  if(!entry||typeof entry.path!=='string'||entry.path.length>240||typeof entry.bytes!=='number'||!Number.isSafeInteger(entry.bytes)||entry.bytes<0||entry.bytes>100000||!['add','modify'].includes(entry.kind))throw Error('invalid_change');
  const parts=entry.path.split('/');
  if(parts.length<2||!allowedRoots.has(parts[0])||parts.some(p=>! /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(p)||p.endsWith('.')||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)||/(?:^|[_.-])(?:secret|secrets|credential|credentials|token|tokens|password|passwords|key|keys|env)(?:[_.-]|$)/i.test(p)))throw Error('protected_path');
  const leaf=parts.at(-1);const ext=leaf.slice(leaf.lastIndexOf('.')).toLowerCase();
  if(!allowedExtensions.has(ext))throw Error('protected_path');
  const key=entry.path.toLowerCase();if(seen.has(key))throw Error('duplicate_path');seen.add(key);
  total+=entry.bytes;if(total>300000)throw Error('change_budget_exceeded');
 }
 return {files:changes.length,bytes:total};
}
export function validateRepositoryJob(job){
 if(!job||typeof job.repository!=='string'||! /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(job.repository)||! /^[a-f0-9]{40}$/.test(job.baseSha||'')||! /^dev\/badp-[a-z0-9-]{1,64}$/.test(job.branch||'')||!['aider','opencode'].includes(job.engine)||typeof job.goal!=='string'||!job.goal.trim()||new TextEncoder().encode(job.goal).length>4000)throw Error('invalid_repository_job');
 return Object.freeze({repository:job.repository,baseSha:job.baseSha,branch:job.branch,engine:job.engine,goal:job.goal});
}
