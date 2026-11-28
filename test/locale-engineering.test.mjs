import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {candidate,decodeModule,generate,hasGap,research} from '../scripts/locale-engineering.mjs';
import {engineeringRoute} from '../preview/engineering.mjs';

test('locale review binds the full output and rejects extra keys, code and altered translations',()=>{
  const src='export default {"en":"EN","ar":"العربية"};\n';
  const proposed='{"en":"English","ar":"العربية"}';
  const out=candidate('language-names',src,proposed);
  assert.deepEqual(decodeModule(out),JSON.parse(proposed));
  assert.equal(hasGap('language-names',out),false);
  for(const invalid of ['{"en":"English","ar":"x"}','{"en":"English","ar":"العربية","code":"()"}','{"en":"<b>English</b>","ar":"العربية"}']) {
    assert.throws(()=>candidate('language-names',src,invalid));
  }
  assert.throws(()=>candidate('language-names',out,proposed));
});

test('research requires specific upstream content and stores its digest',async()=>{
  const mock=()=>Promise.resolve(Response.json({main:{en:{localeDisplayNames:{languages:{en:'English'}}}}}));
  assert.match((await research('language-names',mock)).digest,/^[a-f0-9]{64}$/);
  await assert.rejects(research('language-names',()=>Promise.resolve(Response.json({}))));
});

test('record quota denial without making an inference or inventing token use',async()=>{
  const db={prepare:()=>({bind:()=>({run:()=>({meta:{changes:0}})})})};
  const events=[];
  const result=await generate('language-names','export default {"en":"EN","ar":"العربية"};',db,
    {OPENROUTER_API_KEY:'fixture'},(...args)=>events.push(args));
  assert.equal(result.reason,'daily_quota');
  assert.deepEqual(events,[['openrouter-free','daily_quota',undefined]]);
});

test('durable intake is idempotent, scoped, and supports pause/resume',async()=>{
  const db=new DatabaseSync(':memory:');
  try {
    for(const f of ['0010_engineering_queue','0011_engineering_controls','0012_engineering_recipes','0013_engineering_model_tasks']) {
      db.exec(readFileSync(new URL('../db/'+f+'.sql',import.meta.url),'utf8'));
    }
    const adapter={prepare:sql=>({bind:(...p)=>({
      run:()=>({meta:db.prepare(sql).run(...p)}),first:()=>db.prepare(sql).get(...p)
    })})};
    const id=crypto.randomUUID();
    const post=payload=>engineeringRoute(new Request('https://badp.test/api/engineering',{
      method:'POST',headers:{Origin:'https://badp.test','Content-Type':'application/json'},body:JSON.stringify({id,...payload})
    }),{ENGINE_DB:adapter,GITHUB_ALLOWED_ID:'owner'},{});
    const command={action:'inspect',command:'افحص واجهات BADP'};
    assert.equal((await post(command)).status,202);
    assert.equal((await post(command)).status,202);
    assert.equal((await post({...command,command:'different'})).status,409);
    for(const action of ['pause','resume']) assert.equal((await post({action})).status,202);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM engineering_intake').get().n,1);
  } finally {db.close();}
});
