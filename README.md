# PediaQ PWA beta

## 日本語
このフォルダはHTTPSで公開できる静的Webアプリです。30問を収録し、回答前の解説非表示、回答履歴の端末内保存、習熟度による復習間隔、当日の時間帯による問題切り替え、iPhoneホーム画面への追加、オフラインキャッシュに対応します。

注意: ChatGPTの自動化タスクとPediaQの間にはAPI連携がありません。ChatGPTの朝7時・昼12時・夜22時の出題通知は別のチャットに届きます。通知からPediaQを直接開くことや自動的に問題を同期することは現時点でできません。専用の4コマ漫画画像は第1問のみです。医学的な独立レビューは未実施です。

### 公開方法
1. `PediaQ_PWA`フォルダのファイルをすべてGitHubリポジトリのルートへアップロードします。
2. GitHub PagesのSettings > PagesでDeploy from a branch、main / rootを選びます。
3. 公開されたHTTPSのURLをiPhoneのSafariで開き、共有 > ホーム画面に追加を選びます。
4. iOSのChatGPTアプリで通知を許可すれば既存の定時クイズの通知はChatGPTから届きます。PediaQの通知ではありません。

### 動作確認
`python3 -m http.server 8000` をこのフォルダで実行し、デスクトップで `http://localhost:8000` にアクセスしてください。PWAインストールとService WorkerはHTTPS環境で確認してください。

## English
This is a static HTTPS-hostable progressive web app with 30 questions, answer gating, browser-local review history, review intervals, time-of-day question selection, installability, and offline caching. There is no direct API integration with ChatGPT scheduled tasks, no direct PediaQ push notifications, and no automatic question sync. Only Question 1 has a generated four-panel manga image. Independent medical review is pending.

To deploy, upload all files to a GitHub repository and enable GitHub Pages from the main branch root. Open the HTTPS URL in iPhone Safari and select Share > Add to Home Screen. Existing ChatGPT scheduled quizzes remain separate.


## Direct links / ディープリンク
HTTPS公開後、`https://YOUR-SITE/?session=07%3A00`、`?session=12%3A00`、`?session=22%3A00` で各時間帯の問題に直接アクセスできます。`?q=QUESTION_ID` で特定問題を指定できます。設定画面の時刻ボタンからリンクをコピーできます。

These are links to PediaQ's locally bundled question bank, NOT the dynamically generated questions in the ChatGPT scheduled tasks. ChatGPT scheduled task instructions can include these links after a real public HTTPS URL exists. There is no answer synchronization or shared database.
