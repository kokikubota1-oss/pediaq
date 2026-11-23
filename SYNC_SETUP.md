# PediaQ Cross-Device Sync / 端末間同期の導入

This feature is implemented in source but is INACTIVE until a Supabase project is created and configured. Do not claim that the published PediaQ currently syncs history before completing setup and testing.

## One-time setup / 最初の設定
1. Create a Supabase project at https://supabase.com/dashboard and open its SQL Editor.
2. Run the SQL in `supabase/schema.sql` once. This creates an event-based history table and per-question preferences, with user-level Row Level Security.
3. Under Authentication > Providers > Google, enable Google sign-in using your Google Cloud OAuth client ID and secret. Follow https://supabase.com/docs/guides/auth/social-sign-in/auth-google . Set Google's Authorized redirect URI to the Supabase Auth callback shown in the provider configuration.
4. Under Supabase Authentication > URL Configuration, set Site URL to `https://kokikubota1-oss.github.io/pediaq/` and add the same URL as an allowed redirect URL.
5. Copy the Supabase Project URL and **publishable/anon key only** into `config.js`. These are intentionally public values; the service_role key must NEVER be placed in GitHub Pages.
6. Deploy. On the Progress or Settings tab, choose Sign in with Google on each device.
7. On the FIRST device, accept the explicitly displayed import prompt to upload the pre-existing local history to your own account. On other devices, sign in with the same Google account and allow the data to load. Verify an answer, confidence rating and excluded-question state synchronize in both directions.

## Safety / 安全
- Local history is never deleted as part of syncing. A browser backup is made before switching accounts or declining first-time import.
- Existing browser history stays available offline.
- Sync stores answer choices, correct/incorrect, confidence, timestamps and excluded questions. It does NOT upload patient notes or medical records.
- RLS only permits a signed-in user to read/write their own history. Do not disable it.
- Cloud config remains disabled until all fields are entered; the app still works locally.
- Export local history from the Progress tab before changing devices or clearing browser data.

## Known limits / 制約
- Supabase account creation, Google provider credentials and SQL execution require the project owner; the GitHub connector cannot do those actions.
- A network connection and the Supabase JS library CDN are required for cloud functions.
- This is an eventual-consistency synchronization model. Two devices simultaneously changing the same rating or exclusion may need a second sync cycle.
- Legacy history is stored in localStorage and belongs to the browser profile until imported. For shared browsers, sign out and clear data according to your privacy preferences.
- Supabase free-tier capacity and suspension rules are governed by Supabase's current service terms.
