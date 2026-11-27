const enc=new TextEncoder();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const un64=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
export function configured(env={}){return Boolean(env.GITHUB_CLIENT_ID&&env.GITHUB_CLIENT_SECRET&&typeof env.SESSION_SECRET==='string'&&enc.encode(env.SESSION_SECRET).length>=32&&/^\d+$/.test(env.GITHUB_ALLOWED_ID??''));}
async function key(secret){return crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function signSession(id,secret,now=Date.now()){const payload=b64(enc.encode(JSON.stringify({id,exp:now+3600000})));return payload+'.'+b64(await crypto.subtle.sign('HMAC',await key(secret),enc.encode(payload)));}
export async function verifySession(token,env,now=Date.now()){try{if(!configured(env)||typeof token!=='string'||token.length>2048)return false;const parts=token.split('.');if(parts.length!==2)return false;const [p,s]=parts;if(!await crypto.subtle.verify('HMAC',await key(env.SESSION_SECRET),un64(s),enc.encode(p)))return false;const v=JSON.parse(new TextDecoder().decode(un64(p)));return v.id===env.GITHUB_ALLOWED_ID&&Number.isSafeInteger(v.exp)&&v.exp>now&&v.exp<=now+3600000;}catch{return false;}}
