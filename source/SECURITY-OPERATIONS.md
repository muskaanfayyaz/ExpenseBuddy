# ExpenseBuddy — Security and Operations Notes

## Authentication and passwords

- Sign-in is delegated to AppDeploy Authentication through `auth.getUser`, `auth.signInWithRedirect`, and `auth.signOut`.
- The application does not collect, store, log, or hash student passwords itself. Password hashing, credential storage, token issuance, and token refresh are responsibilities of the configured identity provider. Do not add password fields or store credentials in ExpenseBuddy records.
- Every data API route uses `requireAuth()`. Protected API calls use the AppDeploy client, which attaches the authenticated bearer token.

## Student data isolation

- Every data table is derived from the authenticated `ctx.user.userId`; the client cannot supply an owner ID.
- User IDs are validated as UUIDs before being used to form table names. Record IDs are only looked up inside the authenticated student's table.
- Transaction categories are checked server-side against the built-in set and the authenticated student's custom categories.
- Financial amounts, calendar dates, month values, required text fields, and category attributes are validated on the backend.

## Performance and record limits

- Bootstrap reads the student's record collections concurrently and reads the single profile by known key rather than scanning the profile table.
- Dashboard aggregations and category/chart series are memoized in the React client.
- Writes are guarded against concurrent duplicate clicks in the UI.
- The current bootstrap implementation reads at most 500 records per collection. If a collection has another page, the application displays a warning; totals and reports must not be treated as complete until pagination is implemented or the account is reviewed. Budget alert evaluation also refuses to mark thresholds when more than 500 transactions exist.
- A sub-three-second page-load target has not been benchmarked under representative production load. Measure real authenticated cold and warm loads before claiming that SLA.

## Backup and restoration

- ExpenseBuddy uses AppDeploy's persistent database, not browser local storage or in-memory state.
- No automated database backup schedule, retention policy, point-in-time recovery, or restore operation is configured by this application. The AppDeploy database SDK reference available during this release does not expose a backup/restore API. Do not describe this deployment as having verified backups.
- CSV exports are reporting exports, not complete restorable backups: they do not include all categories, budgets, profile fields, and savings goals. Exported CSV files should be stored securely, but they are not a substitute for a database snapshot.
- For a suspected data-loss incident, stop making further writes, record the app ID and approximate incident time, and contact AppDeploy support to ask whether a platform-level restore point exists. If no restore point is available, rebuild transaction records from retained CSV reports and manually recreate budgets, categories, profile details, and savings goals. Validate monthly totals after recovery.
- Before production use with important financial records, obtain confirmation from the platform operator about database backup frequency, retention, encryption, and recovery-time objectives.

## Verification status for this release

- Deployment status: ready after the latest source changes are deployed.
- AppDeploy deployment QA smoke snapshots should be reviewed for frontend, backend and network errors; a clean smoke snapshot is not proof that every functional test passed.
- Responsive source changes include local table scrolling, narrow-screen layout adjustments, keyboard focus indicators, and reduced-motion support. Automated visual snapshots are not a full device/browser compatibility certification.
- `tests/tests.json` contains seven end-to-end test specifications spanning authentication, all finance modules, exports, authorization, responsive behavior, record limits and operational recovery. These are test plans; do not report them as executed unless the test runner returns individual results.
- Chrome, Firefox, and Edge were not each manually exercised. The 3-second load target was not measured. Cross-user IDOR tests require two real test accounts to execute.
- Password changes and conventional email/password registration are not supported by the current AppDeploy auth SDK. ExpenseBuddy uses provider-managed passwordless email and supported identity providers. The application never collects or stores student passwords.
- Automated database backup/restore remains unconfigured and unverified.
- Local calendar helpers use the browser's local timezone for month and date defaults; monthly report CSV export is scoped to the selected month.
- Backend duplicate and in-use category/budget checks fail closed when a database collection has more than 500 records and the first page is incomplete.
