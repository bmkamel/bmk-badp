import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {candidate,targets} from './locale-engineering.mjs';

const task = JSON.parse(readFileSync(process.env.RUNNER_TEMP+'/engineering-candidate.json','utf8'));
if (!Object.hasOwn(targets,task.kind) || task.pr) process.exit(0);
const path = targets[task.kind].path;
const base = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(task.base,base);
const original = execFileSync('git',['show',base+':'+path],{encoding:'utf8'});
const moduleText = candidate(task.kind,original,task.proposal);
assert.equal(readFileSync(path,'utf8'),moduleText);
const image = 'node@sha256:be979e5523c76fa4d5ca4ebd3099078f220aa47ec39c48ad5b5df9314debd6eb';
execFileSync('docker',['pull',image],{stdio:'inherit',timeout:90000});
// Send only the reviewed literal module on stdin. The guest has no host mount.
const harness = `import assert from 'node:assert/strict';
  const chunks=[]; for await (const chunk of process.stdin) chunks.push(chunk);
  const {default: values}=await import('data:text/javascript;base64,'+Buffer.concat(chunks).toString('base64'));
  if(process.argv[1]==='theme-actions'){
    assert.match(values.arLight,/فاتح/);assert.match(values.arDark,/داكن/);
    assert.equal(values.enLight,'☀ Light');assert.equal(values.enDark,'◐ Dark');
  } else { assert.equal(values.en,'English');assert.equal(values.ar,'العربية'); }
  assert.equal(process.getuid(),65534);
  console.log('Locale behavior verified in offline container');`;
execFileSync('docker',['run','--rm','-i','--network','none','--read-only','--cap-drop','ALL',
  '--security-opt','no-new-privileges','--user','65534:65534','--pids-limit','64','--memory','128m','--cpus','1',
  image,'node','--input-type=module','-e',harness,task.kind],{input:moduleText,stdio:['pipe','inherit','inherit'],timeout:30000});
