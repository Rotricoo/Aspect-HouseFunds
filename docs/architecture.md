# Architecture overview

Aspect - House Funds uses a local-first desktop architecture. The browser demo reuses the React presentation layer with fictional data and browser storage, while the installed app connects the same UI to SQLite through Tauri.

```text
React components
      ↓
Application hooks and action handlers
      ↓
Repositories and application services
      ↓
Tauri commands
      ↓
SQLite migrations and local files
```

## Main boundaries

- `src/components/` contains user-facing screens and forms.
- `src/hooks/` coordinates state, persistence feedback and workflows.
- `src/database/` contains repository access and transaction boundaries.
- `src/utils/` contains pure calculations, formatting and validation.
- `src-tauri/src/` contains native commands, backup handling and attachment storage.
- `src-tauri/migrations/` defines the SQLite schema and fictional starting data.
- `src/demo/` provides the browser-only fictional demo runtime.

## Financial flow

1. A user records a purchase, contribution or financial movement.
2. The UI action handler validates the input and persists it through a repository or Tauri command.
3. SQLite remains the source of truth for the desktop app.
4. `createCurrentFinancialReport` derives member, group and source positions from persisted records.
5. The dashboard and settlement views explain the derived result rather than storing a manually edited balance.

## Safety boundaries

- Historical records prevent destructive deletion of referenced members, sources and categories.
- Settlement-group writes use transactions so partial updates roll back.
- Backup restore validates SQLite integrity, schema compatibility, required tables and attachment bundles before replacing the active database.
- Attachments and databases stay outside the repository and are excluded by `.gitignore`.
