# NITOCバスナビ

**小山駅東口 ↔ 小山高専**を結ぶ、おーバスの時刻表を見やすくまとめた非公式サイトです。**2026年10月1日改正**の時刻表に対応しています。

> [!IMPORTANT]
> 個人制作の**非公式**サービスです。発車案内は時刻表に基づいており、**バスの現在位置・遅延・臨時運休は反映しません**。乗車前には[小山市の公式情報](https://www.city.oyama.tochigi.jp/o-bus/rosen-jikoku/page001803.html)もご確認ください。

## サイトを使う

| やりたいこと | 開くページ |
| --- | --- |
| 小山駅東口から高専へ | [行きの時刻表](https://nitocbus.pages.dev/obus_2026_kosen_s2k) |
| 高専から小山駅東口へ | [帰りの時刻表](https://nitocbus.pages.dev/obus_2026_kosen_k2s) |
| 次の便を発車標のように見る | [発車案内](https://nitocbus.pages.dev/departure/) |
| 時計などの小画面で見る | [時計用表示](https://nitocbus.pages.dev/watch/) |
| 印刷する・PDFを保存する | [トップページ](https://nitocbus.pages.dev/)から方向別の「PDF版」 |

**帰りの時刻には注意してください。** 高専側からの時刻表で大きく表示するのは、実際のバス発車時刻ではなく、**高専正門を出る目安時刻**です。停留所までの徒歩時間を公式時刻から差し引いています。詳しくは[使い方・時刻の読み方](docs/usage.md)へ。

## このリポジトリの資料

サイト利用者向けの説明と、コードを読みたい人・自分で更新するときの説明を分けています。

| ドキュメント | 内容 | 対象 |
| --- | --- | --- |
| [使い方・時刻の読み方](docs/usage.md) | 表示時刻、運行日、停留所、PDFと時計用画面 | 利用する人 |
| [サイトの仕組み](docs/architecture.md) | ファイル構成、データと画面の関係、技術構成 | コードを読みたい人 |
| [時刻表の更新・公開手順](docs/maintenance.md) | 更新チェックリスト、生成コマンド、確認事項 | 時刻表を更新するとき |

## 開発を始める

このサイトは**HTML・CSS・JavaScript・JSON**を中心とした静的サイトです。ウェブ表示のために専用のバックエンドやフレームワークは使っていません。

```sh
git clone https://github.com/Tikurin43016/obus-timetable.git
cd obus-timetable
python -m http.server 8000
```

ブラウザで `http://localhost:8000/` を開いてください。JSONを取得する画面があるため、`file://` で直接HTMLを開く方法は推奨しません。

時刻データの原本は `obus_2026_kosen.json` です。更新後は静的HTMLとPDFの**両方を再生成**します。コマンド・必要環境・確認項目は[更新・公開手順](docs/maintenance.md)にまとめています。

## 公開先と権利について

- 新サイト用の設定URL：<https://nitocbus.pages.dev/>
- 旧URL：<https://o-bus-kosen.pages.dev/>（移転・転送の設定については[更新・公開手順](docs/maintenance.md#公開と移転の確認)を参照）
- バスの路線・運行情報の出典：[小山市公式の路線・時刻表](https://www.city.oyama.tochigi.jp/o-bus/rosen-jikoku/page001803.html)
- 小山市・運行事業者・小山工業高等専門学校の公式サービスではありません。

※ リポジトリのソースコードを読んだだけでは、Cloudflare Pages側の本番設定・転送設定や公開URLの稼働状況までは確認できません。
