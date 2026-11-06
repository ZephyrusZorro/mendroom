# Release verification — 6 November 2026

## Automated checks

| Check                       | Observed result                              |
| --------------------------- | -------------------------------------------- |
| Dependency installation     | Successful; clean npm ci also passed in CI   |
| Strict TypeScript           | Passed, including unused symbols             |
| Automated tests             | 16 passed, 0 failed                          |
| Production build            | Passed, Vite 8.3.6                           |
| Production dependency audit | 0 known vulnerabilities at verification time |
| Windows and Ubuntu CI       | Both passed on Node 24                       |
| Production startup          | Healthy at http://127.0.0.1:4317             |

[Successful CI for implementation commit 8993a6a](https://github.com/ZephyrusZorro/mendroom/actions/runs/42227284537). Audit results are time-specific, not a security guarantee.

## Browser evidence

The production build was opened in the in-app browser. All verification records are fictional.

- Created an empty session, added a volunteer, checked in an item, assigned it and saved a repaired outcome. Reloaded and found the result in the journal.
- Stopped and restarted the actual production server. Health returned OK and all three sample/verification sessions remained. The completed record and its notes were visible after reload.
- Downloaded a real JSON backup, selected it through the browser file picker, restored it separately and inspected the copied queue. That earlier enhancement used a restored-title suffix; final regressions pin the revised exact-title/history policy.
- Downloaded a real CSV report.
- Recorded missing parts, confirmed the volunteer was released, and returned the ticket to the queue.
- Released a coordinator hold with a fictional verification note and observed the assignment panel appear.
- Added a follow-up to a completed repair. Notes and history updated; the textarea value was verified empty after success.
- Switched sessions at phone width. Checked native dialog focus and Escape dismissal.
- Inspected 1440 × 1000 desktop and 390 × 844 phone viewports. Document widths of 1425 and 375, including scrollbar allowance, showed no horizontal overflow.
- Final browser error log was empty. Temporary viewport overrides were reset and the app tab retained as a deliverable.

Screenshots contain fictional sample data: [desktop](screenshots/desktop.jpg), [phone](screenshots/mobile.jpg).

## Review and regressions

A fresh read-only reviewer checked 4d53637, ran tests and probed the API. Three important issues were fixed: writes could create an unrestorable backup, follow-up UI was absent after completion, and an old remembered session blocked opening another database.

Regressions observed missing rejection of note/volunteer overflow and HTTP 413 for a valid large backup before correction. Final tests verify >5 MiB restore over real HTTP, UTF-8 size rejection with rollback, repeated full restores preserving history, rollback after an injected SQLite write failure and recovery from a missing remembered session.

Printed event identity was treated as important because ticket numbers restart by session. Title, date and venue now appear in the rendered record and its test. Follow-up forms clear only after successful saves. No review findings remain intentionally deferred.

## Evidence boundaries

- Fictional browser workflows do not establish live-event adoption or time savings.
- Responsive inspection and basic keyboard checks do not establish all-device or screen-reader accessibility.
- Print styling and record identity are implemented; actual printer output and pagination were not tested.
- Local persistence is verified; power-loss recovery, encryption, multi-user operation and production hosting are not.
- The reviewer did not independently observe browser rendering or a process restart; those are separate author checks above.
- No carbon, revenue, adoption or model-comparison claims are made.
