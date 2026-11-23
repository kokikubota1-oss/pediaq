# PediaQ v1.3 Secure Web Push / 定時プッシュ通知

## Status
- Supabase project: `rcwddzaljmxaaphnjjzf` (Tokyo).
- `public.pediaq_push_subscriptions` table created with row-level security (RLS) restricting each signed-in user to their own device subscriptions.
- `pediaq_internal` schema holds the VAPID private key, HMAC cron secret, and send-claim log. These values are NOT in GitHub or public web configuration.
- Deployed `pediaq-send-push` Supabase Edge Function. It uses a time-limited HMAC-signed invocation, checks the scheduled slot and blocks duplicate job claims. It does not rely on publicly exposed cron keys.
- pg_cron jobs active: `0 22 * * *` (07:00 JST), `0 3 * * *` (12:00 JST), `0 13 * * *` (22:00 JST). Cron uses GMT in this project, while payload dates use Asia/Tokyo.
- The sender uses the pinned `@mmmike/web-push@1.5.0` library and limits push endpoints to recognized push-service hosts. A delivery log records outcomes, not study history.
- Auth/RLS table permissions and invalid signature rejection verified. Automated PWA tests must pass before merge. No physical device has yet subscribed; a real push delivery is unverified until the user opts in.

## One-time setup on each device
1. Sign in to PediaQ using the same Google/email account as the study history.
2. Open `設定 / Settings`, under `定時プッシュ通知 / Scheduled push notifications`.
3. Select 07:00, 12:00, and/or 22:00 and tap `通知を有効化 / Enable notifications`; allow notifications.
4. To change times, check/uncheck the slots and tap `時間を保存 / Save times`.
5. To stop, tap `この端末で停止 / Disable on this device`.

For iPhone, install the PWA via Safari's Share > Add to Home Screen and open it from the icon. iOS 16.4 or later supports Web Push for installed web apps. Android requires browser/OS push support. Mac supports Web Push in compatible browsers with notification permission.

## Behavior and limitations
- Each subscription belongs to a browser profile/device, not to a shared global switch.
- A received notification contains a link like `https://kokikubota1-oss.github.io/pediaq/?session=07%3A00&date=2026-11-23&start=1`.
- Tapping the notification opens the selected date/time's deterministic 30-question session at question one. The original answer history stays intact; the notification only resets in-session cursor and answers for that displayed session.
- The push cannot make a locked phone automatically open PediaQ without a tap: operating systems disallow this.
- Push timing is best-effort and may be delayed by browser power saving, network conditions, or provider policies.
- A paused Supabase free-tier project may not dispatch scheduled notifications.
- The browser requires an active Supabase login when enrolling; existing answers and confidence ratings still use the original independent sync process.
- End-to-end delivery must be checked on real registered devices; a deployed function and an active cron job alone do not guarantee browser delivery.

## Security
- Never publish VAPID private keys, the cron HMAC secret, or `SUPABASE_SERVICE_ROLE_KEY`.
- Do not relax the push-subscription RLS policies or grant authenticated users access to private schema tables or service-role-only RPCs.
- The Edge Function is marked `verify_jwt=false` solely because its invocation is authenticated using a private HMAC (validated by a privileged, service-only database RPC); unsigned external calls are rejected.
- Push endpoints and their encryption keys are sensitive device-related data, protected by RLS. They are not clinical records.
- Supabase Security Advisor may report unrelated account password-protection warnings; monitor these separately.

## Verification
`node tests/practice.test.js && node tests/push.test.js` in the repository.
After enrolling a device, inspect `public.pediaq_push_subscriptions` and next scheduled `pediaq_internal.push_delivery_log` outcome through an administrator account, and confirm the notification opens the correct 30-question set.
