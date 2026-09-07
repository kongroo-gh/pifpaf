# RESKIN_PLAN.md — ポップ版「ほしめぐり」への置換計画

現行版（リポジトリ直下）は一切変更しない。作業は `pop/` の中だけ。

- **テーマ**: B案「ほしめぐり」（夜空をわたる観測船。承認済み）
- **アプリ化**: Capacitor（承認済み。着手は別段階）
- **不変**: ゲームロジック・画面遷移・状態管理・内部キー
- **証明**: `diff -r --exclude=.git --exclude=node_modules --exclude=pop . pop` に
  `engine/` `protocol/` `server/` が出てきたら約束を破っている

---

## 0. 世界観の置き換え

| | 現行 | ポップ版 |
|---|---|---|
| 舞台 | マフィアの酒場の奥の部屋 | 夜空を渡る観測船の甲板 |
| 同席者 | ファミリーの構成員 | 星をたどる旅の連れ |
| 賭ける | チップ（＝命）を積んで賭ける | ひかりを分けて旅に出る |
| 負ける | チップが尽きて破産、店を出られない | ひかりが消えて、その人の旅は終わる |
| 勝つ | 配当を得る | 旅のみのりとしてひかりが増える |

`chips` という**数の意味は変えない**（7つ持って始まり、0で脱落）。
呼び名だけを「ほしのかけら」に替える。

---

## 1. 危険語 → 中立語（表示される文字）

### 1-1. ポルトガル語の装飾語（JSXに直書き）

犯罪・賭博を指すものだけ替える。ゲーム用語（BATER / CORINGA / VIRA /
TRINCA / SEQUÊNCIA / JOGAR / CORRER / PASSAR / FICAR / COMPRAR /
DESCARTAR / CONTINUAR / COMEÇAR / ENTRAR / CRIAR / SAIR / FECHAR /
RECUSAR / AS REGRAS / PRIMEIRA MÃO / A MÃO / FIM DA RODADA /
BATER NO LIXO / CHAMAR A CPU）は**そのまま残す**。ルールの語彙であって
賭博の語彙ではないし、この遊びがブラジルのものだという素性でもある。

| 現行 | 直訳 | ポップ版 | 置き場所 |
|---|---|---|---|
| `A FAMÍLIA` | 一家（組織） | `A TRAVESSIA`（渡り） | App.tsx:811, index.html:12 |
| `BEM-VINDO À MESA` | 卓へようこそ | 据え置き（中立） | App.tsx:809 |
| `A APOSTA` | 賭け | `A PARTIDA`（出発／一戦） | App.tsx:730 |
| `ALL IN` | 全額賭け | `TUDO`→ **`TODA A LUZ`**（ありったけの光） | App.tsx:773 |
| `PEGAR EMPRESTADO` | 借金する | `NOVA LUZ`（新しい光） | App.tsx:743 |
| `SEM UM TOSTÃO` | 一文無し | `SEM LUZ`（光が無い） | App.tsx:691,693 |
| `VOCÊ ESTÁ FALIDO` | あんたは破産だ | `SUA LUZ APAGOU`（光が消えた） | App.tsx:677 |
| `FALIDO` | 破産 | `APAGADO`（消灯） | App.tsx:429 |
| `ELIMINADO` | 脱落 | `APAGADO`（同上に揃える） | OpponentSeat.tsx:96 |
| `A SALA` | （奥の）部屋 | `A PRAÇA`（広場） | OnlineTable.tsx:85,201,646 |
| `MESA DESFEITA` | 卓が壊れた | 据え置き（中立） | OnlineTable.tsx:155 |
| `ALGUÉM SUMIU` | 誰か消えた | 据え置き（中立） | OnlineTable.tsx:130 |
| `SENTAR À MESA` ほか `MESA` 系 | 卓に着く | 据え置き（`mesa`＝卓は賭博語ではない） | 各所 |

### 1-2. 席の顔ぶれ（`game/players.ts` と `i18n/*.personas`）

肩書きが「頭目・剃刀・未亡人」で、そのまま組織の役職になっている。

| 席 | 現行 epithet | 現行 名/肩書き（ja） | ポップ版 epithet | ポップ版 名/肩書き（ja） |
|---|---|---|---|---|
| 0 | `O Forasteiro`（よそ者） | あなた／よそ者 | `O Viajante` | あなた／旅人 |
| 1 | `O Chefe`（頭目） | ドン・ヴィエイラ／頭目 | `O Astrônomo` | セウ・オリオン／星読み |
| 2 | `A Navalha`（剃刀） | ゼ・ナヴァーリャ／剃刀 | `A Bússola` | ビア・ブッソラ／道しるべ |
| 3 | `A Viúva`（未亡人） | ドナ・ローザ／未亡人 | `A Cometa` | ドナ・コメッタ／流れ星 |

en / pt も同じ並びで差し替える（pt の `title` は現行どおり空のまま。
異名がポルトガル語なので、訳を並べると同じ語が2度出る）。

### 1-3. 辞書の語彙（ja / en / pt の3本）

| 概念 | ja 現行 | ja ポップ版 | en 現行 | en ポップ版 | pt 現行 | pt ポップ版 |
|---|---|---|---|---|---|---|
| chips | チップ | **ほし** | chips | **stars** | fichas | **estrelas** |
| bankroll | 所持金 | **ひかり** | bankroll | **light** | banca | **luz** |
| wager | 掛け金 | **旅の支度** | stake / wager | **outfitting** | aposta | **preparo** |
| payout | 配当 | **旅のみのり** | payout | **reward** | pagamento | **recompensa** |
| 破産 | 破産／一文無し | **光が消える** | broke / bankrupt | **out of light** | falido | **sem luz** |
| 借りる | 借りる | **わけてもらう** | borrow | **receive** | pegar emprestado | **receber** |

置換は語の対応だけでは済まない。次の文は書き直す（意味は保つ）。

| 箇所 | 現行 | ポップ版（ja） |
|---|---|---|
| `intro.body1` | 奥の部屋に、四つの椅子。灰皿は満杯で、誰も窓を開けない。 | 甲板に、四つの椅子。見上げれば、名前のない星ばかり。 |
| `intro.body2` | 全員が7枚のチップを積む。負けるたびに減り、尽きた者から店を出られなくなる。 | 全員が7つのほしを灯す。負けるたびに消え、尽きた人から旅を降りる。 |
| `intro.warn` | 最後の一人になるまで、誰も帰れない。 | 最後のひとつが残るまで、旅は続く。 |
| `betting.brokeBody1/2` | 一文無しだ。ファミリーが立て替えてくれるそうだが、／返せなかったときのことは、聞かないほうがいい。 | ひかりが尽きた。観測所が新しいひかりを分けてくれるという。／また灯せば、旅はいつでも続けられる。 |
| `matchOver.winLead` | テーブルに残ったのはあんただけだ。 | 最後まで灯っていたのは、あなたのほしだった。 |
| `matchOver.loseLead` | チップが尽きた。掛け金は戻らない。 | ほしが尽きた。支度に出したひかりは戻らない。 |
| `turn.discard` | 1枚捨てろ。 | 1枚捨てよう。 |
| `fold.kicker` | 手札を見て決めろ | 手札を見て決めよう |
| `result.youWon` | あんたが取った | あなたが取った |
| `result.bust` | 破産 | 消灯 |
| `leave.warnSolo` | 途中で降りれば、賭けた *N* は卓に置いていくことになる。 | 途中で降りれば、支度に出した *N* は戻らない。 |
| `rules.s9.title` | チップと勝敗 | ほしと勝敗 |
| `rules.s11.title` | 配当 | 旅のみのり |

**ならず者口調をやめる**のは ja だけの作業ではない。en の "Toss one."
"You took it." なども同じ温度に揃える。

---

## 2. 色・書体（`styles.css` と `index.html`）

現行はノワール（黒／ラシャ緑／金／血の赤）。夜空へ移す。**明度の構造は
変えない**（暗い地に明るい札）ので、カードの可読性とレイアウトは崩れない。
B案を選んだ理由がここにある。

| 変数 | 現行 | 意味 | ポップ版 | 新しい名前 |
|---|---|---|---|---|
| `--ink` | `#0a0908` | 地 | `#0b1026` 深い藍 | `--night` |
| `--ink-2` | `#131010` | 地（浮き） | `#151c3d` | `--night-2` |
| `--felt` | `#14352a` | 卓のラシャ | `#1c2a5e` 夜の青 | `--deep` |
| `--felt-2` | `#0d2419` | 同（暗） | `#131c42` | `--deep-2` |
| `--gold` | `#c8a24a` | 金 | `#ffd166` 星の黄 | `--star` |
| `--gold-bright` | `#eccd83` | 金（明） | `#ffe9a8` | `--star-bright` |
| `--blood` | `#8b1a14` | 血 | `#e5487f` 桃 | `--flare` |
| `--blood-hot` | `#d24a34` | 血（明） | `#ff7ab0` | `--flare-hot` |
| `--cream` | `#ece3cf` | 文字 | `#eef2ff` 月白 | `--moon` |
| `--smoke` | `#8f887c` | 副文字 | `#8f9bc4` | `--haze` |
| `--smoke-dim` | `#5d574e` | 副文字（暗） | `#5b6591` | `--haze-dim` |

**変数名も替える。** `--felt`（カジノ卓のラシャ）と `--blood` は名前自体が
世界観を運んでいて、残すと後で緑と赤に戻される。ただし置換件数が多いので
**値の変更とは別の commit に分ける**（機械的な改名だけの diff にする）。

書体は Cinzel（ローマ碑文体・高級／重厚）と明朝をやめ、丸ゴシックにする。

| | 現行 | ポップ版 |
|---|---|---|
| `--display` | `Cinzel` / `Noto Serif JP` | `Baloo 2` / `Zen Maru Gothic` |
| `--body` | `Noto Serif JP` / 明朝 | `Zen Maru Gothic` / `Hiragino Maru Gothic ProN` |

`.grain`（フィルムの粒子）は残すが、粒子を弱めて**星の瞬き**に寄せる。

`index.html`: `<title>` を `PIF PAF — A TRAVESSIA`、`theme-color` を `#0b1026`、
Google Fonts の URL を差し替える。

> **Capacitor と font の注意**: 現在は Google Fonts をネットワークから読んでいる。
> APK に同梱してオフラインで動かすなら、書体も自前で持たないと落ちる。
> これはアプリ化の段階でやる（`web/public/fonts/` に置いて `@font-face`）。

---

## 3. 画像・アイコン

**現行版に画像ファイルは1枚も無い**（下の棚卸しを参照）。描いているのは CSS と
インライン SVG だけなので、差し替え対象は次の3つに限られる。

| 現行 | 何が描かれているか | ポップ版 |
|---|---|---|
| `MoneyRain.tsx` | **`$` の刻印がある金貨**と緑の紙幣が降る | **星と光の粒**が降る。`$` は削除。ファイル名も `StarRain.tsx` へ |
| `ChipStack.tsx` + `.chipStack*` | 積み上がった**カジノチップ** | 重なった**ほしのかけら**（★の粒） |
| `PlayingCard.tsx` | ♠♥♦♣ とランク | **据え置き**（トランプそのものは中立） |

`$` 記号は、この app で審査に最も引っかかりやすい一点。必ず消す。

新規に作るもの（現行版には存在しない）:
- アプリアイコン（512×512 / adaptive icon の foreground・background）
- ストア用フィーチャーグラフィック 1024×500
- スクリーンショット（Play は最低2枚。実機サイズで撮る）

---

## 4. 音（`web/src/audio/`）

音源ファイルは持たず Web Audio で合成しているので、差し替えは数値と関数の中身だけ。

| 現行 | ポップ版 |
|---|---|
| `ambience.ts` の **銃声** `gunshot()` | **流れ星** `shootingStar()`。曲を断ち切るのではなく、すっと減衰させる |
| 曲 `tunes/bossa.ts`（ニ短調） | `tunes/starlight.ts`（同じ `Tune` 型・長調）。`TUNE` の1行で差す |
| `sfx.bust()` 破産の重い低音 | `sfx.blackout()` 灯が消える下降音 |
| `sfx.coin()` 金貨 | `sfx.spark()` 光の粒 |
| `sfx.moneyRain()` | `sfx.starfall()` |
| `sfx.chip()` | 名前は据え置き（`chip` はここでは「小さい粒」の意味に読める） |

`noir.ts` と `bossa.ts` は**消さずに残す**。差し戻しが1行で済む今の作りを壊さない。

---

## 5. 触らないもの（明示）

- `engine/` `protocol/` `server/` … 1行も変えない
- `localStorage` のキー `pifpaf.lang` `pifpaf.sound` `pifpaf.speed`
  `pifpaf.bankroll` `pifpaf.rulesSeen` … **内部キーなので据え置き**
  （替えると利用者の設定が消える）
- 画面の種別 `"INTRO" | "BETTING" | ...`、`WAGERS` `LOAN_AMOUNT` などの定数名と値
- `PROTOCOL_VERSION`、メッセージの `t` フィールド
- 数値（7チップ・失点2/1/3・配当倍率）… 触れば模擬をやり直す必要がある
- `rules.md`（現行版の仕様書）… ポップ版の `pop/rules.md` だけ用語を合わせる

---

## 6. commit の分け方（ロジック非変更を diff で示すため）

1. 色の値だけ差し替え（`styles.css` の `:root` と `index.html`）
2. CSS 変数名の機械的な改名（値は変えない。1と分ける）
3. 書体の差し替え
4. ポルトガル語の装飾語（表 1-1）
5. 席の顔ぶれ（表 1-2）
6. 辞書 ja / en / pt（表 1-3）— 言語ごとに3 commit に分ける
7. `MoneyRain` → `StarRain`、`ChipStack` の意匠
8. 音（ambience の流れ星、tune、sfx の改名）
9. `pop/CLAUDE.md` `pop/README.md` `pop/rules.md` の記述を新しい世界観に合わせる

各 commit で `git show --stat` に `engine/` `protocol/` `server/` が
出ないことを確認する。

---

## 7. 判断が要る、まだ決めていないこと

- **Google Play のパッケージ名**（例 `com.kongroo.pifpafestrelas`）
- **プライバシーポリシーの URL**（Play は必須。まだ無い）
- **公開の経路**: `pop/` は今どの CI にも繋がっていない。GitHub Pages へ
  出すなら `.github/workflows/` を触ることになり、AGENTS.md により
  変更前に承認が要る。**この計画には含めていない**
- **IARC の申告**: 下記「7-2」を読んだうえで人間が答える

### 7-2. 見た目を替えても消えない事実（虚偽申告をしないために）

リスキンで替わるのは呼び名と色だけで、**遊びの構造は変わらない**。

- ひかり（旧・所持金）を出して一戦を始め、勝てば倍率つきで戻り、負ければ戻らない
- 倍率は残りほし数・連勝・コリンガ使用で 2.0〜5.7 倍に変わる

これは「資源を出して遊び、結果しだいで戻りが変わる」ループで、
**エネルギー制のゲームとしては普通だが、賭けの構造としても読める**。
IARC の「シミュレートされたギャンブル」に当たるかは、色や語を替えたことを
理由に「当たらない」と答えてよい種類の問いではない。

選べる道は3つ。**どれを選ぶかは人間の判断**なので、この計画では決めない。

1. 構造はそのままにし、IARC には正直に申告して、付いたレーティングを受け入れる
2. 支度・みのり（wager / payout）の画面ごと外し、ほしの増減だけで遊ばせる
   … いちばん安全だが、**画面遷移の変更にあたる**ので今回の約束の外。別途承認が要る
3. 倍率を廃して「残ったほしの数がそのまま次局の持ち越しになる」形にする
   … engine の `match.ts` に手が入るので、これも今回の約束の外

---

## 8. 現行版の棚卸し（この計画の前提）

| 種別 | 実測 |
|---|---|
| 画像・音源ファイル | **0件**（png/jpg/svg/ico/webp/mp3/wav いずれも無し。`web/public/` も無い） |
| CSS | `web/src/styles.css` 1本・2315行。設計トークンは `:root` の11変数 |
| UI テキスト | `web/src/i18n/` の ja(349) / en(355) / pt(365) 行 ＋ JSX 直書きの装飾語54語 |
| 音 | すべて Web Audio 合成。`audio/` 8ファイル。`sfx` の公開関数13個 |
| ストア素材 | **0件** |
| アプリ化 | **何も無い**。manifest / service worker / TWA / Capacitor / Cordova いずれの痕跡も無し（grep で0件） |
| 外部送信 | `fetch` 0件、分析・広告 SDK 0件。送るのはオンライン対局時の**呼び名の文字列だけ**（`CREATE` / `JOIN` の `name`） |
| 端末に残すもの | `localStorage` 5キーのみ（言語・音・速さ・所持金・ルール既読） |
