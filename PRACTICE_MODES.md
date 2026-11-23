# PediaQ v1.2 practice modes / 演習モード

All modes retain the existing `pediaq-pwa-progress-v1` answer history and Supabase synchronization. Session plans are saved separately in `pediaq-practice-session-v1` in the local browser.

## Modes / モード
- Scheduled (定時演習): Japan local clock slots 07:00, 12:00, 22:00. Each date/slot produces a stable 30-question plan. Reopening PediaQ in a later slot loads the new slot's plan if the current mode is Scheduled. A URL with `?session=07:00`, `?session=12:00`, or `?session=22:00` selects that slot.
- Random (ランダム): fresh 30-question random sample each time the mode button is pressed, with no duplicate question IDs within the session.
- Weak areas (弱点復習): prioritize incorrect answers, low confidence, and questions due under the existing spaced-repetition intervals.
- By subject (分野別): limit the questions to one clinical domain, all pediatrics, or Eiken1.

For mixed sessions, the target composition is 22 pediatric and 8 Eiken1 questions. The existing bank contains 30 pediatric and 10 English questions, so 30-question mixed sessions are currently possible before exclusions. Narrow domains (e.g. infectious diseases) may have fewer than 30 unique questions; the app explicitly shows the actual count instead of repeating questions.

## What is synced / 同期範囲
- Every answer still writes to the original `history` object and triggers the same Supabase upload as before.
- Confidence ratings and exclusions still use the existing history schema.
- Session plan, cursor and within-session completion markers are saved to the current browser only. They are NOT yet synced across devices; cross-device answer history is synced.
- Refreshing the same browser resumes the same random/weak/subject session. Scheduled mode changes to the current slot upon reopening after a slot transition.
- PediaQ does not send its own push notifications and does not open itself in the background. Existing separate ChatGPT quiz automations remain separate.

## Verification
Run `node tests/practice.test.js`. This checks 30 unique questions, 22/8 allocation, deterministic schedules, random selection, weak-area priority, domain restriction, exclusions and Japan-time slot calculations.
