import {createSourceVerification} from '../src/source-verification.mjs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const image=process.env.BADP_SMOKE_IMAGE;
if(!/^(docker\.io\/library\/)?node@sha256:[a-f0-9]{64}$/.test(image??''))throw Error('immutable_image_required');
execFileSync('docker',['image','inspect',image],{stdio:'ignore',timeout:10000});
const old='export const add = n => n + 1;';
const replacement='export const add = n => n + 2;';
const baseCommit='a'.repeat(40);
const verifier=createSourceVerification({async verify({proposal,proposalDigest}){
 assert.equal(proposal.files.length,1);
 assert.equal(proposal.files[0].content,replacement);
 const name='badp-fixture-'+crypto.randomUUID();
 try{
 execFileSync('docker',['run','--rm','--name',name,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','65534:65534','--pids-limit','64','--memory','256m','--cpus','1','--tmpfs','/tmp:rw,noexec,nosuid,size=16m',image,'node','--input-type=module','-e',`import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';assert.equal(process.getuid(),65534);assert.deepEqual(fs.readdirSync('/sys/class/net'),['lo']);assert.throws(()=>fs.writeFileSync('/blocked','x'));for(const k of ['GITHUB_TOKEN','GROQ_API_KEY','OPENROUTER_API_KEY'])assert.equal(process.env[k],undefined);fs.writeFileSync('/tmp/fixture.mjs',process.argv[1]);execFileSync(process.execPath,['--check','/tmp/fixture.mjs'],{timeout:3000});assert.equal((await import('file:///tmp/fixture.mjs')).add(1),3);`,replacement],{timeout:30000,stdio:'ignore'});
 }finally{try{execFileSync('docker',['rm','-f',name],{timeout:10000,stdio:'ignore'});}catch{}}
 return {proposalDigest,baseCommit:proposal.baseCommit,isolated:true,networkDisabled:true,secretsAbsent:true,checks:['syntax','tests','scope'].map(name=>({name,passed:true}))};
}});
const result=await verifier.run({baseCommit,snapshot:new Map([['src/fixture.mjs',old]]),allowedPaths:['src/fixture.mjs'],changes:[{path:'src/fixture.mjs',beforeSha256:createHash('sha256').update(old).digest('hex'),content:replacement}]});
assert.equal(result.status,'review-required');
console.log('source_isolation_fixture_passed');
