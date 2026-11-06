# Execution record

Plan: docs/plan.md. Spec: docs/product.md.

- Preflight: empty workspace; Node 24.20.0, npm 11.12.0, Git and authenticated GitHub CLI verified. No ancestor AGENTS.md found.
- Decision: dedicated new repository is the isolation boundary; no existing branch/worktree is touched. User explicitly authorises public GitHub creation and ongoing pushes.
- Decision: native Windows commands replace POSIX skill helper scripts. This file retains progress in the deliverable repository.
- Preflight interfaces: shared model → store/API → React client; API payloads and revision fields are shared. Enhanced export/import consumes the same validated model.
- Milestone 1 complete: repository created and first push confirmed at a17b352, before implementing the application.
- Milestone 2: domain and HTTP tests ran red before backend implementation. Implemented transactional SQLite lifecycle, assignment invariants, revision conflicts and deterministic queue projections.
- Test investigation: Node 24 fetch replaces custom Host headers on the wire (verified with a standalone HTTP echo server). The Host-rejection test now uses node:http to exercise the real header; no production workaround was needed.
- Milestone 2 complete: 6/6 tests and TypeScript passed; bda50f7 pushed and remote SHA verified.
- Milestone 3: production build and 6/6 tests passed. Browser exercised creating an empty session, adding a skilled volunteer, checking in an item, assigning it, completing the outcome, reloading, and reading the persisted record in the journal. Test session and visitor are explicitly fictional.
- Browser QA found that the narrow layout needs a session switcher; this is included in the enhancement pass. The core lifecycle is working.
- Milestone 3 complete: 24c295b pushed after successful browser lifecycle verification.
- Milestone 4: backup/restore and CSV tests ran red, then all 10 tests passed. Restores remap identities and preserve originals, validate cross-record invariants, and reject malformed payloads. CSV export escapes formulas and quotes multiline fields. Added responsive session switching and a human-controlled queue planning window. Production build passed.
- Fresh review completed against 4d53637: no critical findings; three important issues identified (portable size consistency, follow-up notes after completion, and stale remembered-session recovery). All three were fixed with regression coverage and browser checks.
- Review ruling: printed event identity is important because ticket numbers restart in every session; added title, date and venue to avoid ambiguous take-home records. Follow-up forms clear only after successful saves to avoid duplicate notes; failed saves retain input.
- Portability policy: one 8 MiB transport limit, a conservative UTF-8 storage budget enforced inside each mutation transaction, and shared limits of 250 volunteers, 2,000 tickets, 10,000 activity entries and 20,000 note characters per ticket. Full sessions reject a new change without losing prior data. Restores preserve the exact title/history and remap IDs, with no extra activity that could overflow a full backup.
- Regression evidence: note overflow and volunteer overflow reproduced as missing rejections; a valid >5 MiB archive reproduced HTTP 413 before the fix. After fixes, large archives restore over HTTP, UTF-8 growth stops at the portable budget, repeated full-session restores preserve history, simulated write failure rolls back, and stale session IDs select an available session.
- Final review pass: 16/16 automated tests, strict TypeScript including unused symbols, and production build passed. Fresh reviewer did not test actual printer output, screen readers or browser responsiveness; those evidence boundaries remain explicit.
