#!/usr/bin/env bash
set -euo pipefail
# Synthetic fixture only. Never pass repository files or secrets to this test.
image="${BADP_SMOKE_IMAGE:-node:22-bookworm-slim}"
docker image inspect "$image" >/dev/null
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --user 65534:65534 --pids-limit 64 --memory 256m --cpus 1 --tmpfs /tmp:rw,noexec,nosuid,size=16m "$image" node -e '
const assert=require("node:assert/strict");
const fs=require("node:fs");
const net=require("node:net");
assert.equal(process.getuid(),65534);
assert.throws(()=>fs.writeFileSync("/badp-probe","x"));
assert.equal(process.env.GITHUB_TOKEN,undefined);
assert.equal(process.env.GROQ_API_KEY,undefined);
assert.equal(process.env.OPENROUTER_API_KEY,undefined);
assert.deepEqual(Object.keys(require("node:os").networkInterfaces()).sort(),["lo"]);
const socket=net.connect({host:"192.0.2.1",port:443});
socket.setTimeout(1500);
socket.on("connect",()=>{socket.destroy();process.exitCode=1;});
socket.on("error",()=>{console.log("synthetic isolation checks passed");});
socket.on("timeout",()=>{socket.destroy();console.log("synthetic isolation checks passed");});
'
