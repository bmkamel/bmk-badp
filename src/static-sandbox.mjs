import {allowedPatch} from './patch-policy.mjs';

const bytes=value=>new TextEncoder().encode(value).length;

// A complete patch set is interpreted only as inert static assets in a fresh
// virtual filesystem. No generated JavaScript is executed in this R0 slice.
export function validatePatches(patches){
 if(!Array.isArray(patches)||patches.length<1||patches.length>12)throw Error('invalid_patches');
 const paths=new Set();let total=0;const safe=[];
 for(const patch of patches){
  if(!patch||typeof patch.path!=='string'||typeof patch.content!=='string'||paths.has(patch.path)||!allowedPatch(patch.path,patch.content))throw Error('invalid_patches');
  paths.add(patch.path);total+=bytes(patch.content);
  if(total>500000)throw Error('invalid_patches');
  safe.push({path:patch.path,content:patch.content});
 }
 if(!paths.has('app/index.html'))throw Error('missing_entrypoint');
 return safe;
}

function checksFor(files){
 const html=files.get('app/index.html')||'';
 const source=[...files.values()].join('\n');
 return [
  {name:'entrypoint',passed:files.has('app/index.html')},
  {name:'document_title',passed:/<title\b[^>]*>[^<]+<\/title>/i.test(html)},
  {name:'main_landmark',passed:/<main\b[^>]*>/i.test(html)&&/<\/main>/i.test(html)},
  {name:'offline_static_only',passed:!/(?:\bsrc|\bhref)\s*=\s*["']\s*(?:https?:)?\/\//i.test(source)&&!/<script\b/i.test(html)&&!/\bfetch\s*\(/i.test(source)}
 ];
}

export function createStaticSandboxExecutor(){
 return Object.freeze({
  async execute({patches}){
   const safe=validatePatches(patches);
   const files=new Map(safe.map(patch=>[patch.path,patch.content]));
   const checks=checksFor(files);
   const passed=checks.every(check=>check.passed);
   return {
    passed,
    checks,
    preview:passed?{
     kind:'static-html',
     entrypoint:'app/index.html',
     mimeType:'text/html',
     html:files.get('app/index.html'),
     files:safe.map(({path,content})=>({path,bytes:bytes(content)}))
    }:null
   };
  }
 });
}
