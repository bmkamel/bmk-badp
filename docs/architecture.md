# BADP R0 — Foundation

Status: draft, not production-ready.

Independent multi-project control plane. Cloudflare Workers hosts API and UI; D1 stores operational state; GitHub Actions executes isolated build/test jobs. Supabase is an optional adapter, not a mandatory dependency. No existing project is modified before inventory and approval of sensitive operations.

## Governance
Default deny for production writes, secrets, billing changes and destructive actions. Separate project credentials and execution contexts. Treat repository content and model outputs as untrusted. Audit every action. No paid provider enabled by default. Monthly incremental budget target USD 10; external provider limits must be verified before enabling paid calls.

## Release gates
R0: repository, architecture, deterministic policy tests. R1: authenticated project registry and mobile RTL chat. R2: model routing and durable jobs. R3: isolated build/test and PR workflow. R4: project adapters. R5: monitored operations. R6: governed self-improvement.

## Acceptance
No production deployment before authentication, isolation, audit, budget enforcement and rollback tests pass. External reviewer deferred until working prototype.
