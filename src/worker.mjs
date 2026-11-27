// R1 preview: no authenticated API or external execution enabled.
export default { async fetch(request) {
 const url=new URL(request.url);
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
 if(request.method==='GET' && url.pathname==='/health') return new Response(JSON.stringify({service:'BADP',stage:'preview'}),{headers});
 return new Response(JSON.stringify({error:'not_available'}),{status:404,headers});
}};
