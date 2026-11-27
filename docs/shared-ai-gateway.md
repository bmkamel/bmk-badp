# Shared AI gateway — integration gate

Discovery: Cloudflare worker bmk-smart-erp-dev has Groq, OpenRouter and Gemini secret bindings (five names each). No values retrieved. Existing /api/ai/dev-run requires verified Supabase session; /api/ai/provider-smoke is explicitly gated. Neither is approved as a BADP service endpoint. Supabase ERP has no deployed Edge Functions.

## Required service contract (proposed, not deployed)
- Dedicated machine identity, separate from ERP user sessions and database roles.
- Dedicated authenticated endpoint; no ERP data access or service-role key.
- Only explicitly approved public prompts; no repository credentials or private source.
- Server-enforced free model allowlist, atomic project and provider quotas, bounded input/output, no paid fallback, no key rotation to evade limits.
- Fail closed until provider account free status and cloud budget are verified.
- Audit request IDs and outcomes without prompt or credential logging.
- Separate trusted deployment and rollback review; preserve all existing worker bindings.
- Test synthetic requests first, then one approved free live request.

## Status
Discovery completed; endpoint and identity not provisioned. No production change or live provider call. Do not use ERP administrator credentials for BADP.
