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

## 次のステップ（未着手）
1. ターンの状態遷移（ドロー→上がり判定→ディスカード→手番交代）を `engine/gameEngine.ts` として実装
2. シンプルなCPU AI（貪欲法で役を組み、不要札を捨てる）を `engine/ai.ts` として実装
3. `web/` に React + Vite の画面を追加し、`engine` を呼び出して4人対戦（人間1人 + CPU3人）を動かす
4. ポイント制度の設計（別途ご相談）
