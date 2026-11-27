export function d1Store(db) {
 return {
  async projects(actorId) { return (await db.prepare('SELECT p.id,p.name FROM projects p JOIN memberships m ON m.project_id=p.id WHERE m.actor_id=? ORDER BY p.id LIMIT 100').bind(actorId).all()).results; },
  async member(actorId,projectId) { return Boolean(await db.prepare('SELECT 1 AS allowed FROM memberships WHERE actor_id=? AND project_id=?').bind(actorId,projectId).first()); },
  async jobs(actorId,projectId) { return (await db.prepare('SELECT j.id,j.status,j.created_at FROM jobs j JOIN memberships m ON m.project_id=j.project_id WHERE m.actor_id=? AND j.project_id=? ORDER BY j.created_at DESC LIMIT 100').bind(actorId,projectId).all()).results; }
 };
}
