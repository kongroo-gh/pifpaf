# Android / Google Play 準備

## 確定方針
- Capacitor方式。ポーカー卓・ゲームルールを維持する。
- 賭け・配当のシミュレーションを隠さず申告し、付与される年齢区分を受け入れる。
- 仮の開発用識別子: com.example.pifpaf.dev。公開前に本番識別子を承認・確定する。
- Play Console未登録。Android実機なし。エミュレーター検証と実機検証は区別する。
- ストア申請、公開更新、本番署名鍵の作成は未承認・未実施。

## 作成済み
- web/capacitor.config.ts / web/android/
- Capacitor core / android / cli 8.5.1
- Android専用Web出力: web/dist-android（Pages出力distと分離）
- Android Studio: /Applications/Android Studio.app
- SDKコマンドラインツール: ~/Library/Android/sdk/cmdline-tools/latest

## 再現コマンド（popから）
```sh
npm run build --workspace=web -- --base=./ --outDir=dist-android
npm exec --workspace=web -- cap sync android
```

## 現在のブロッカー
ユーザー承認によりSDKライセンスを承諾。platform-tools 37.0.1 / API 36 / build-tools 36.0.0 / emulator 37.1.11 / Android 36 ARM64 Google APIsイメージをインストール済み。sdkmanagerのインストール一覧、adb起動、Hypervisor.Frameworkの利用可否（成功）を確認。
Java25の互換性問題は、ユーザー配下のTemurin JDK21.0.12.1+1導入で解消。ベンダーSHA256一致とEclipse FoundationのApple Developer ID署名を検証済み。Gradle8.14.3は変更なし。
Debug APKは前回生成・adbインストール済み。再開時にローカルAPKとemulator-5554上のbase.apkのSHA256一致を確認し、再ビルド・再インストールは省略。AAB・実機検証・ストア公開は未実施。
- APK: `web/android/app/build/outputs/apk/debug/app-debug.apk`
- SHA256: `33e2b67d57177d622d7366ddde2279d788e1f4c848972ac259afaaa09f637ded`（Pif Paf紹介文の3言語化を同期して再生成）
- 再開検証: 3人CPU開始、アプリ内離脱でイントロ復帰、WebView通信オフライン下で再読み込み・ドロー/捨て札・CPUラウンド決着、縦横回転、背景復帰。
- 不合格/要修正: Androidシステム戻るはルールを閉じずホームへ退出し、再起動でイントロに戻る。横向きラウンド結果パネルは下部が見切れる。前回6人横向きでも縦溢れの記録あり。
- オフラインは実Androidエミュレーター内WebViewのCDP Network offline（navigator.onLine=false）で検証。端末全体の無線遮断や実機試験と同一視しない。
- `npm test`: 236件合格、`npm run typecheck`、`git diff --check`: 成功。
- 詳細: `reskin-evidence/android-debug/resume-status.md`、`resume-runtime.jsonl`、`runtime.jsonl`、`resume-*.png`。音の聴取とオンライン切断復帰は未確認。旧Render・公開Webは変更していない。

## 申告準備チェックリスト（未確認を「なし」と申告しない）
- [ ] 課金、購入通貨、換金、現物賞品、外部賭博への誘導の有無を確認
- [ ] 掛け金・所持金・配当の仕組みをIARC回答の根拠として記録
- [ ] オンライン通信データ、サーバーログ、保存期間、第三者提供を確認
- [ ] 広告・分析SDK、権限、アカウント作成、チャットの有無を確認
- [ ] 開発者の表示名・連絡先とプライバシーポリシーを確定
- [ ] 正確なデータセーフティ回答案を作成し、人間が承認
- [ ] 対象年齢・配信地域・ストア説明・画像を確定
- [ ] Play Console登録と適用される本人・端末確認およびテスト要件を確認
- [ ] Androidで戻る、休止復帰、音、縦横、オフラインCPU対戦、オンライン切断復帰を検証
- [ ] 実機テスターを確保（エミュレーターで代替したと記載しない）
- [ ] npm auditの警告を評価（インストール時: moderate 6 / high 1 / critical 1。影響未評価、強制更新なし）

## 公式資料
- https://capacitorjs.com/docs/getting-started
- https://capacitorjs.com/docs/getting-started/environment-setup
- https://support.google.com/googleplay/android-developer/answer/9877032
- https://support.google.com/googleplay/android-developer/answer/10144311
- https://support.google.com/googleplay/android-developer/answer/14151465
