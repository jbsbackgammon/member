# 選手素材管理 (`member`)

JBS向けの選手素材管理・写真出力・名札出力ツールです。

## 会員データ

会員の追加・削除は、GitHub の `images/` フォルダへ顔写真を追加・削除することで行います。
ツール画面上では会員の追加・削除・顔写真登録は行いません。

顔写真は **1人1枚** とし、ファイル名を次の形式にします。

```text
名前_名前英語.png
```

例:

```text
images/柳 暢祐_YANAGI Nobusuke.png
```

ファイル名は変更せず、そのまま GitHub に保存します。
そのため GitHub から画像をダウンロードした場合も `柳 暢祐_YANAGI Nobusuke.png` の名前を維持できます。

GitHub Pages のデプロイ時に `scripts/build-members.py` が `images/` を読み取り、ファイル名の最初の `_` を区切りとして以下を自動判定します。

- `_` より前 → 名前
- `_` より後 → 名前英語

生成された `data/members.json` を画面が読み込みます。`data/members.json` は自動生成ファイルのため、リポジトリへ手動で保存する必要はありません。

## 名札

会員リストで対象者にチェックを入れ、「名札出力」から印刷します。
A4縦・2列×5段の1ページ10枚です。10名を超えた場合は自動で次ページを作成します。

名札文言は画面上で出力時に変更できます。帯色は「色なし」を含む9種類から選択できます。

## 共通UI

操作画面は [common/ui.css](https://jbsbackgammon.github.io/common/ui.css) を直接参照します。
色、フォント、ボタン、入力欄、チェックボックス、ダイアログ、余白などの共通定義を利用します。選手一覧の表は common と同じ `jbsui-reference-table` を直接適用し、列幅・配置や名札の帯色、印刷寸法は member 固有の定義として `style.css` に残しています。

## GitHub Pages

リポジトリ名: `member`

GitHub Pages の Source は **GitHub Actions** を使用します。
`main` への push で会員一覧を自動生成し、そのまま公開します。
