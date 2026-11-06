# Mendroom implementation plan

> Execute inline with test-first implementation and a fresh whole-project review before release.

**Goal:** Deliver a working local repair-event coordinator and push meaningful milestones throughout.
**Architecture:** React client → same-origin Express API → transactional SQLite store; shared TypeScript contracts and pure matching logic.
**Stack:** Node 24, TypeScript, React, Vite, Express, Zod, SQLite, node:test.
**Spec:** docs/product.md.

## Global constraints

Local loopback only; no credentials; no runtime external APIs; ignored private data; explicit sample labels; real milestone pushes. New isolated repository; work on its default branch as the sole initial author under user-authorised continuous publishing.

## Review focus

1. Reloads and server restart preserve data.
2. Concurrent stale edits return conflict instead of losing data.
3. Incompatible/busy volunteers and review holds block assignments.
4. Malformed imports roll back without losing existing sessions.
5. Cross-origin writes and formula-bearing CSV values remain safe.

## Milestones

- [ ] 1. Foundation: commit brief, research, configuration and this plan; create public repository and push before app implementation. Install dependencies.
- [ ] 2. Domain and backend: write/run failing domain and HTTP tests; implement `forecast(tickets, volunteers)`, `Store` and `createApp(store)` with shared schemas; confirm tests pass; push persistent API and queue engine.
- [ ] 3. Complete workbench: build session/roster/intake/assignment/outcome UI against API; verify typecheck, build and browser main journey; push usable core.
- [ ] 4. Enhanced workflows: write/run failing backup/restore/CSV tests; implement validated portable backup, reporting, print handover and parts follow-up; pass suite; push enhancement.
- [ ] 5. Review and release: fresh review, regression fixes, security and responsive QA, actual server restart, production startup, README/screenshots/CI; push final release and verify remote commit and CI.

Every milestone updates docs/progress.md with commands, observations and deviations. UI presentation is verified through real browser interaction; core invariants use deterministic automated tests.
