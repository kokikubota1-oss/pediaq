# PediaQ daily automation / PediaQ日次自動化

## What this version actually does / 実装済み

- Runs a GitHub Actions workflow at approximately 03:15 Japan time daily (GitHub scheduling can be delayed).
- Creates ONE new bilingual advanced pediatric or Eiken Grade 1 question per day from a curated topic or an explicitly approved de-identified topic in `inbox/approved_topics.json`.
- Calls the OpenAI text API and image API, generates an original four-panel image, and only publishes a question if both question validation and image generation succeed.
- Commits the new question and comic to `main`. GitHub Pages then publishes automatically using the existing Pages configuration.
- Retains existing device-local answer history and excluded-question state.

## First-time setup / 初回設定

1. Extract this ZIP and upload ALL files, including the hidden `.github` directory, into the ROOT of the existing `pediaq` repository. GitHub's web uploader can have difficulty with hidden folders: use GitHub's **Add file → Create new file** to create `.github/workflows/pediaq-daily.yml` and paste its contents if necessary; use the web uploader for the other files. Do not upload the ZIP itself.
2. GitHub repository → Settings → Secrets and variables → Actions → New repository secret → name `OPENAI_API_KEY`, value your own OpenAI API key. Never paste this key into a chat or commit it to the public repository. API billing is separate from ChatGPT Plus.
3. Repository → Settings → Actions → General → Workflow permissions → select **Read and write permissions** if required by your repository's configuration. Prefer the workflow's `permissions: contents: write` and least-privilege configuration.
4. Repository → Actions → PediaQ daily question and manga → Run workflow. Check logs and `questions.json` for a new `AUTO-...` entry and `comics/AUTO-....png`. Failed jobs must not publish an incomplete question.
5. Open the live GitHub Pages URL and refresh. A previously installed PWA may need a hard refresh or reopening due to service-worker caching.

## Approved ChatGPT notes / 承認済みチャット内容

GitHub Actions CANNOT directly access your private ChatGPT history. Add only sanitized topics to `inbox/approved_topics.json`:

```json
[
  {"topic":"Interpretation of HHV-6 CSF PCR and ciHHV-6 in a hypothetical pediatric case","domain":"Pediatrics","approved":true},
  {"topic":"Distinguish corroborate, substantiate and verify in Eiken Grade 1 usage","domain":"Eiken1","approved":true}
]
```

The daily job consumes one approved topic at a time and marks it processed. This is an explicit approval queue, not full automatic ChatGPT conversation sync. Do not include patient-identifying or confidential clinical information. Do not put private raw chat exports into this public repository.

## Current limitations / 未実装

- No direct ChatGPT conversation ingestion, no daily bulk ingestion, no automatic ChatGPT-generated question synchronization.
- No account-based cross-device answer history sync; localStorage is browser-local.
- Legacy questions Q002–Q030 still lack dedicated manga. The new workflow guarantees a real manga only for newly generated questions.
- Image generation and model calls incur API charges; no budget cap is enforced by this repository. Set API usage limits and monitor billing on your OpenAI account.
- Generated medical questions are NOT independently clinically validated. Human review is recommended before treating them as authoritative clinical learning material.
- GitHub Actions scheduled runs can be delayed or temporarily disabled for inactivity.

## Next implementation stages / 次の段階

- Build a private authorized ChatGPT export/ingestion pipeline with redaction and approval, or an explicitly connected integration; never scrape account sessions.
- Add an authenticated database (e.g., Supabase with row-level security) for cross-device review history. Do not put personal review history into public GitHub commits.
- Add medical source validation and manual approval for high-risk clinical content; add all legacy comics.
