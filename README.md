# NITOCバスナビ

2026年10月1日改正対応。

- `index.html` — 入口ページ
- `obus_2026_kosen_s2k.html` — 小山駅東口 → 高専
- `obus_2026_kosen_k2s.html` — 高専 → 小山駅東口
- `obus_2026_kosen.json` — HTML表示用時刻データ
- `obus_2026_kosen_s2k.pdf` / `obus_2026_kosen_k2s.pdf` — PDF版
- `assets/` — CSS / JavaScript / favicon
- `watch/` — Galaxy Watchなどの小画面向け発車案内。Samsungブラウザで開き、ブックマークして使用。

時計用は次の3便を表示します。行き／帰りはボタンで切り替え、選択は端末に保存します。帰りの大きな時刻は正門出発目安で、実際のバス時刻と徒歩補正も併記します。画面を下にスクロールすると、そのあとの便や注記が見られます。

画面上では路線名と路線色を併記します。

## 時刻表のHTML生成

検索エンジンやJavaScript無効環境でも便情報を読み取れるよう、2方向のHTMLには `obus_2026_kosen.json` を元に生成した静的時刻表を埋め込んでいます。

JSONの時刻データを更新したら、デプロイ前に次を実行してHTMLを再生成してください。

```sh
node scripts/generate-timetables.mjs
```

ブラウザ上では従来通りJavaScriptでも同じデータを読み込み、表示を更新します。静的HTMLとJSONの内容がずれないように、生成後のHTMLもまとめてコミットしてください。

## 検索向けの設定

- 公開URLは `https://nitocbus.pages.dev/`。HTMLのcanonical・OGP・内部リンク・sitemapはCloudflare Pagesの拡張子なしURLに揃えます。
- ページの内容を変更したときは、`sitemap.xml` の該当URLの `lastmod` を実際の更新日に変更してください。時刻表の改正日とは別です。変更のないページや単なる再デプロイでは更新しません。
- PDFのcanonicalは `_headers` で対応するHTMLを指定しています。PDFのダウンロード・印刷は従来どおり利用できます。
- ルートの `404.html` は、存在しないURLにトップページを返すSPAフォールバックを防ぐために必要です。404ページはサイトマップに含めません。
- Search Consoleの確認用HTMLはそのまま維持します。Googleの再取得・検索表示への反映状況はSearch Consoleで確認してください。

## NITOCバスナビへの移行（2026年10月）

- 新URL：`https://nitocbus.pages.dev/`（Cloudflare Pagesの新規プロジェクト名 `nitocbus` でデプロイすること。実際の利用可否・デプロイの成功はCloudflare側で確認）。
- 旧URL：`https://o-bus-kosen.pages.dev/`。**古いPagesプロジェクトは削除しない**。
- 同じGitHubリポジトリに新Pagesプロジェクトを接続し、このブランチで動作確認したうえで、`main` を新サイトの本番ブランチにする。
- 旧Pagesプロジェクトの本番ブランチを `chore/legacy-301-redirect` に変更すると、同ブランチの `_redirects` により、旧URLを同じパスの新URLへ301転送できる（Cloudflare Pages > Settings > Builds & deployments > Production branch）。
- **切替順序：新サイト公開確認 → 旧プロジェクトの本番ブランチ変更 → 301確認。** 先に旧側を転送しないこと。
- Search Consoleで新URLをプロパティ登録し、サイトマップ `https://nitocbus.pages.dev/sitemap.xml` を送信する。旧URLの301は維持する。
- リポジトリ名、時刻データ、PDFのファイルパスは互換性のため変更しない。

## 旧URLからの移転案内

- 旧サイトの `_redirects` は新URLへ301転送し、`?moved=obuskosen` を付ける（旧プロジェクト専用ブランチ `chore/legacy-301-redirect`）。
- 新サイトの全HTMLページはマーカーを検知した場合だけ案内ダイアログを表示する。ブラウザのアドレス欄からマーカーを消し、閉じると同じタブのセッション中は再表示しない。直接アクセス時は表示しない。
- PDFに直接転送された場合、ブラウザのPDFビューアにはHTMLのダイアログを表示できない。PDFリンクは同じパスで転送され、閲覧機能は維持する。
- 切替前に旧サイト→新サイトの各HTML・PDFの転送、案内の閉じる動作、通常アクセスでは表示されないことを検証する。
