# Login and household onboarding

The app requires a session before mounting the dashboard. One session provider is shared by all screens. `ensure_my_household` provisions one household for a verified user without existing memberships, and preserves invited/existing memberships. It accepts no user or household parameters. Creating an account never attaches existing electricity meters.

Energy readings and agreements reference an opaque household UUID. Account email stays in Auth; `household_members` holds the restricted identity mapping. This is pseudonymization, not anonymization. Operators with privileged database access can still resolve the relationship. No new identity logging is introduced.

## Email delivery blocker

On 2026-09-21, the hosted configuration push rejected custom OTP email templates with: "Email template modification is not available for free tier projects using the default email provider. Please upgrade your plan or configure a custom SMTP provider."

The app therefore retains the existing email-link flow until delivery is configured. Code verification is implemented, but do not advertise code-only login yet. For native app login without browser redirects:

1. Configure a custom SMTP sender in Supabase (or enable a plan that supports the templates). Verify sender credentials privately; never place SMTP passwords in EXPO_PUBLIC variables.
2. Run `node --env-file-if-exists=.env scripts/supabase-auth-config.mjs push`. Both confirmation and magic-link templates must apply successfully.
3. Test delivery and code verification for an existing account and a new account on a physical phone.
4. Set `EXPO_PUBLIC_AUTH_EMAIL_OTP_ENABLED=true` in the app build environment and rebuild. Native builds also need the deployed `EXPO_PUBLIC_API_URL`.

Database verification: `node --env-file-if-exists=.env node_modules/supabase/dist/supabase.js db query --linked --file scripts/test-household-onboarding.sql`. Fixtures run in a rolled-back transaction.

This change does not implement self-service meter authorization, account deletion, migration of legacy local profile/device preferences to the database, or store publication. New households can save electricity agreements immediately; actual readings still require an authorized meter connection. Those remain separate release work.
