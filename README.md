# Tournament Wizard

A multi-tournament volleyball app: pool play, a 16-team bracket, live point-by-point scoring, standings, announcements with countdowns, a master schedule with timing, paid team entry through Stripe, and a per-tournament app fee.

The app started as an export from Glide and now runs on its own: Cloudflare Workers for hosting, Neon (Postgres) for the database and Clerk for email sign-in.

## Run it on your computer

1. Install Node.js (version 22 or newer) and Postgres.
2. Create a database and load the tables: `createdb tw` then `psql -d tw -f schema.sql`.
3. Make yourself the app owner: `psql -d tw -c "insert into app_owners (email) values ('you@email.com')"`.
4. Copy `.env.example` to `.env` and set `DATABASE_URL`.
5. `npm install`, then `npm run dev`, and open the address it prints.

Without Clerk keys the app uses a test sign-in: type any email to act as that person.

## Put it online

1. Create a Neon database and run `schema.sql` in its SQL editor.
2. Create a Clerk app with email-code sign-in. Under Sessions > Customize session token, add `{ "email": "{{user.primary_email_address}}" }`.
3. `npx wrangler login`, then `npx wrangler secret put DATABASE_URL` and `npx wrangler secret put CLERK_SECRET_KEY`.
4. Put `VITE_CLERK_PUBLISHABLE_KEY` in `.env`, then `npm run deploy`.

## What is here

- apps/tournament-wizard/server.ts - the API (Hono). Every tournament route lives under /app-api/t/:tid.
- apps/tournament-wizard/auth.ts - who is signed in (Clerk, or a test sign-in when developing).
- apps/tournament-wizard/lib - standings, bracket advance, fees, scoring rules, automatic announcements, tournament creation.
- apps/tournament-wizard/routes - money (entries, fees, Stripe webhook), live scoring, announcements.
- apps/tournament-wizard/client - the React pages and components (React Router 7, TanStack Query, Tailwind).
- schema.sql - the database tables.
- package.json - the packages the app needs and the commands to run it.
- wrangler.jsonc - Cloudflare Workers settings. vite.config.ts - the build, and the local test server.

No keys or secrets are kept in the code. Each tournament keeps its own Stripe signing secret in the database (tournaments.stripe_webhook_secret).

## Roles

- App owner: a row in app_owners. Sees every tournament and the fees owed; records payments and can waive a tournament's fee.
- Organizer: a row in organizers for one tournament. Runs the tournament and sees its money.
- Scorekeeper: a row in scorekeepers. Can score any match live.
- Team captain: the person whose email is on a paid registration. Can score matches their team refs.
- Guest: an email a captain invited (viewers). Read-only.

## Rules built in

- Sand: one set to 21, win by 2. Court or grass: best of 3 sets to 25, win by 2, third set to 15, win by 2.
- App fee: 100 dollars flat per tournament plus 10 percent of the entry fees. A tournament opens to teams once the flat fee is paid or waived.
