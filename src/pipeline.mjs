// Pure state machine; external effects must be performed by a separately authorized executor.
const edges={plan:{ok:'patch',fail:'blocked'},patch:{ok:'test',fail:'blocked'},test:{ok:'preview',fail:'repair'},repair:{ok:'test',fail:'blocked'},preview:{ok:'review',fail:'blocked'},review:{ok:'complete',fail:'blocked'}};
export function advance(run,event){
 if(!run || !run.id || !run.projectId || !Number.isSafeInteger(run.repairs)||run.repairs<0||!Object.hasOwn(edges,run.stage)||!event||event.runId!==run.id||event.projectId!==run.projectId||event.stage!==run.stage||!['ok','fail'].includes(event.result))throw Error('invalid event');
 let stage=edges[run.stage][event.result],repairs=run.repairs;
 if(stage==='repair'){if(repairs>=2)stage='blocked';else repairs++;}
 if(run.stage==='review'&&event.result==='ok'&&event.approved!==true)stage='blocked';
 return {...run,stage,repairs};
}
