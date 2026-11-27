const kinds=new Set(['inspect','design','patch','test','preview']);
export function validatePlan(plan){
 if(!plan||typeof plan.goal!=='string'||!plan.goal.trim()||plan.goal.length>4000||!Array.isArray(plan.steps)||!plan.steps.length||plan.steps.length>20)return false;
 const seen=new Set();
 for(const s of plan.steps){if(!s||typeof s.id!=='string'||!s.id||seen.has(s.id)||!kinds.has(s.kind)||typeof s.description!=='string'||!s.description.trim()||s.description.length>2000||!Array.isArray(s.dependsOn)||!s.dependsOn.every(d=>seen.has(d)))return false;seen.add(s.id);}
 return plan.steps[0].kind==='inspect'&&plan.steps.some(s=>s.kind==='test')&&plan.steps.at(-1).kind==='preview';
}
