# 会員情報 (`member`)

JBS向けの会員情報マスター・名札出力ツールです。

## データ管理

会員情報は `data/members.json`、顔写真は `images/` に直接保存します。
ツール画面上では会員の追加・削除・顔写真の登録は行いません。

1会員につき顔写真は1枚です。顔写真のファイル名は会員IDに合わせる運用を推奨します。

例:

```text
images/yanagi-nobusuke.png
```

`data/members.json` の例:

```json
{
  "id": "yanagi-nobusuke",
  "name": "柳 暢祐",
  "nameEn": "YANAGI Nobusuke",
  "photo": "images/yanagi-nobusuke.png",
  "badgeText": "",
  "bandColor": ""
}
```

このJSONを他のJBSツールから読み込むことで、共通の選手マスターとして利用できます。

## 名札

会員リストで対象者にチェックを入れ、「名札出力」から印刷します。
A4縦・2列×5段の1ページ10枚です。10名を超えた場合は自動で次ページを作成します。

名札文言は画面上で出力時に変更できます。帯色は「色なし」を含む5種類から選択できます。

## GitHub Pages

リポジトリ名: `member`

GitHub Pages の Source は **GitHub Actions** を使用します。
`main` への push で `.github/workflows/pages.yml` から公開します。
