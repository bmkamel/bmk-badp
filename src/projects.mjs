export function projectAccess(actor, projectId, action) {
  if (!actor || typeof projectId !== 'string' || !projectId || !Array.isArray(actor.memberships)) return false;
  const membership = actor.memberships.find(m => m.projectId === projectId);
  const roles = { viewer: ['read'], developer: ['read','plan','test'], owner: ['read','plan','test','manage'] };
  return Object.hasOwn(roles, membership?.role) && roles[membership.role].includes(action);
}
