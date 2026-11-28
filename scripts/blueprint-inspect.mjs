import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
export function inspectBlueprint(document, files, base){
 if(typeof document!=='string'||!/^([a-f0-9]{40})$/.test(base))throw Error('invalid_baseline');
 const start=document.indexOf('### 16. First executable work order: BADP-TASK-001');
 const end=document.indexOf('\n### 17.',start);
 if(start<0||end<0)throw Error('work_order_missing');
 const order=document.slice(start,end);
 const paths=['src/local-sqlite.mjs','src/development-runner.mjs','scripts/source-live-pilot.mjs','scripts/publish-source-pilot.mjs','.github/workflows/source-live-pilot.yml'];
 const digest=s=>createHash('sha256').update(s).digest('hex');
 const inventory=paths.map(path=>{const source=files[path];if(typeof source!=='string'||!source.length)throw Error('missing_source');return {path,sha256:digest(source)};});
 return {taskId:'BADP-TASK-001',base,blueprintDigest:digest(document),workOrderDigest:digest(order),inventory,stage:'inspection',next:'define_trusted_verifier',executionAuthorized:false};
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){
 const paths=['src/local-sqlite.mjs','src/development-runner.mjs','scripts/source-live-pilot.mjs','scripts/publish-source-pilot.mjs','.github/workflows/source-live-pilot.yml'];
 const base=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const report=inspectBlueprint(readFileSync('docs/MASTER_BLUEPRINT.md','utf8'),Object.fromEntries(paths.map(p=>[p,readFileSync(p,'utf8')])),base);
 console.log(JSON.stringify(report,null,2));
}
