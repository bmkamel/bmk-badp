# R0 threat model (draft)

Trust boundaries: browser/API, API/project registry, orchestrator/model provider, orchestrator/isolated runner, runner/external service. Repository text and model outputs are untrusted.

| Threat | Required control | Verification |
|---|---|---|
| Cross-project access | Server-side membership check on every resource | Negative tenant tests |
| Prompt injection | Tool allowlist; untrusted data cannot authorize actions | Adversarial tests |
| Credential leakage | Scoped secrets outside source; redact logs | Secret scanning |
| Budget overrun | Atomic reservations, provider caps, deny unknown cost | Concurrent reservation tests |
| Supply chain | Pin dependencies/actions, review changes | CI scan |
| Destructive actions | Independent approval, backups, rollback | Restore drill |

Current policy and budget functions are prototypes, not enforcement boundaries. No external execution or paid model calls enabled.
