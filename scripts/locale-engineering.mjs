import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGroqTransport} from '../src/groq-transport.mjs';
import {createOpenRouterFreeTransport} from '../src/openrouter-free.mjs';
import {d1AiBudget} from '../src/d1-ai-budget.mjs';

export const targets = Object.freeze({
  'theme-actions': {
    path: 'preview/theme-actions.mjs',
    goal: 'Translate both Arabic theme actions. Preserve the symbols and English labels. Use فاتح and داكن as in the dashboard.',
    url: 'https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/html/reference/global_attributes/lang/index.md',
  },
  'language-names': {
    path: 'preview/language-names.mjs',
    goal: 'Display the full English language name in the language switch. Preserve the Arabic endonym.',
    url: 'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-localenames-full/main/en/languages.json',
  },
});

const hash = text => createHash('sha256').update(text).digest('hex');
export function decodeModule(source) {
  const match = /^export default (\{[^\n]*\});\n?$/.exec(source);
  assert.ok(match, 'unsupported locale module');
  return JSON.parse(match[1]);
}

export function hasGap(kind, source) {
  const value = decodeModule(source);
  return kind === 'theme-actions'
    ? value.arLight === value.enLight && value.arDark === value.enDark
    : kind === 'language-names' && value.en === 'EN';
}

export async function research(kind, fetcher = fetch) {
  const {url,goal} = targets[kind];
  const response = await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(12000)});
  assert.ok(response.ok);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    assert.ok(bytes <= 150000);
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  let observation;
  if (kind === 'language-names') {
    assert.equal(JSON.parse(raw).main.en.localeDisplayNames.languages.en,'English');
    observation = 'CLDR names English as English in its own locale.';
  } else {
    assert.ok(raw.includes('BCP 47') && raw.includes('language'));
    observation = 'MDN describes lang as the language of the element. The landing page declares Arabic but both theme actions are English.';
  }
  return {url,digest:hash(raw),accessed:new Date().toISOString(),observation,decision:goal};
}

// Read the model response as data. The only published syntax is a literal module.
export function candidate(kind, source, proposal) {
  assert.ok(hasGap(kind,source));
  const before = decodeModule(source);
  const result = JSON.parse(proposal);
  assert.deepEqual(Object.keys(result).sort(),Object.keys(before).sort());
  if (kind === 'language-names') {
    assert.equal(result.en,'English');
    assert.equal(result.ar,before.ar);
  } else {
    assert.equal(result.enLight,before.enLight);
    assert.equal(result.enDark,before.enDark);
    assert.ok(['☀ فاتح','☀ الوضع الفاتح'].includes(result.arLight));
    assert.ok(['◐ داكن','◐ الوضع الداكن'].includes(result.arDark));
  }
  return 'export default '+JSON.stringify(result)+';\n';
}

export async function generate(kind, source, db, env, record, previousReason) {
  const admission = d1AiBudget(db);
  const messages = [
    {role:'system',content:'Return just the complete JSON object for the locale file. Keep its keys and make only the requested changes.'},
    {role:'user',content:JSON.stringify({goal:targets[kind].goal,values:decodeModule(source),
      ...(previousReason==='provider_or_validation_failure'?{retry:'Check each original key, unchanged values, requested translations and JSON syntax.'}:{})})},
  ];
  const providers = [];
  let usage;
  const onUsage = value => {usage=value;};
  if (env.BADP_GROQ_FREE_VERIFIED === 'true' && env.GROQ_API_KEY) {
    providers.push(['groq',createGroqTransport({apiKey:env.GROQ_API_KEY,model:'openai/gpt-oss-20b',admission,freePlanVerified:true,publicSourceApproved:true,onUsage})]);
  }
  if (env.OPENROUTER_API_KEY) {
    providers.push(['openrouter-free',createOpenRouterFreeTransport({apiKey:env.OPENROUTER_API_KEY,admission,publicSourceApproved:true,onUsage})]);
  }
  let reason = 'provider_unconfigured';
  for (const [provider,send] of providers) {
    usage=undefined;
    let proposal;
    try {
      proposal = await send({messages,jsonOutput:true});
      candidate(kind,source,proposal);
    } catch (error) {
      // Keep a reason code only. Model output, prompts and credentials stay out of logs.
      const outcome = /quota_denied/.test(error.message) ? 'daily_quota' : 'provider_or_validation_failure';
      if (reason!=='provider_or_validation_failure') reason=outcome;
      await record(provider,outcome,usage);
      continue;
    }
    await record(provider,'accepted',usage);
    return {provider,proposal,beforeDigest:hash(source)};
  }
  return {reason};
}
