import {openHybridRuntime} from '../src/hybrid-runtime.mjs';
import {validateSourceProposal} from '../src/source-proposal.mjs';
import {createSourceVerification} from '../src/source-verification.mjs';
import {createReviewEnvelope} from '../src/review-envelope.mjs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
if(process.env.BADP_FREE_CONFIRMED!=='true'||process.env.BADP_GROQ_FREE_VERIFIED!=='true')throw Error('not_authorized');
const image=process.env.BADP_SMOKE_IMAGE;
if(!/^(docker\.io\/library\/)?node@sha256:[a-f0-9]{64}$/.test(image??''))throw Error('immutable_image_required');
const path='src/pilot-format.mjs',old=readFileSync(path,'utf8'),baseCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const dir=mkdtempSync(join(tmpdir(),'badp-source-'));let runtime;
try{
 const limit={verifiedFree:true,minuteRequests:1,dailyRequests:1,dailyUnits:8000};
 runtime=openHybridRuntime({database:join(dir,'budget.sqlite'),limits:{groq:limit},groq:{apiKey:process.env.GROQ_API_KEY,model:'openai/gpt-oss-20b',freePlanVerified:true},publicSourceApproved:true});
 const inputFor=output=>{const value=JSON.parse(output);return {baseCommit,snapshot:new Map([[path,old]]),allowedPaths:[path],changes:[{path,beforeSha256:createHash('sha256').update(old).digest('hex'),content:value.patches?.length===1&&value.patches[0].path===path?value.patches[0].content:null}]};};
 const output=await runtime.generate({phase:'patch',dataClass:'public',prompt:'Return JSON {"patches":[{"path":"src/pilot-format.mjs","content":"..."}]}. Change this module so formatLabel trims surrounding whitespace while preserving String conversion. No imports or dependencies. Current source: '+old,accept:o=>validateSourceProposal(inputFor(o))});
 const input=inputFor(output),proposal=validateSourceProposal(input);
 const verifier=createSourceVerification({async verify({proposal,proposalDigest}){
 const name='badp-pilot-'+crypto.randomUUID();
 try{execFileSync('docker',['run','--rm','--name',name,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','65534:65534','--pids-limit','64','--memory','256m','--cpus','1','--tmpfs','/tmp:rw,noexec,nosuid,size=16m',image,'node','--input-type=module','-e',`import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';assert.equal(process.getuid(),65534);assert.deepEqual(fs.readdirSync('/sys/class/net'),['lo']);for(const k of ['GITHUB_TOKEN','GROQ_API_KEY','OPENROUTER_API_KEY'])assert.equal(process.env[k],undefined);fs.writeFileSync('/tmp/pilot.mjs',process.argv[1]);execFileSync(process.execPath,['--check','/tmp/pilot.mjs'],{timeout:3000});const {formatLabel}=await import('file:///tmp/pilot.mjs');assert.equal(formatLabel('  hello  '),'hello');assert.equal(formatLabel(42),'42');assert.equal(formatLabel(''),'');`,proposal.files[0].content],{timeout:30000,stdio:'ignore'});}finally{try{execFileSync('docker',['rm','-f',name],{timeout:10000,stdio:'ignore'});}catch{}}
 return {proposalDigest,baseCommit,isolated:true,networkDisabled:true,secretsAbsent:true,checks:['syntax','tests','scope'].map(name=>({name,passed:true}))};
 }});
 const evidence=await verifier.run(input);
 const review=createReviewEnvelope({proposal,evidence,projectId:'badp-source-pilot',currentBase:baseCommit});
 writeFileSync(process.env.BADP_PILOT_OUTPUT,JSON.stringify({proposal,evidence,review},null,2),{flag:'wx',mode:0o600});
 console.log('source_pilot_review_required');
}finally{runtime?.close();rmSync(dir,{recursive:true,force:true});}
