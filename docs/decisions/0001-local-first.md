# ADR 0001: Keep the desktop product local-first

Status: Accepted

## Context

Household finance records are sensitive. The product also needs to work for a household without requiring an account, a server or a network connection.

## Decision

The installed application stores its primary data in a local SQLite database and keeps managed attachments in the operating system application-data directory. Backups are explicit local files, and the product does not encrypt them at rest.

The browser experience is a separate fictional demo. It uses local browser storage and never accesses the desktop database or attachments.

## Consequences

Positive consequences:

- No mandatory account or cloud service.
- Fast offline workflows.
- Clear ownership of household data.
- SQLite transactions and migrations can be tested locally.

Trade-offs:

- Users are responsible for protecting their device and backup files.
- There is no built-in multi-device synchronisation.
- Native Tauri testing is required for the complete product because browser tests cannot provide SQLite and file APIs.

Future sync or encryption work must preserve the local-first default and must be introduced as an explicit product decision.
