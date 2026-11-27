export function authorize(action, context = {}) {
  const allowed = new Set(['inspect', 'plan', 'test']);
  if (!context.projectId || !context.actorId) return { allowed: false, reason: 'missing_scope' };
  if (!allowed.has(action)) return { allowed: false, reason: 'approval_required' };
  if (context.paid !== false) return { allowed: false, reason: 'paid_disabled' };
  return { allowed: true, reason: 'read_or_local_test' };
}
