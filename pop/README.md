# Pif Paf ほしめぐり — PIF PAF — A TRAVESSIA

夜空を渡る観測船で、4人が7つのほしを灯すカードゲーム。
作業・起動はこの `pop/` 内。現行版と engine / protocol / server は変更しない。
日本語の文面だけをリスキン済み。英語・ポルトガル語の辞書と人物訳は次段階。
装飾見出しのポルトガル語と BATER / CORINGA などのゲーム用語は残す。

支度に使うのは「ひかり」、勝者が受け取るのは「旅のみのり」。
見た目だけの変更で、内部の計算と資源を出して一戦する構造は変わらない。
ストア申告は見た目ではなく実装に基づく。Capacitor・書体同梱・ストア素材は未着手。

> Claude Codeで作業を継続する場合は、まず **`CLAUDE.md`** を読んでください。
> 設計方針・確定済み仕様・現状の実装状況・次のタスクをまとめています。

## 現状の構成（npm workspaces）
```
pifpaf/
├── package.json           # ワークスペースルート（engine / web を束ねる）
├── tsconfig.base.json      # 共通の strict TypeScript 設定
├── CLAUDE.md               # Claude Code向けの引き継ぎコンテキスト
├── rules.md                # ルール仕様書（ヴィラ・役・上がり条件・実装上の仮定）
├── engine/                 # ゲームロジック本体（UI・通信に非依存）
    ├── types.ts            # Card / Suit / Rank などの基本型
    ├── deck.ts              # デッキ生成・シャッフル・配札（ヴィラ／ワイルド決定含む）
    ├── melds.ts             # トリンカ・シーケンスの判定、手札の役分類
    ├── melds.test.ts        # Vitestテスト（要 npm install）
    ├── sanity-check.ts      # npm installなしでロジックを素早く確認するためのスクリプト
    ├── package.json
│   └── tsconfig.json
├── protocol/               # 席ごとに手札を伏せる通信仕様
├── server/                 # 権威サーバー（WebSocket、卓、CPU代行）
└── web/                    # React + Vite。単機版とオンライン版
```
単機版は複数ラウンドのほし制マッチとして完成しています。オンライン版も接続、
4人卓、再接続、切断席のCPU代行まで実装済みです。詳細と最新の優先順位は
`CLAUDE.md` を参照してください。

## なぜこの構成なのか
「将来オンライン化前提でCPU対戦から始める」という方針のため、`engine/` は
React にも Node.js の通信層にも依存しない**純粋なロジック**として切り出してあります。

- 今：`web/`（React + Vite、これから追加）が `engine/` をブラウザ内でそのまま呼び出し、
  CPUプレイヤーも「盤面を見て手を返す純粋関数」として `engine/` の型・判定関数を使う
- 将来：同じ `engine/` を Node.js サーバー（WebSocket）に載せ替え、各クライアントには
  自分の手札だけを見せるようにマスクした状態を配信する

この分離により、オンライン化のタイミングでロジックを書き直す必要がなくなります。

## 動作確認方法
### すぐ試す（npm install不要）
Node.js 22以降であれば型ストリッピング機能でそのまま実行できます。
```
node --experimental-strip-types engine/sanity-check.ts
```

### 正式なテスト（要ネット環境でのnpm install）
```
cd engine
npm install
npm test
```

## 遊ぶ
```
npm install
npm run dev --workspace=web     # http://localhost:5173
```

### iPhone の実機で開く
既定の `dev` は localhost だけに待ち受けるので、同じWi-Fiのスマホからは見えない。
LANに出す場合は別スクリプトを使う（Macのファイアウォールで許可を訊かれたら許可）。
```
npm run dev:lan --workspace=web
```
起動時に表示される `Network:` のURL（`http://<MacのIP>:5173`）を iPhone の
Safari で開く。ホーム画面に追加すると、アドレスバーの無い全画面で遊べる。

縦・横どちらの向きにも対応済み（iPhone SE 375x667 から Pro Max まで、
スクロールなしで手札とボタンが収まることを確認している）。
人間1人 + CPU3人の**複数ラウンドマッチ**（7ほし制）。
舞台は観測船の甲板。ほしが尽きた人は APAGADO の
スタンプが押され、席が白黒になって脱落する。

## オンラインで遊ぶ（ローカル開発）

別々のターミナルでサーバーとWebを起動し、ONLINEを選びます。ホストが卓を作ると
4文字の接続コードが自動発行され、ほかのプレイヤーはそのコードで参加できます。

```
npm run server
VITE_WS_URL=ws://127.0.0.1:8787 npm run dev --workspace=web
```

## iPhoneなど外出先から遊ぶ

GitHub Pagesが画面、Render Web Serviceがオンライン卓を担当する。

**要る手作業は「Renderで `render.yaml` からBlueprintを作る」だけ。**
サービス名 `pifpaf-online-kongroo` から決まる `wss://pifpaf-online-kongroo.onrender.com`
を接続先の既定として焼いてあるので、GitHubの変数設定は要らない。
別名で立てた場合や他所へ移した場合だけ、Repository variable `VITE_WS_URL` を設定する。

Render無料枠は15分間通信がないと休止する。休止後の最初の接続は失敗しうるが、
待ち時間を倍にしながら繋ぎ直すので1分ほどで自然につながる。
接続後はWebSocket通信が続くため、対局中は休止しない。

## テスト
```
npm test                        # engine / protocol / server
```
CPU4人に最後まで打たせる統合テストを含む（決着すること／カードが増減しないこと）。

## 次のステップ
1. 単機版とオンライン版の盤面を `PlayerView` に統一する
2. 単機版の配札・札移動・勝利演出をオンライン版へ移す
3. 公開先を決める（WebSocket対応の実行環境が必要）
4. AIを強化する
