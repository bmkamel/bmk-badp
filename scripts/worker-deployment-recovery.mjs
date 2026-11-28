import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const uuid = /^[a-f0-9-]{36}$/;
const sha = /^[a-f0-9]{40}$/;

export function singleVersion(deployment) {
  const versions = deployment?.versions;
  if (versions?.length !== 1 || versions[0].percentage !== 100 || !uuid.test(versions[0].version_id)) return null;
  return versions[0].version_id;
}
export function rollbackTarget(previous, deployments, activeSource, targetSource) {
  if (!uuid.test(previous?.id ?? '') || !uuid.test(previous?.version ?? '') ||
      !sha.test(previous?.source ?? '') || activeSource !== targetSource || previous.source === activeSource) return null;
  if (deployments[1]?.id !== previous.id || singleVersion(deployments[1]) !== previous.version ||
      !singleVersion(deployments[0]) || singleVersion(deployments[0]) === previous.version) return null;
  return previous.version;
}
async function main(mode) {
  const base = 'https://api.cloudflare.com/client/v4/accounts/bae249433042911808956a8d6f145ba2/workers/scripts/badp-r1-preview';
  const url = 'https://badp-r1-preview.bmkamel.workers.dev/api/health';
  const token = process.env.CF_TOKEN;
  assert.ok(token);
  const file = process.env.RUNNER_TEMP+'/known-worker-deployment.json';
  async function api(path, method='GET', body) {
    const response = await fetch(base+path,{method,redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:body===undefined?undefined:JSON.stringify(body)});
    if (!response.ok) throw Error('deployment_api_'+response.status);
    const value=await response.json();
    assert.equal(value.success,true);
    return value.result;
  }
  const versionSource = async version => (await api('/versions/'+version)).resources?.bindings
    ?.find(binding=>binding.name==='SOURCE_SHA'&&binding.type==='plain_text')?.text;
  const health = async () => {
    const response = await fetch(url+'?check='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(8000)}).catch(()=>null);
    if (response?.ok) return response.json().catch(()=>null);
    return null;
  };
  const {deployments} = await api('/deployments');
  if (mode === 'snapshot') {
    const version=singleVersion(deployments[0]);
    const source=version && await versionSource(version);
    const checks=await health();
    if (!version || !sha.test(source ?? '') || checks?.sourceSha!==source || checks?.status!=='ok') {
      console.log('No healthy prior single-version deployment available for automatic rollback.');
      return;
    }
    writeFileSync(file,JSON.stringify({id:deployments[0].id,version,source}));
    console.log('Healthy rollback candidate '+source);
    return;
  }
  assert.equal(mode,'rollback');
  let prior;
  try { prior=JSON.parse(readFileSync(file,'utf8')); }
  catch { throw Error('no_safe_rollback_snapshot'); }
  const version=singleVersion(deployments[0]);
  const activeSource=version && await versionSource(version);
  const target=rollbackTarget(prior,deployments,activeSource,process.env.GITHUB_SHA);
  assert.ok(target,'deployment changed outside this run or no safe rollback target');
  const fresh=(await api('/deployments')).deployments[0];
  assert.equal(fresh.id,deployments[0].id,'live deployment changed during recovery');
  await api('/deployments','POST',{strategy:'percentage',versions:[{version_id:target,percentage:100}]});
  for(let i=0;i<8;i++) {
    if ((await health())?.sourceSha===prior.source) {
      console.log('Restored and verified '+prior.source);
      return;
    }
    await new Promise(resolve=>setTimeout(resolve,3000));
  }
  throw Error('restored_revision_not_verified');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) await main(process.argv[2]);
