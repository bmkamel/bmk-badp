#!/usr/bin/env bash
set -euo pipefail
# Only a fixed synthetic fixture; no model output or repository mount.
image="${BADP_SMOKE_IMAGE:?set approved image digest}"
[[ "$image" =~ ^(docker\.io/library/)?node@sha256:[a-f0-9]{64}$ ]] || exit 2
docker image inspect "$image" >/dev/null
BADP_SMOKE_IMAGE="$image" bash "$(dirname "$0")/cloud-isolation-smoke.sh"
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --user 65534:65534 --pids-limit 64 --memory 256m --cpus 1 --tmpfs /tmp:rw,noexec,nosuid,size=16m "$image" node -e '
const fs=require("node:fs"), assert=require("node:assert/strict"), cp=require("node:child_process");
const p="/tmp/fixture.cjs";
fs.writeFileSync(p,"module.exports = n => n + 1;");
assert.equal(require(p)(1),2);
fs.writeFileSync(p,"module.exports = n => n + 2;");
cp.execFileSync(process.execPath,["--check",p],{timeout:3000});
delete require.cache[require.resolve(p)];
assert.equal(require(p)(1),3);
assert.deepEqual(fs.readdirSync("/tmp"),["fixture.cjs"]);
console.log("synthetic replacement verified");
'
