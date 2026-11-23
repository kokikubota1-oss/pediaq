# PediaQ automated learning pipeline / 自動学習パイプライン

## What is already implemented / 実装済み
- GitHub Actions schedules a daily run at 18:15 UTC (03:15 JST).
- The generator produces one bilingual pediatric or Eiken Grade 1 question.
- The generator first searches Wikimedia Commons for four separately licensed and credited images (one per choice). If coverage is insufficient, it attempts AI manga generation as a fallback; a new question must have either four attributed online images or its dedicated manga.
- Approved, de-identified topics in `inbox/approved_topics.json` are consumed first.
- Quiz answers and excluded questions are currently stored in browser localStorage.

## What is not yet automated / 未実装
- Automatic access to all ChatGPT conversations: GitHub Actions has no authorized ChatGPT chat-history API integration.
- Automatic clinical verification against current guidelines and editorial review.
- Image backfill for the 29 legacy questions without dedicated illustrations; legacy questions are preserved and show a placeholder when no matching artwork is available.
- Cross-device answer-history synchronization and authentication.
- Automatic recovery or retry after failed image generation.

## Security / 安全性
Never commit patient names, medical record numbers, birth dates, exact admission dates, or identifying clinical details to this public repository. Only add approved and adequately de-identified learning topics. Never commit OPENAI_API_KEY; configure it as a GitHub Actions repository secret. Set an API usage budget and monitor usage.

## Approved topics / 承認済みトピック
Add an object to `inbox/approved_topics.json`:
```json
[
  {
    "topic": "Distinguish corroborate from substantiate in a clinical context",
    "domain": "Eiken1",
    "approved": true,
    "source": "user-approved learning topic"
  }
]
```
The next daily run prioritizes an approved unprocessed topic. Do not paste raw ChatGPT conversations or patient notes into this file.

## Verification / 検証
Run `python scripts/validate_questions.py` to verify IDs, bilingual options, and published manga assets. The workflow checks this on pull requests and pushes to main. Existing legacy questions without manga are reported but not silently deleted; new AUTO questions must always have a real manga asset.

## Activation / 有効化
1. Confirm `OPENAI_API_KEY` is set under GitHub repository Actions secrets. This cannot be read or set by this connector.
2. Ensure GitHub Actions has write access to repository contents and that branch protection permits the workflow's push.
3. Manually run the daily workflow once from the GitHub Actions UI and inspect logs and API billing.
4. Confirm a new AUTO question and comic image appear in the repository and the public website.

## Proposed next milestone / 次の開発段階
Add an authenticated backend for per-user review history, a consent-based learning-note intake endpoint, editorial validation, and image generation backfill. Keep private learning data out of GitHub Pages.

## Online image policy / ネット画像の方針
Commons images are dynamically linked by their Wikimedia thumbnail URL and displayed alongside author, license, and source page. Only image metadata clearly marked as CC0, public domain, CC BY, or CC BY-SA is eligible. Automated keyword relevance is not a medical accuracy check; misidentified images may occur and require editorial QA. Images can disappear or change at the origin, so a reliable long-term deployment should locally cache appropriately attributed assets after license verification. Do not use generic web-search thumbnails without permission.
