# PediaQ cross-device synchronization / 端末間同期

## Backend status as of 2026-11-23
- Supabase project **PediaQ** created in Tokyo (`ap-northeast-1`) with $0/month quoted project creation cost.
- Project ref: `rcwddzaljmxaaphnjjzf`.
- Two RLS-protected tables `public.pediaq_attempts` and `public.pediaq_preferences` have been created and verified.
- Public project URL and **publishable key** are connected in `config.js`. No secret/admin key is committed.
- Cloud login UI supports email magic links and Google OAuth (Google provider needs separate owner-side setup).
- Email and Google login have not yet been tested end-to-end; cross-device history synchronization is not yet verified.

## Required one-time Auth URL configuration / 認証URLの設定
Open https://supabase.com/dashboard/project/rcwddzaljmxaaphnjjzf/auth/url-configuration
- Set **Site URL** to `https://kokikubota1-oss.github.io/pediaq/`
- Add **Redirect URL** `https://kokikubota1-oss.github.io/pediaq/`
- Save.

Then open https://kokikubota1-oss.github.io/pediaq/ and select **記録 / Progress**, enter an email address, and select **メールでログイン / Email sign-in**.
After clicking the link sent by Supabase Auth, return to PediaQ and accept the optional old-history import from the device with your most complete old progress.
Use the same email login on another device and verify the test answer appears.

## Google sign-in (optional) / Googleログイン
If you prefer one-tap Google login, configure the Google provider through Supabase Authentication > Providers > Google and a Google Cloud OAuth client.
See https://supabase.com/docs/guides/auth/social-login/auth-google
Only the account owner can authorize Google Cloud credentials; never paste them into the public repository.

## Security and limitations
- Only question IDs, answers, correctness, confidence, timestamps and exclusions are synced. No clinical notes or patient identifiers.
- The old browser history is retained locally. Export it from Progress for an extra backup before migrating.
- Anon users have no table permissions, and authenticated users are restricted by `auth.uid() = user_id` policies.
- Both online devices can edit; synchronization is eventual, with per-attempt event IDs and timestamps.
- Authentication and cross-device behavior require real user browser testing.
- API billing is separate from the $0/month project quote.
