# R0 autonomous-development vertical slice

This slice is deliberately limited to an inert, static application tree under `app/`. A prompt moves through an explicitly configured free-cost model adapter, a validated plan, complete validated patch sets, a fresh virtual filesystem, static checks, a persisted preview artifact, and then the `review` gate. It never deploys, mutates a repository, accepts secrets, follows external URLs, or executes generated JavaScript.

## Durable state

`development_runs` carries the current stage, repair count, and optimistic revision. `development_events` records every successful state transition. Migration `0006_execution_artifacts.sql` stores the plan, full patch sets, test results, failure marker, and preview payload in the isolated BADP D1 database. A transition uses a revision-guarded update plus conditional event insert in one D1 batch; stale writers fail closed. The runner can resume from a persisted stage, but requires an external single-runner guarantee; there is no lease or automatic scheduler yet. An interrupted stage may repeat a model call.

## Bounded recovery

Only a failing static test may enter `repair`. The existing state machine allows at most two repairs; the third failure becomes `blocked`. Invalid model output, illegal paths, an executor contract failure, or an absent preview all become a persisted failure and `blocked` state.

## Model configuration

Worker inference is disabled. Merely setting a model's cost class to free does not enforce a billing cap: on a paid Workers plan, inference beyond the free allocation can incur charges. Before enabling inference, verify the account's actual plan, free model eligibility, and enforceable limits. No resource, secret, binding, route, or deployment is created by this change.

## Preview boundary

The preview artifact is stored data. The authenticated run preview endpoint returns the entrypoint HTML with a restrictive CSP sandbox, no network or scripts, and no caching. It does not yet serve separate CSS or other files. The R0 executor validates the `app/` tree and checks title and main landmarks. A later isolated build runner and asset-serving design remain necessary for interactive applications. Regex checks are not an HTML security boundary; the response CSP is essential.
