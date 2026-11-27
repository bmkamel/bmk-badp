// Free-only routing. Provider capabilities must be verified by server configuration.
export function chooseModel(providers, task) {
 if (!Array.isArray(providers) || typeof task !== 'string') return null;
 return providers.find(p => p && p.enabled === true && p.costClass === 'free' && Array.isArray(p.tasks) && p.tasks.includes(task))?.id ?? null;
}
