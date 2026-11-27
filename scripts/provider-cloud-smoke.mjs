import {createGroqTransport} from '../src/groq-transport.mjs';
import {createOpenRouterFreeTransport} from '../src/openrouter-free.mjs';

const provider=process.argv[2];
if(!['groq','openrouter'].includes(provider)||process.env.BADP_FREE_CONFIRMED!=='true') {
 console.error('smoke_not_authorized');process.exit(1);
}
const apiKey=provider==='groq'?process.env.GROQ_API_KEY:process.env.OPENROUTER_API_KEY;
let reserved=false;
const admission={async reserve(){if(reserved)return {allowed:false};reserved=true;return {allowed:true};}};
try {
 const options={apiKey,admission,publicSourceApproved:true};
 const send=provider==='groq'?createGroqTransport({...options,model:'openai/gpt-oss-20b',freePlanVerified:true}):createOpenRouterFreeTransport(options);
 const result=await send({messages:[{role:'system',content:'Reply with exactly OK.'},{role:'user',content:'Connectivity test. Reply OK.'}]});
 if(result.trim()!=='OK')throw Error('unexpected_response');
 console.log('provider_smoke_passed');
}catch{console.error('provider_smoke_failed');process.exitCode=1;}
