// Conservative allowlist for first generated-app sandbox, not arbitrary repositories.
export function allowedPatch(path,content){
 if(typeof path!=='string'||typeof content!=='string'||new TextEncoder().encode(content).length>100000)return false;
 if(!/^app\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:html|css|js|json|md)$/.test(path))return false;
 return !path.split('/').some(p=>['node_modules','secrets','credentials'].includes(p.toLowerCase()));
}
