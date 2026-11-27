# R1 API contract draft
All endpoints except health require verified server-side identity. Never accept memberships or actor identity from client payloads.
GET /health — minimal service status.
GET /api/projects — membership-filtered list.
POST /api/projects — owner-level creation, audited.
GET /api/projects/:id/jobs — scoped list.
POST /api/projects/:id/jobs — scoped enqueue, idempotency key required.
POST /api/projects/:id/messages — scoped conversation, no implicit execution permission.
POST /api/jobs/:id/approve — independent approval, scoped and audited.
Errors: 400 invalid, 401 unauthenticated, 403 denied, 404 inaccessible resource, 409 conflict, 429 quota. No secrets in responses.
