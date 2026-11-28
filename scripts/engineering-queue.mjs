import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {path, source, transform} from './engineering-transform.mjs';

const repository = 'bmkamel/bmk-badp';
assert.equal(process.env.GITHUB_REPOSITORY, repository);
assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
const mode = process.argv[2];
const run = process.env.GITHUB_RUN_ID;
assert.match(run, /^\d+$/);
const file = process.env.RUNNER_TEMP+'/engineering-candidate.json';
const cf = process.env.CF_TOKEN;
const gh = process.env.GH_TOKEN;
const base = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const readBase = () => execFileSync('git',['show',base+':'+path],{encoding:'utf8'});
const workflowUrl = 'https://github.com/'+repository+'/actions/runs/'+run;
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));

async function request(url, token, method, body) {
  const response = await fetch(url,{method,redirect:'error',signal:AbortSignal.timeout(12000),
    headers:{Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body)});
  if (!response.ok) throw Error('api_'+method+'_'+response.status);
  return response.status === 204 ? null : response.json();
}
const github = (endpoint, method='GET', body) => request('https://api.github.com/repos/'+repository+endpoint,gh,method,body);
async function query(sql,...params) {
  const data = await request('https://api.cloudflare.com/client/v4/accounts/bae249433042911808956a8d6f145ba2/d1/database/c52bcd53-f510-4340-9a96-30eef4127345/query',cf,'POST',{sql,params});
  assert.ok(data.success && data.result[0]?.success);
  return data.result[0].results;
}
function safeTask(task) {
  assert.match(task.id,/^[a-f0-9-]{36}$/);
  assert.ok(['dashboard-theme','composer-keyboard'].includes(task.kind));
}
function verify(task) {
  safeTask(task);
  const current = readFileSync(path,'utf8');
  assert.equal(current, transform(readBase(),task.kind));
  assert.equal(execFileSync('git',['diff','--name-only'],{encoding:'utf8'}).trim(),path);
  execFileSync('git',['diff','--check']);
}
if (mode === 'prepare') {
  let task;
  const attempts=process.env.GITHUB_EVENT_NAME==='push'?9:1;
  for(let check=0;check<attempts;check++) {
    [task] = await query("UPDATE engineering_queue SET status='running', attempts=attempts+1, run_id=?, lease_until=unixepoch()+600 WHERE id=(SELECT id FROM engineering_queue WHERE attempts<3 AND (status='queued' OR (status='running' AND lease_until<unixepoch())) ORDER BY requested_at,id LIMIT 1) RETURNING id,kind,pr,merge_sha",run);
    if(task || check===attempts-1) break;
    await delay(8000);
  }
  if (!task) {
    console.log('No eligible engineering task');
    process.exit(0);
  }
  safeTask(task);
  writeFileSync(file,JSON.stringify({...task,base}));
  if (!task.pr) {
    if (task.kind === 'dashboard-theme') {
      const evidence = await fetch(source,{redirect:'error',signal:AbortSignal.timeout(10000)});
      assert.ok(evidence.ok && (await evidence.text()).includes('prefers-color-scheme'),'official source unavailable');
    }
    writeFileSync(path,transform(readBase(),task.kind));
    verify(task);
  }
  console.log('Claimed '+task.kind+' in '+workflowUrl);
} else if (mode === 'publish') {
  const task=JSON.parse(readFileSync(file,'utf8'));
  safeTask(task);
  assert.equal(task.base,base);
  const [owned]=await query("SELECT id FROM engineering_queue WHERE id=? AND run_id=? AND status='running' AND lease_until>unixepoch()",task.id,run);
  assert.ok(owned,'lost task lease');
  let pr=task.pr, merged=task.merge_sha;
  if (!pr) {
    verify(task);
    const ref=await github('/git/ref/heads/main');
    assert.equal(ref.object.sha,base,'stale base');
    const branch='badp/engineering-'+task.id;
    const current=await github('/git/commits/'+base);
    const tree=await github('/git/trees','POST',{base_tree:current.tree.sha,tree:[{path,mode:'100644',type:'blob',content:readFileSync(path,'utf8')}]});
    const actor={name:'BADP Engineering',email:'41898282+github-actions[bot]@users.noreply.github.com',date:current.committer.date};
    const commit=await github('/git/commits','POST',{tree:tree.sha,parents:[base],author:actor,committer:actor,message:'BADP: '+task.kind+' '+task.id});
    const existing=await github('/pulls?state=all&head=bmkamel:'+branch);
    assert.ok(existing.length<=1);
    if (existing[0]) {
      assert.equal(existing[0].head.sha,commit.sha);
      pr=existing[0].number;
    } else {
      await github('/git/refs','POST',{ref:'refs/heads/'+branch,sha:commit.sha}).catch(async error=>{
        if(error.message!=='api_POST_422')throw error;
        const ref=await github('/git/ref/heads/'+branch);
        assert.equal(ref.object.sha,commit.sha);
      });
      const opened=await github('/pulls','POST',{head:branch,base:'main',title:'BADP: '+task.kind,
        body:'Scoped change to '+path+'. Verified by '+workflowUrl+(task.kind==='dashboard-theme'?'\n\nResearch: '+source:'')});
      pr=opened.number;
    }
    await query("UPDATE engineering_queue SET pr=? WHERE id=? AND run_id=?",pr,task.id,run);
  }
  if (!merged) {
    const record=await github('/pulls/'+pr);
    assert.equal(record.head.ref,'badp/engineering-'+task.id);
    assert.equal(record.base.ref,'main');
    assert.equal((await github('/pulls/'+pr+'/files')).map(f=>f.filename).join(','),path);
    if (record.merged) merged=record.merge_commit_sha;
    else {
      assert.equal((await github('/git/ref/heads/main')).object.sha,base,'stale merge base');
      const head=await github('/git/commits/'+record.head.sha);
      assert.deepEqual(head.parents.map(parent=>parent.sha),[base]);
      const blob=await github('/contents/'+path+'?ref='+record.head.sha);
      assert.equal(Buffer.from(blob.content,'base64').toString('utf8'),transform(readBase(),task.kind));
      const result=await github('/pulls/'+pr+'/merge','PUT',{sha:record.head.sha,merge_method:'squash'});
      assert.equal(result.merged,true);
      merged=result.sha;
    }
    await query("UPDATE engineering_queue SET merge_sha=? WHERE id=? AND run_id=?",merged,task.id,run);
  }
  assert.match(merged,/^[a-f0-9]{40}$/);
  assert.equal((await github('/git/ref/heads/main')).object.sha,merged,'deployment revision superseded');
  await github('/actions/workflows/preview-deploy.yml/dispatches','POST',{ref:'main'});
  let live;
  for(let attempt=0;attempt<24;attempt++) {
    const response=await fetch('https://badp-r1-preview.bmkamel.workers.dev/api/health?engineering='+run,{cache:'no-store',signal:AbortSignal.timeout(8000)}).catch(()=>null);
    if(response?.ok && (await response.json()).sourceSha===merged) {live=true;break;}
    await delay(5000);
  }
  assert.ok(live,'deployment revision not verified');
  await query("UPDATE engineering_queue SET status='verified',lease_until=0,evidence=? WHERE id=? AND run_id=?",workflowUrl,task.id,run);
  if(task.kind==='dashboard-theme') {
    await query("INSERT INTO engineering_queue(id,owner,kind) SELECT ?,owner,'composer-keyboard' FROM engineering_queue WHERE id=? AND NOT EXISTS(SELECT 1 FROM engineering_queue WHERE kind='composer-keyboard')",randomUUID(),task.id);
    await github('/actions/workflows/engineering-queue.yml/dispatches','POST',{ref:'main'});
  }
  console.log('Verified deployment '+merged+' from PR '+pr);
} else if (mode === 'recover') {
  await query("UPDATE engineering_queue SET status=CASE WHEN attempts>=3 THEN 'blocked' ELSE 'queued' END,lease_until=0,evidence=? WHERE run_id=? AND status='running'",workflowUrl,run);
} else throw Error('invalid workflow stage');
