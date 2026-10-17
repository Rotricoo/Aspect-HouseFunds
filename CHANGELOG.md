# Changelog

All notable changes to Aspect - House Funds are documented here.

## [0.3.3] - 2026-10-17

### Added

- Fictional browser demo with local browser persistence and reset support.
- GitHub Pages deployment workflow and repository quality checks.
- Guided five-step household onboarding with progress and review.
- Explainable dashboard balance breakdown.
- Simple and detailed financial accounting views with filters and CSV export.
- Data-quality review section in the financial report.
- Local backup privacy guidance and restore validation for schema compatibility.
- Architecture overview and local-first decision record.

### Improved

- Dynamic household members, payment sources, settlement groups and categories.
- Accessibility focus handling, error announcements and reduced-motion support.
- Empty states that teach the next action.
- Backup and export labels now use the public product name.

### Security

- Reject backups from newer schema versions.
- Validate required tables and managed attachment bundles before restore.
- Updated development dependencies to resolve the reported `source-map-js` vulnerability.
