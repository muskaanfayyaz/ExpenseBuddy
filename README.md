# ExpenseBuddy

A student-focused personal finance and monthly budgeting application. ExpenseBuddy helps students record expenses and income, manage month-by-month budgets, understand spending patterns, and track savings goals.

## Contents

- [Features](#features)
- [Technology](#technology)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Authentication and privacy](#authentication-and-privacy)
- [Financial calculations](#financial-calculations)
- [Testing and verification](#testing-and-verification)
- [Known limitations](#known-limitations)
- [Operations and recovery](#operations-and-recovery)

## Features

### Student account
- Sign in through AppDeploy Authentication using the configured email verification/passwordless flow or available identity providers.
- Complete first-time student profile onboarding.
- View and update profile name, institution, and preferred currency.
- Restore the provider-managed session and sign out.

### Transactions
- Create, view, edit, search, filter, and delete expense and income records.
- Store title, amount, category, date, and description.
- Filter by category, transaction type, date range, and amount range.
- Review transaction history and individual transaction details.

### Categories
- Built-in expense categories: Food, Transportation, Education, Shopping, Entertainment, Healthcare, Accommodation, Utilities, and Other.
- Built-in income categories: Allowance / Salary and Freelance.
- Create and manage student-specific custom categories.
- Backend validation checks that a transaction uses a category of the correct type.

### Monthly budgets
- Create and edit a separate budget for each calendar month.
- View spending, remaining budget, and utilization.
- Display normal, approaching-limit, and exceeded states.
- Evaluate 75%, 90%, and 100% thresholds and persist alert history to avoid duplicate notifications.
- Alert-state writes use a versioned conditional update with bounded retries for concurrent evaluations.

### Dashboard and insights
- Monthly expense and income summaries.
- Budget progress and transaction counts.
- Monthly spending trends, category breakdowns, and income-versus-expense visualizations.
- Previous-month spending comparison.
- Dashboard figures are derived from the signed-in student's stored records, not fabricated sample transactions.

### Savings, reports, and settings
- Create and manage savings goals and track saved amounts against targets.
- Export monthly transaction reports as CSV.
- Open the printable report view for PDF saving through the browser's print dialog.
- Manage profile preferences and review account-security information.

## Technology

- React 19 and TypeScript
- Vite 6
- Tailwind CSS 3 and application-specific CSS
- Lucide React icons
- AppDeploy Authentication and AppDeploy persistent database
- AppDeploy frontend client: @appdeploy/client
- AppDeploy backend SDK: @appdeploy/sdk

The AppDeploy client and backend SDK are supplied by the AppDeploy runtime. They are platform integrations and are intentionally not declared as ordinary npm dependencies in package.json.

## Architecture

The project is a React/Vite single-page application with an AppDeploy backend.

### Main source paths

| Path | Responsibility |
| --- | --- |
| src/App.tsx | Main application UI, state, navigation, dashboard calculations, and API interactions |
| src/index.css | Global styles, responsive layout, and component styling |
| src/main.tsx | React application entry point |
| backend/index.ts | Authenticated API routes, validation, database reads/writes, and budget alerts |
| backend/realtime.ts | Realtime backend integration |
| backend/realtime-subscribers.ts | Realtime subscription support |
| appdeploy.auth-login.json | Hosted authentication methods and sign-in screen configuration |
| tests/tests.json | End-to-end test specifications |
| SECURITY-OPERATIONS.md | Security, data limits, backup caveats, and operational recovery notes |
| package.json | Frontend dependencies and npm scripts |
| vite.config.ts | Vite build configuration |

### Backend API

The backend exposes a health endpoint, an authenticated bootstrap endpoint, record CRUD endpoints, and a budget-alert endpoint.

- GET /api/health
- GET /api/bootstrap
- GET /api/records/:kind
- POST /api/records/:kind
- PUT /api/records/:kind/:id
- DELETE /api/records/:kind/:id
- POST /api/budgets/:id/alerts

Data routes require an authenticated AppDeploy identity. The backend derives the data owner from the verified request identity; it does not accept a client-supplied owner ID.

### Data partitioning

Each student's records are stored in separate database tables derived from the authenticated AppDeploy user UUID. The record groups are transactions, categories, budgets, goals, and profile. The profile uses a fixed record key within that student's own profile table.

The application uses AppDeploy's persistent database. Browser state is used for presentation and interaction, not as the primary financial record store.

## Getting started

### Requirements

- An ExpenseBuddy AppDeploy project and access to its deployment environment.
- Node.js and npm for a local Vite workflow.
- Access to the AppDeploy Authentication and database integrations configured for the project.

### Install dependencies

From the project root:

~~~bash
npm install
~~~

### Start the Vite development server

~~~bash
npm run dev
~~~

The application depends on AppDeploy-provided frontend and backend integrations. A plain standalone Vite server without those integrations and a configured AppDeploy identity/database environment is not a complete substitute for the deployed application.

### Build for production

~~~bash
npm run build
~~~

### Preview the production build

~~~bash
npm run preview
~~~

The package scripts are defined in package.json. Deployment and backend execution are managed by AppDeploy.

## Authentication and privacy

- Sign-in is delegated to AppDeploy Authentication.
- The configured login methods are email, Google, Apple, and X; actual availability is controlled by the AppDeploy environment.
- Email sign-in is passwordless/provider-managed in the current integration.
- ExpenseBuddy does not collect, store, log, or hash student passwords.
- Credential storage, password hashing where applicable, identity verification, token issuance, and session management belong to the identity provider.
- Password changes and conventional application-managed email/password registration are not implemented in ExpenseBuddy because the current SDK integration does not expose those operations.
- Protected backend routes use requireAuth().
- The backend derives each student's table names from the authenticated user UUID and validates the UUID before constructing table names.
- Profile email is sourced from the authenticated identity, not trusted from a client-supplied email field.
- Backend validation checks transaction amounts, dates, required text, category ownership/type, budget month and amount, goal values, and supported profile currencies.

Do not add password fields or store credentials in ExpenseBuddy records. Use the identity provider's account controls for any credential operation it supports.

## Financial calculations

For the selected month:

- Total expenses = sum of expense transactions dated in that month.
- Total income = sum of income transactions dated in that month.
- Remaining budget = configured monthly budget minus total expenses.
- Budget utilization = total expenses divided by the monthly budget, multiplied by 100.
- Savings-goal progress is based on the saved amount relative to the target.

If no monthly budget exists, the application displays an unconfigured-budget state rather than treating an absent budget as a configured zero-value budget.

Calendar date defaults and month selection use the browser's local timezone. Monthly CSV reporting is scoped to the selected month.

## Testing and verification

End-to-end scenarios are documented in tests/tests.json. They cover:

1. Authentication, onboarding, session restoration, and logout.
2. Expense/income and category lifecycle, validation, search, and filters.
3. Monthly budgets, calculations, threshold alerts, and dashboard charts.
4. Reports, savings goals, profile, and settings.
5. Backend authorization, data isolation, and input validation.
6. Responsive layout, reliability, and compatibility regression.
7. Historical record limits, performance measurement, and operational recovery.

These entries are test specifications, not proof that every scenario has passed. A deployment-ready status or clean smoke snapshot does not replace individual end-to-end execution. Record test-run results separately when the AppDeploy test runner or manual QA session executes them.

Before release, verify at minimum:
- Sign-in and sign-out with a real QA identity.
- CRUD and persistence after reload for each financial record type.
- Budget calculations and all three alert thresholds.
- Two-account authorization and IDOR attempts using separate test identities.
- Responsive behavior at mobile, tablet, and desktop widths.
- Current Chrome, Firefox, and Edge.
- Cold and warm authenticated load times under a documented test environment.

## Known limitations

- Password changes and application-managed email/password registration are not supported by the current authentication integration.
- Bootstrap currently reads up to 500 records per collection. If another page exists, the app warns that the loaded history is incomplete; totals and reports must not be treated as complete until pagination is implemented or the account is reviewed.
- Budget alert evaluation refuses to calculate thresholds when the transaction collection exceeds the available first page.
- A sub-three-second load-time target has not been benchmarked under representative production load.
- Chrome, Firefox, and Edge have not each been manually certified.
- Cross-student penetration testing requires two real QA identities and must be executed to claim a pass.
- Automated database backup scheduling, retention, point-in-time recovery, and restore are not configured by this application. Confirm platform-level backup and recovery capabilities with AppDeploy before relying on ExpenseBuddy for critical financial records.
- CSV exports are reporting files, not full database backups; they do not contain all profile, category, budget, and savings-goal state.

## Operations and recovery

Read SECURITY-OPERATIONS.md before production use. It documents the current authentication model, data partitioning, collection limits, backup status, and a recovery approach for suspected data loss.

For a suspected data-loss incident:
1. Stop further writes to the affected account where practical.
2. Record the AppDeploy app ID and approximate incident time.
3. Contact AppDeploy support to ask whether a platform restore point is available.
4. If no restore point exists, use retained CSV reports to reconstruct transaction history and manually recreate categories, budgets, profile details, and savings goals.
5. Reconcile monthly totals after recovery.

CSV reports should be stored securely and should not be considered a substitute for a database snapshot.

## License

No license is specified in this repository. Add a LICENSE file and update this section if the project is distributed under a particular open-source or commercial license.
