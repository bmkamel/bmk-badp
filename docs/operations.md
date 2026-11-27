# Operations draft
No production deployment until identity, tenant checks and audit persistence are implemented.
Use isolated BADP resources; never reuse existing project databases. Verify billing and quota before provisioning. Paid model calls remain disabled.
Deployment: review PR, run CI, test migrations against disposable database, deploy preview, verify health, then approve production separately.
Rollback: retain prior Worker version; use forward-compatible migrations and tested backups. Do not execute destructive migrations automatically.
Incident response: suspend job dispatch, revoke affected credentials, preserve audit evidence, verify recovery.
