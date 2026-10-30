# RIVORA

RIVORA is a responsive car-care platform built with Next.js, TypeScript, and PostgreSQL. It includes the public website, a role-based customer and staff portal, operational workflows, RIVORA Club, and member parking and car marketplaces.

## Run locally

Requirements: Node.js 20.9 or newer and PostgreSQL 14 or newer.

1. Create a PostgreSQL database for the app.
2. Copy `.env.example` to `.env`. Set `DATABASE_URL` to the database connection string and `AUTH_SECRET` to a unique random secret of at least 32 characters. Configure `EMAIL_OTP_WEBHOOK_URL` and `EMAIL_OTP_WEBHOOK_SECRET` for production email verification; local development prints OTP codes only to the server console.
3. Install the locked dependencies with `npm ci`.
4. Apply database migrations with `npm run db:migrate`.
5. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` (12-72 UTF-8 bytes), then run `npm run db:seed` to provision the administrator. Optionally set both `WORKER_EMAIL` and `WORKER_PASSWORD` to provision a field professional. The seed script refuses to change an existing account to a different role.
6. Start the site with `npm run dev`.

Open `http://localhost:3000`. Public availability requests are stored as inquiries and are not confirmed bookings. Customers can register and use `/portal`; staff accounts are created by the seed command or administrator workflows.

## Portal coverage

- Customers: vehicle records, memberships, eligible service bookings, payment references, support requests, profile, notifications, and service history with protected completion photos.
- Workers: assigned service jobs, status/proof updates, issue reporting, and attendance.
- Administrators: membership and service configuration, communities, scheduling and booking assignment, customer and worker management, scoped staff permissions, platform feature controls, payment reconciliation, public enquiries, support, moderation, reports, and audit history.
- RIVORA Club: member posts, reactions, privacy controls, message requests and messaging, blocks, and reports.
- Marketplaces: parking listings with owner bid review and rental requests; car listings, enquiries, and saved cars.

## Useful commands

```bash
npm run lint
npm run typecheck
npm run build
npm run db:migrate
npm run db:seed
npm run db:seed:demo
```

`db:seed:demo` is for local testing only. It publishes demo plan prices (Discovery INR 1,999, Signature INR 2,999, Privilege INR 5,999) and creates sample appointments and marketplace records; these are not approved production prices or customer data.

## GitHub and deployment

The GitHub Actions workflow runs lint, TypeScript, and production-build checks for pushes and pull requests. It uses CI-only placeholder environment values and does not connect to a database or run migrations.

Keep `.env` local: `.gitignore` excludes environment files and build/dependency output while allowing the safe `.env.example` template. Never commit production credentials, database dumps, or customer data. Configure real environment variables in the deployment host, run migrations against the intended database, and create the administrator there. This app requires a Node.js server and PostgreSQL; it is not a static GitHub Pages site.

## Production and blueprint decisions

Customer accounts use expiring, rate-limited email OTP verification. In production, configure a trusted HTTPS email webhook; local development prints verification codes to the server console. Marketplace and worker proof images are stored in PostgreSQL as private/member-scoped JPEG, PNG, or WebP assets (5 MB per image); video uploads and Club post media are not implemented. Payments are not connected to a payment provider: customer references remain pending until staff reconcile them. Demo prices must be replaced with approved prices, and community verification policy, final legal wording, tax invoice details, retention policy, and messaging-channel providers still require product decisions. Payment receipts are printable but are not tax invoices. Public legal/policy summaries are pre-launch information, not final legal terms.

Before production, use managed PostgreSQL with backups, configure secret management and TLS, deploy behind appropriate rate limiting and monitoring, select payment and media providers, confirm legal/privacy requirements, and test operational recovery.
