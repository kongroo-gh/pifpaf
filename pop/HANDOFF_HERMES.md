# HANDOFF_HERMES.md — ポップ版リスキンの実装引き継ぎ

このファイルだけ読めば着手できるように書いてある。
設計の理由づけは `pop/RESKIN_PLAN.md`、記録先は `pop/KNOWN_ISSUES.md`。

## 前提

| | |
|---|---|
| リポジトリ | `kongroo-gh/pifpaf` |
| 作業ディレクトリ | `/home/user/pifpaf` |
| ブランチ | `claude/pif-paf-pop-reskin-sji3pc`（**他へ push しない**） |
| 作業範囲 | **`pop/` の中だけ**。リポジトリ直下の現行版は1行も触らない |
| PR | **明示の依頼があるまで作らない** |
| テーマ | B案「ほしめぐり」（承認済み） |
| 賭けの扱い | 安全策（`RESKIN_PLAN.md` §7-1 を**全部**。§7-2 は**やらない**） |
| アプリ化 | Capacitor（方針承認済み。**着手は別段階**。依存追加は事前確認が要る） |

## 絶対に変えないもの

- `pop/engine/` `pop/protocol/` `pop/server/` … **1行も変えない**
- `localStorage` のキー `pifpaf.lang` `pifpaf.sound` `pifpaf.speed`
  `pifpaf.bankroll` `pifpaf.rulesSeen`
- 画面の種別文字列（`"INTRO" | "BETTING" | "DEALING" | ...`）と画面遷移
- `WAGERS` `LOAN_AMOUNT` `PROTOCOL_VERSION`、メッセージの `t` フィールド
- engine の数値（7チップ・失点2/1/3・配当倍率）
- `BATER` `CORINGA` `VIRA` `TRINCA` などゲーム用語のポルトガル語

替えるのは**表示される文字・色・書体・図像・音**だけ。

## 毎コミットで通す検査

```
cd /home/user/pifpaf
diff -r pop/engine   engine    # 差分ゼロであること
diff -r pop/protocol protocol  # 同上
diff -r pop/server   server    # 同上
git diff --name-only main...HEAD | grep -v '^pop/'   # 何も出ないこと
npm run typecheck --workspace=web   # i18n の埋め忘れはここで全部出る
```

`git show --stat` に `engine/` `protocol/` `server/` が出たら約束を破っている。

## commit の順（`RESKIN_PLAN.md` §6）

1. 色の値だけ差し替え（`pop/web/src/styles.css` の `:root`、`pop/web/index.html`）
2. CSS 変数名の改名（値は変えない。**可否は §7-4 D1 の決定待ち**）
3. 書体の差し替え
4. ポルトガル語の装飾語（§1-1）
5. 席の顔ぶれ（§1-2、`pop/web/src/game/players.ts` と各辞書の `personas`）
6. 辞書 ja / en / pt（§1-3）— 言語ごとに分けて3コミット
7. `MoneyRain` → `StarRain`、`ChipStack` の意匠（§3・§7-1 A/B）
8. 音（`ambience.ts` の流れ星、`tunes/starlight.ts`、`sfx` の改名）
9. `pop/CLAUDE.md` `pop/README.md` `pop/rules.md` を新しい世界観に合わせる

## 動かし方（`pop/` は単体で動く）

ルートの `workspaces` に `pop` は入っていない。`pop/package.json` は複製なので、
`pop/` の中で独立に動く。`node_modules/` は `.gitignore` に入っている。

```
cd /home/user/pifpaf/pop
npm install
npm run dev --workspace=web   # スクリーンショットはここから撮る
npm run typecheck
```

## 触るファイル（現行版の実測に基づく）

- 色・書体 … `pop/web/src/styles.css`（2315行）・`pop/web/index.html`
- 装飾語 … `pop/web/src/App.tsx` / `net/OnlineTable.tsx` /
  `components/OpponentSeat.tsx` / `components/LeaveTable.tsx` /
  `components/TablePrompts.tsx` / `components/RuleBook.tsx`
- 辞書 … `pop/web/src/i18n/ja.ts` `en.ts` `pt.ts`（`types.ts` は契約なので構造を変えない）
- 席 … `pop/web/src/game/players.ts`
- 図像 … `pop/web/src/components/MoneyRain.tsx` `ChipStack.tsx`
- 音 … `pop/web/src/audio/ambience.ts` `sfx.ts`・新規 `tunes/starlight.ts`
  （`noir.ts` `bossa.ts` は**消さない**。差し戻しが1行で済む作りを壊さない）

画像・音源ファイルは現行版に**1枚も無い**（`web/public/` も無い）。
すべて CSS とインライン SVG と Web Audio 合成。

## やらないこと

- **バグは直さない。** 見つけたら `pop/KNOWN_ISSUES.md` に
  発生箇所・再現手順・影響・存在範囲の4項目だけ書く
- **新規依存を足さない。**（Capacitor も含めて、追加前に人間の確認が要る）
- **CI を触らない。**（`.github/workflows/` は変更前に人間の確認が要る）
- `RESKIN_PLAN.md` §7-2（画面ごと外す／倍率を廃する）に**着手しない**

## 終わったときに出すもの

- 全画面の before / after スクリーンショット（条件11）
- 上の検査4本の出力
