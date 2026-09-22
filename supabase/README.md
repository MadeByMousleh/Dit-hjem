# Supabase setup status

The migration is prepared locally. It has not been applied to a Supabase project.

## Manage migrations from this repository

All schema, index, grant, and RLS changes belong in timestamped SQL files under
`supabase/migrations/`. Commit these files alongside application changes. Do not
edit a migration after it has been applied; create a new migration instead.

One-time setup from the repository terminal:

```sh
npm run db:login
npm run db:link
```

Login authorizes the CLI with your Supabase account. Link reads the project
reference from `SUPABASE_URL` in `.env` (or `SUPABASE_PROJECT_REF` for a custom
domain). If prompted, supply the database password, not the Supabase API key.
For noninteractive use, the CLI accepts `SUPABASE_ACCESS_TOKEN` and
`SUPABASE_DB_PASSWORD` from your local `.env`; never commit them.

Normal workflow:

```sh
npm run db:new -- add_consumption_indexes
# Edit the generated SQL file in supabase/migrations/.
npm run db:status
npm run db:plan
npm run db:migrate
```

`db:plan` lists pending migrations without applying them; it does not execute
SQL to validate its correctness. `db:migrate` applies pending migrations to the
linked remote database. Supabase tracks applied versions in its migration-history
table. Database changes are explicit terminal operations, not part of the Vercel
build or app startup. No reset/drop command is included in these npm scripts.

The existing household migration is the first migration to apply. No SQL Editor
copy/paste is required. Project API keys alone cannot authorize CLI migrations.

## Intended configuration

- Free project, in a specific EU region (Frankfurt if available).
- Vercel continues hosting the frontend and backend.
- Supabase Auth identifies users. The backend must verify the session and
  household membership before using the server's Eloverblik credential.
- Create the initial household and membership through a trusted administrative
  operation; never automatically give every new user the server-token household.
- Backend credentials remain in Vercel environment variables, never Expo public
  variables. Eloverblik refresh tokens are not stored in these tables.

## Database design

Readings are unique per meter, timestamp, and resolution. Imports should upsert
corrected readings and record successful ranges transactionally. Keep resolutions
separate to avoid counting hourly and daily readings twice. Sync ranges distinguish
unfetched dates from dates fetched with no readings. Refresh recent or incomplete
ranges; reuse older readings and allow explicit refresh for later corrections.

Anonymous roles have no table access. Authenticated users have read-only access
to their own memberships, households, meters, and readings through row-level
security. Only the trusted backend can provision memberships or import data.
The service role bypasses RLS: backend membership checks remain mandatory.

## Required before deployment

1. Connect the Supabase account and select/create the Free EU project.
2. Apply the migration and test anonymous, member, and unrelated-user access.
3. Configure login redirect URLs for the existing Vercel site.
4. Implement login, backend authorization, and database-backed consumption reads.
5. Configure the initial owner and link only their household to the server token.
6. Test repeat imports, duplicate prevention, corrections, and account isolation.

The existing deployed Eloverblik endpoint is not secured by merely applying this
migration. Its application authorization still needs implementation before this
setup can be described as complete. Retention/export/deletion behavior and the
providers' processing agreements also need review before supporting other users.
