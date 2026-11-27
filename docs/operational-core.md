# Operational core — phase 1
Engineering principle: choose the best evidenced standards, technology and solutions, not automatic agreement. Prefer simple, tested, reusable components and zero unapproved additional charges. Retain R0–R6 identifiers; group delivery into operational core, coding runner, integrations, and governed self-improvement.

Local first: Ollama on a dedicated 8 GB laptop; one inference at a time operationally. Aider primary candidate and OpenCode additional candidate, both subject to benchmarks. Reuse ERP provider code only after inspecting its source, license, data boundaries and quota rules; no secrets copied. Cloud providers remain disabled until verified free-only and privacy controls exist.

This branch adds a local loopback-only adapter and a CLI demo using the existing static sandbox and memory store. Install Ollama separately, run ollama pull qwen2.5-coder:3b, then node scripts/local-demo.mjs "Create an offline static page". No generated code is executed, no files are published, no cloud request is made by the adapter, and no production configuration is changed. Disable Ollama cloud features and verify the local model is installed before running. The demo uses volatile state; it is not a persistent local agent. Do not treat static checks as a security sandbox for arbitrary executable code.

Acceptance: mocked transport tests must pass; real local inference, memory usage, quality, restart recovery, agent isolation, credential separation, quota enforcement and independent CI still require verification. No automatic merge or deployment.
