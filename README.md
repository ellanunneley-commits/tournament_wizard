# Tournament Wizard

A multi-tournament volleyball app: pool play, a 16-team bracket, live point-by-point scoring, standings, announcements with countdowns, a master schedule with timing, paid team entry through Stripe, and a per-tournament app fee.

This repository is a copy of the app's own code, exported from Glide. It is built to run on Glide (the sign-in, hosting and database are provided there), so it will not run standalone without changes.

## What is here

- apps/tournament-wizard/server.ts - the API (Hono). Every tournament route lives under /app-api/t/:tid.
- apps/tournament-wizard/lib - standings, bracket advance, fees, scoring rules, automatic announcements, tournament creation.
- apps/tournament-wizard/routes - money (entries, fees, Stripe webhook), live scoring, announcements.
- apps/tournament-wizard/client - the React pages and components (React Router 7, TanStack Query, Tailwind).
- schema.sql - the database tables.
- package.json - the extra packages the app needs.

## Not included

- The standard UI components (Button, Card, DataTable, Dialog and so on) that Glide installs into client/components when the app builds.
- apps/tournament-wizard/auth.ts - the sign-in helper Glide injects at build time.
- No keys or secrets. The app reads DATABASE_URL from its environment. Each tournament keeps its own Stripe signing secret in the database (tournaments.stripe_webhook_secret).

## Roles

- App owner: a row in app_owners. Sees every tournament and the fees owed; records payments and can waive a tournament's fee.
- Organizer: a row in organizers for one tournament. Runs the tournament and sees its money.
- Scorekeeper: a row in scorekeepers. Can score any match live.
- Team captain: the person whose email is on a paid registration. Can score matches their team refs.
- Guest: an email a captain invited (viewers). Read-only.

## Rules built in

- Sand: one set to 21, win by 2. Court or grass: best of 3 sets to 25, win by 2, third set to 15, win by 2.
- App fee: 100 dollars flat per tournament plus 10 percent of the entry fees. A tournament opens to teams once the flat fee is paid or waived.
