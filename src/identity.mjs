// Verify Cloudflare Access JWT using a configured issuer and audience.
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const parse=s=>JSON.parse(new TextDecoder().decode(decode(s)));
export function accessIdentity({issuer,audience,db,fetcher=fetch,clock=()=>Date.now()}) {
 return async request=>{
  if(!issuer || !audience || !db) return null;
  const origin=new URL(issuer);
  if(origin.protocol!=='https:' || origin.origin!==issuer || !origin.hostname.endsWith('.cloudflareaccess.com')) return null;
  const token=request.headers.get('Cf-Access-Jwt-Assertion');
  if(!token || token.length>16000) return null;
  try {
   const parts=token.split('.');if(parts.length!==3)return null;
   const h=parse(parts[0]),p=parse(parts[1]),now=clock()/1000;
   if(h.alg!=='RS256'||typeof h.kid!=='string'||p.iss!==issuer||!Array.isArray(p.aud)||!p.aud.includes(audience)||!Number.isFinite(p.exp)||p.exp<=now||typeof p.sub!=='string'||!p.sub||(p.nbf!==undefined&&(!Number.isFinite(p.nbf)||p.nbf>now)))return null;
   const response=await fetcher(issuer+'/cdn-cgi/access/certs',{redirect:'error'});if(!response.ok)return null;
   const {keys}=await response.json();const jwk=keys.find(k=>k.kid===h.kid&&k.kty==='RSA');if(!jwk)return null;
   const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
   if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))return null;
   const actor=await db.prepare('SELECT actor_id AS id FROM identities WHERE issuer=? AND subject=?').bind(issuer,p.sub).first();
   return actor||null;
  }catch{return null;}
 };
}
