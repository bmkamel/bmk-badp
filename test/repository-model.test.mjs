import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRepositoryModel} from '../src/repository-model.mjs';
const request={phase:'patch',prompt:'Improve docs',context:{kind:'repository-proposal',files:[{path:'docs/a.md',content:'old'}]}};
test('repository model uses scoped structured prompt and returns replacement',async()=>{
 const model=createRepositoryModel({invoke:async ({messages})=>{
 assert.equal(messages[0].role,'system');assert.equal(JSON.parse(messages[1].content).files[0].content,'old');
 return JSON.stringify({patches:[{path:'docs/a.md',kind:'modify',content:'new'}]});
 }});
 assert.equal((await model.generate(request)).patches[0].content,'new');
});
test('rejects out of scope, duplicate and non-JSON responses',async()=>{
 for(const raw of ['not json',JSON.stringify({patches:[{path:'docs/b.md',kind:'modify',content:'new'}]}),JSON.stringify({patches:[{path:'docs/a.md',kind:'modify',content:'new'},{path:'docs/a.md',kind:'modify',content:'new'}]})]){
 await assert.rejects(createRepositoryModel({invoke:async()=>raw}).generate(request));
 }
});
test('rejects protected context before transport',async()=>{
 const model=createRepositoryModel({invoke:async()=>assert.fail('transport invoked')});
 await assert.rejects(model.generate({...request,context:{...request.context,files:[{path:'.git/config',content:'x'}]}}),/protected_path/);
});
