# R0 autonomous-development vertical slice

This slice is deliberately limited to an inert, static application tree under `app/`. A prompt moves through an explicitly configured free-cost model adapter, a validated plan, complete validated patch sets, a fresh virtual filesystem, static checks, a persisted preview artifact, and then the `review` gate. It never deploys, mutates a repository, accepts secrets, follows external URLs, or executes generated JavaScript.

## Durable state

`development_runs` carries the current stage, repair count, optimistic revision, and a short-lived lease. `development_events` records transitions. Artifacts store plans, patches, test results, and preview payloads. The runner acquires a lease and renews it at each stage; conditional artifact and state writes fence a worker whose lease expired or was replaced. An interrupted stage may repeat a model call, and a call running beyond the 120-second lease can overlap its replacement; results from the expired owner cannot be committed. No automatic scheduler is included. These semantics need verification in the real D1 runtime before use.

## Bounded recovery

Only a failing static test may enter `repair`. The existing state machine allows at most two repairs; the third failure becomes `blocked`. Invalid model output, illegal paths, an executor contract failure, or an absent preview all become a persisted failure and `blocked` state.

## Model configuration

Worker inference is disabled. Merely setting a model's cost class to free does not enforce a billing cap: on a paid Workers plan, inference beyond the free allocation can incur charges. Before enabling inference, verify the account's actual plan, free model eligibility, and enforceable limits. No resource, secret, binding, route, or deployment is created by this change.

## Preview boundary

The preview artifact is stored data. The authenticated run preview endpoint returns the entrypoint HTML with a restrictive CSP sandbox, no network or scripts, and no caching. It does not yet serve separate CSS or other files. The R0 executor validates the `app/` tree and checks title and main landmarks. A later isolated build runner and asset-serving design remain necessary for interactive applications. Regex checks are not an HTML security boundary; the response CSP is essential.
