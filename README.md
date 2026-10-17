# Aspect - House Funds

Aspect - House Funds is a local-first desktop application for recording household purchases, shared funds, recurring commitments and settlements. It explains not only who should pay, but how the result was calculated.

It is built as a portfolio project with a focus on clear financial records, configurable household data and maintainable application structure.

## Features

- Configurable household members with archive and history-safe deletion.
- Custom payment sources for shared and personal money.
- Settlement groups for households with different financial arrangements.
- Purchases with item ownership, shared splits and receipt attachments.
- Categories, recurring bills and recurring contribution plans.
- Financial reports showing shared funds, personal advances and future pay-later commitments.
- Explainable settlements that connect responsibility, advances, shared funds and future commitments.
- Financial-source awareness for shared cash, shared accounts, personal accounts and pay-later commitments.
- Settlement snapshots and an audit log for recorded financial events.
- Local SQLite storage with backups and managed attachments.
- Fictional demo data for portfolio demonstrations.

## Technology

- React 19 and TypeScript
- Vite
- Tauri 2
- Rust
- SQLite through the Tauri SQL plugin
- SCSS with component-oriented BEM-style naming
- Vitest, Oxlint and Prettier

## Getting started

### Requirements

- Node.js 20 or newer
- npm
- Rust and Cargo
- Tauri system dependencies for your operating system

Install the frontend dependencies:

```bash
npm install
```

Start the desktop application:

```bash
npm run tauri:dev
```

Start the browser demo:

```bash
npm run dev
```

The browser demo uses fictional data and local browser storage for portfolio previews. It does not provide SQLite persistence, backups or local attachments. The desktop application remains the complete local-first experience.

The demo is intentionally safe to explore: all displayed people, purchases and amounts are fictional, and changes stay in the current browser. Use the **Reset demo** action in the banner to restore the starting scenario.

### GitHub Pages demo

The repository includes a GitHub Actions workflow at `.github/workflows/deploy-web-demo.yml`. After enabling GitHub Pages with the **GitHub Actions** source, pushes to `main` build and publish the browser demo automatically.

## Quality checks

Run the complete frontend validation suite:

```bash
npm run check
```

This runs linting, unit tests, TypeScript validation, a production build and formatting checks.

Run the Rust tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

The test suite currently covers pure financial logic, React interactions for onboarding and core forms, SQLite integrity rules, transaction rollback and a complete settlement workflow. The SQLite integration tests use an in-memory database with the production migrations.

GitHub Actions runs the frontend and Rust quality checks on pushes to `main` and on pull requests. The Pages workflow is kept separate so deployment only publishes a build that has passed the repository checks.

The browser demo focuses on the portfolio experience and uses local browser storage. The desktop application uses SQLite and native file APIs for the complete local-first experience. Visual end-to-end tests for the full product therefore need a native Tauri/WebDriver runner rather than a browser-only Playwright test. This keeps the test strategy honest and avoids testing a fake runtime.

## Architecture

The application follows a simple data flow:

```text
SQLite migrations and repositories
          ↓
      App state
          ↓
       React UI
          ↓
 financial reports and persistence actions
```

SQLite is the source of truth. Reference data such as members, payment sources, settlement groups and categories is loaded from the database instead of being duplicated in frontend constants.

More detail is available in [the architecture overview](docs/architecture.md) and [the local-first decision record](docs/decisions/0001-local-first.md).

## Portfolio walkthrough

In five minutes, a reviewer can see:

1. The problem: shared household spending becomes difficult to explain when people use different payment sources and contribution arrangements.
2. The solution: configurable household reference data, explainable settlement calculations and a data-quality review surface.
3. The engineering: React and TypeScript UI, Rust/Tauri commands, SQLite migrations, repository boundaries and transactional writes.
4. The evidence: frontend interaction tests, in-memory SQLite integration tests, a complete settlement workflow and GitHub Actions CI.
5. The trade-offs: local-first privacy and reliability are prioritised over accounts, cloud sync and encrypted remote storage.

## Privacy and demo data

The repository contains no real names, receipts, financial records, personal documents, database files or private Git history. The migrations use fictional demo data only.

Attachments and SQLite databases are created in the local application data directory when the desktop app runs. They are not stored in the repository.

### Local data and backups

- The desktop app stores household records in a local SQLite database. No account, cloud database or server is required.
- Backups can contain the complete database, financial history, audit records and managed attachments. Treat exported `.db` files and CSV ledgers as sensitive personal data.
- Backups are not encrypted at rest by the application. Use an encrypted disk, protected operating-system account or trusted encrypted storage when handling them.
- Restoring a backup validates SQLite integrity, checks for the required Aspect - House Funds schema, rejects databases from a newer schema version and verifies that referenced attachment bundles are present.
- Before replacing the active database, the application keeps a local recovery copy. Restore files only from a trusted location and verify the result after the application reloads.
- The browser demo contains fictional data only and saves changes in the current browser's local storage. It does not access the desktop SQLite database or local attachments.

## Roadmap

- Add a monthly review mode for open commitments, unsettled balances and source checks.
- Add native Tauri/WebDriver coverage for the main financial workflow.
- Improve platform-specific packaging and release documentation.
- Add optional import/export for household data.
- Explore multi-household profiles and encrypted sync without weakening the local-first model.

## Project status

This is an active portfolio project. The core data model, dynamic household setup, financial reporting flows, browser demo and accessibility foundations are implemented. The next focus is release packaging and native end-to-end coverage.
