# NITOCバスナビ

小山駅東口と小山高専を結ぶコミュニティバス「おーバス」の時刻情報を、通学・来校向けにまとめた**非公式・個人開発の静的ウェブサイト**です。現行データは2026年10月1日改正に対応しています。

- サイト：<https://nitocbus.pages.dev/>
- 運行情報の出典：[小山市公式の路線・時刻表](https://www.city.oyama.tochigi.jp/o-bus/rosen-jikoku/page001803.html)

このREADMEと `docs/` は、**コードの理解・開発・更新に使う技術資料**です。サイト利用者向けの取扱説明書ではありません。利用時に必要な注意事項はサイト内で完結させます。

## 設計方針

- **静的構成**：HTML・CSS・JavaScript・JSONを使用。専用のバックエンド・データベース・フレームワークは不要。
- **データの一元化**：`obus_2026_kosen.json` を時刻データの原本として、時刻表HTMLと印刷用PDFを生成する。
- **公式時刻と参考値を分離**：停留所の公式時刻を `stop_calls` に保存し、徒歩補正後の表示時刻 `display_time` と区別する。
- **JavaScriptに依存しすぎない**：方向別の時刻表HTMLには生成済みの静的表示を埋め込み、データ取得に失敗しても時刻表を残す。
- **説明書を前提としないUI**：方向・停留所・運行条件・徒歩補正など、判断に必要な情報は画面内で判別できるようにする。
- **運行追跡ではない**：発車標や時計向け画面は時刻表ベースであり、遅延・臨時運休・車両位置を取得しない。

## ドキュメント

| 文書 | 内容 |
| --- | --- |
| [設計・データ仕様](docs/architecture.md) | システム構成、ファイルの役割、JSONのデータモデル、表示時刻と運行条件、技術的制約 |
| [時刻表の更新手順](docs/maintenance.md) | 公式資料の確認、データ更新、HTML/PDF生成、動作確認、公開・検索設定 |

## 開発環境

ローカルで確認するには、リポジトリを取得してHTTPサーバーを起動します。

```sh
git clone https://github.com/Tikurin43016/obus-timetable.git
cd obus-timetable
python -m http.server 8000
```

`http://localhost:8000/` を開きます。JSONを取得する画面があるため、`file://` での直接表示は推奨しません。

時刻表の静的HTMLを再生成する場合：

```sh
node scripts/generate-timetables.mjs
```

印刷用PDFの生成にはPython 3、WeasyPrint、qrcode（Pillow）、日本語フォントが必要です。コマンドと更新時の注意点は[時刻表の更新手順](docs/maintenance.md)に記載しています。

## 主なファイル

| パス | 役割 |
| --- | --- |
| `obus_2026_kosen.json` | 時刻表データの原本 |
| `index.html` | トップページ |
| `obus_2026_kosen_s2k.html`, `obus_2026_kosen_k2s.html` | 方向別の時刻表 |
| `departure/`, `watch/` | 発車標・小画面向け画面 |
| `assets/` | CSS・JavaScriptなど |
| `scripts/` | HTML・PDF生成スクリプト |
| `_headers`, `robots.txt`, `sitemap.xml`, `404.html` | 配信・検索関連設定 |

## 公開と出典

GitHubリポジトリの内容はCloudflare Pages向けに構成されています。旧URL `o-bus-kosen.pages.dev` からの移転設定については[時刻表の更新手順](docs/maintenance.md#公開と移転の確認)を参照してください。実際の本番ブランチ・転送設定はCloudflare側でも確認が必要です。

時刻情報の出典は小山市の公式資料です。本プロジェクトは小山市、バス運行事業者、小山工業高等専門学校の公式サービスではありません。
