import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRepositoryChanges,validateRepositoryJob} from '../src/repository-policy.mjs';
const change=(path,extra={})=>({path,kind:'modify',bytes:100,...extra});
test('admits bounded source, test and documentation proposals',()=>{
 assert.deepEqual(validateRepositoryChanges([change('src/example.mjs'),change('test/example.test.mjs'),change('docs/guide.md')]),{files:3,bytes:300});
});
test('rejects traversal, configuration, workflows, secret paths and Windows aliases',()=>{
 for(const path of ['../src/a.js','src/../a.js','src\\a.js','/src/a.js','.github/workflows/ci.yml','package.json','src/.env','src/api-keys.json','src/CON.js','src/a.js.','src/a.pem','src/a.js:stream','src//a.js','db/0008.sql']){
  assert.throws(()=>validateRepositoryChanges([change(path)]),/protected_path/);
 }
});
test('rejects destructive, oversized and case-colliding proposals',()=>{
 assert.throws(()=>validateRepositoryChanges([change('src/a.js',{kind:'delete'})]),/invalid_change/);
 assert.throws(()=>validateRepositoryChanges([change('src/a.js'),change('src/A.js')]),/duplicate_path/);
 assert.throws(()=>validateRepositoryChanges(Array.from({length:4},(_,i)=>change('src/a'+i+'.js',{bytes:100000}))),/change_budget_exceeded/);
});
test('repository job pins immutable base and uses restricted dev branch',()=>{
 const job={repository:'owner/repo',baseSha:'a'.repeat(40),branch:'dev/badp-task-1',engine:'aider',goal:'Add test'};
 assert.equal(validateRepositoryJob(job).engine,'aider');
 for(const patch of [{branch:'main'},{baseSha:'main'},{engine:'shell'},{repository:'https://example.com/r'},{goal:''}])assert.throws(()=>validateRepositoryJob({...job,...patch}),/invalid_repository_job/);
});
