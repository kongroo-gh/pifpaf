# Pif Paf Web化プロジェクト

> Claude Codeで作業を継続する場合は、まず **`CLAUDE.md`** を読んでください。
> 設計方針・確定済み仕様・現状の実装状況・次のタスクをまとめています。

## 現状の構成（npm workspaces）
```
pifpaf/
├── package.json           # ワークスペースルート（engine / web を束ねる）
├── tsconfig.base.json      # 共通の strict TypeScript 設定
├── CLAUDE.md               # Claude Code向けの引き継ぎコンテキスト
├── rules.md                # ルール仕様書（ヴィラ・役・上がり条件・実装上の仮定）
└── engine/                 # ゲームロジック本体（UI・通信に非依存）
    ├── types.ts            # Card / Suit / Rank などの基本型
    ├── deck.ts              # デッキ生成・シャッフル・配札（ヴィラ／ワイルド決定含む）
    ├── melds.ts             # トリンカ・シーケンスの判定、手札の役分類
    ├── melds.test.ts        # Vitestテスト（要 npm install）
    ├── sanity-check.ts      # npm installなしでロジックを素早く確認するためのスクリプト
    ├── package.json
    └── tsconfig.json
```
`web/`（React + Vite のUI）はまだ未着手です。次のタスクとして `CLAUDE.md` に記載しています。

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
人間1人 + CPU3人の**ワンゲームマッチ**（1ラウンドで決着。ポイント制はまだ無し）。
見た目はマフィアの酒場という設定で、負けた3人は撃たれて脱落する演出が入る
（記号的な表現のみ）。

## テスト
```
npm test --workspace=engine     # 48件
```
CPU4人に最後まで打たせる統合テストを含む（決着すること／カードが増減しないこと）。

## 次のステップ
1. 上がった手の役を開示する（今は伏せたまま決着する）
2. AIの強化（捨て札を見る・ワイルドの温存判断）
3. 捨て札からのドロー（`rules.md` の仮定を解除する）
4. ポイント制度の設計（別途ご相談）
5. オンライン化（`server/` を足し、`engine` をNode側へ）
