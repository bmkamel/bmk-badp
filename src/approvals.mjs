export function validateApproval(request, approval, now) {
 return Boolean(request && approval && request.id && request.projectId && request.actorId && request.digest && approval.requestId === request.id && approval.projectId === request.projectId && approval.digest === request.digest && approval.actorId && approval.actorId !== request.actorId && approval.authorized === true && approval.decision === 'approve' && Number.isFinite(now) && Number.isFinite(approval.expiresAt) && now < approval.expiresAt);
}
