# R0 autonomous-development vertical slice

This slice is deliberately limited to an inert, static application tree under `app/`. A prompt moves through an explicitly configured free-cost model adapter, a validated plan, complete validated patch sets, a fresh virtual filesystem, static checks, a persisted preview artifact, and then the `review` gate. It never deploys, mutates a repository, accepts secrets, follows external URLs, or executes generated JavaScript.

## Durable state

`development_runs` carries the current stage, repair count, and optimistic revision. `development_events` records every successful state transition. Migration `0006_execution_artifacts.sql` stores the plan, full patch sets, test results, failure marker, and preview payload in the isolated BADP D1 database. A transition uses a revision-guarded update plus conditional event insert in one D1 batch; stale writers fail closed.

## Bounded recovery

Only a failing static test may enter `repair`. The existing state machine allows at most two repairs; the third failure becomes `blocked`. Invalid model output, illegal paths, an executor contract failure, or an absent preview all become a persisted failure and `blocked` state.

## Model configuration

The Worker activates runs only when all of these are present: `ENABLE_DEVELOPMENT_RUNS=true`, a D1 binding, an AI binding, `FREE_MODEL_COST_CLASS=free`, and `FREE_MODEL_ID`. There is no default model and no paid fallback. The model identifier must be checked against the provider's current free tier before setting these values. No resource, secret, binding, route, or deployment is created by this change.

## Preview boundary

The preview artifact is stored data, not a public URL. The R0 executor accepts only HTML/CSS/JS/JSON/Markdown files below the `app/` tree, requires a local `app/index.html`, and checks for a title, a `<main>` landmark, no scripts in the entrypoint, no external references, and no `fetch`. A later, explicitly approved R3 executor can replace this with a dedicated isolated build runner while preserving the same runner interface and durable state contract.
