# BADP engineering queue
The authenticated dashboard submits a typed owner request to D1. The scheduled GitHub-hosted worker claims one item with an expiring lease and retries at most three times. The first two work orders are a system-aware dashboard theme and a keyboard shortcut. They modify only `preview/chat-page.mjs`. The latter is queued automatically after the first deployment has been verified.

## Research and decision record
- MDN, color-scheme property, consulted 2026-11-28. It documents how operating-system theme preference and native control rendering interact. BADP uses that preference and preserves RTL. The executor checks the source marker before generating the patch. https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme
- GitHub, GITHUB_TOKEN and event rules, consulted 2026-11-28. GitHub suppresses a normal push trigger for automation-token commits. Dispatch the existing deployment workflow explicitly and check the resulting Worker revision. https://docs.github.com/en/actions/concepts/security/github_token
- Cloudflare, coding agents in sandboxes, consulted 2026-11-28. Its proxy design keeps secrets outside agent workspaces. Reuse that boundary rather than adopting a new hosted agent runtime for this typed lane. https://developers.cloudflare.com/sandbox/coding-agents/

## Operating boundaries
The trusted code generates the change. Task text cannot supply shell commands, Git ref names, credentials, or candidate source. Repository regression tests run as a separate step without publication credentials. Publication rechecks the allowed path, exact content, signed-out deployment smoke tests, PR head and immutable source revision. Reviews of open-ended model-generated diffs remain a separate capability.

Disable the engineering workflow or set repository variable `BADP_ENGINEERING_PAUSED=true` to stop new claims. Queued tasks expose pause/resume in the dashboard. GitHub concurrency serializes workers. A failed deployment verification retains its PR and merge SHA for recovery and never labels the task verified. The existing deployment operator can restore a previous Worker deployment when needed. The Git branch remains subject to repository protections.
