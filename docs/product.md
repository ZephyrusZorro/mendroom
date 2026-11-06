# Mendroom product brief

## Purpose and audience

Help the volunteer at a community repair event's welcome desk coordinate people and items without juggling paper tickets and a spreadsheet. The valuable complete flow is event → volunteers → item intake → compatible assignment → repair outcome → take-home record and export.

## Decisions made under delegated autonomy

Build a local desktop-browser application using React/TypeScript, Express, Zod, and Node 24's built-in SQLite module. A dedicated new repository isolates this project from all existing user work. The user explicitly requests continuous execution and milestone pushes; no intermediate approval gates are needed. Use the authenticated user's public GitHub repository with genuine milestone commits.

Considered a cloud multi-user service (requires identity, hosting and personal-data operations), a browser-only app (simpler, but weak portable backups), and a loopback server with SQLite. Select the last for reliable persistence, zero credentials, transactions and complete local ownership. Node SQLite remains experimental on Node 24; this is disclosed and version constrained.

## Core requirements

- Create/select multiple sessions with date, venue and duration; start empty.
- Optional clearly labelled fictional sample session, kept separate from real sessions.
- Volunteer roster with skill categories and availability. A volunteer handles at most one active repair.
- Item intake: visitor first name or alias, item, issue, category, estimated duration and optional coordinator review hold. Minimise personal data.
- Queue ordered by intake; search and status filters. Server validates assignment, skills, availability and review hold.
- Explicit repair transitions: queued → in progress → repaired / unrepairable / waiting for parts. Waiting for parts may rejoin the queue. Outcomes require meaningful notes.
- Explainable suggestions and indicative capacity estimates, never a guaranteed appointment. No repair advice, electrical certification, or automated safety diagnosis.
- Detailed history, editable repair notes and printable take-home record.
- Enhanced release: parts follow-up, portable JSON backup/restore with transactional validation, safe CSV reporting, session summary.
- Responsive warm editorial interface with forest-green accents, high-contrast controls, keyboard access, accessible dialogs, reduced motion and useful empty/error states.

## Data and security

SQLite tables for sessions, volunteers, tickets and activity. Foreign keys and prepared statements. Mutations are atomic and optimistic updates use record revisions to reject stale writes. Strict payload limits and Zod schemas; no arbitrary SQL or file paths from clients. Bind only to 127.0.0.1; reject cross-origin writes and unexpected Host headers. No network sharing, login or public deployment in this release. Database and exports contain private local data and are never committed. No external fonts, analytics, APIs or assets required at runtime.

## Success and verification

A new user creates a real session, adds a volunteer, checks in an item, assigns, completes and reloads the record. Data survives server restart. Test incompatible/busy assignments, malformed input, stale updates, holds, state transitions, backup round trips, rollback, CSV formula escaping and cross-origin rejection. Typecheck and production build pass; inspect the main journey in a browser at desktop and narrow widths. Verify remote Git commit equality after milestone pushes.

## Non-goals

Payments, public bookings, unsafe repair instructions, messaging, SaaS accounts, claimed CO2 savings, and invented impact statistics. Market demand and time savings remain hypotheses until organisers try it.
