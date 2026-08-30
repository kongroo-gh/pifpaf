import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages のプロジェクトサイトは https://<user>.github.io/pifpaf/ の下に置かれる。
// 既定のままだと生成される参照が /assets/... の絶対パスになり、サブパスでは404になるため
// ビルド時だけ base を付ける。dev はルートのままにしておきたいので command で分岐する。
const REPO_NAME = "pifpaf";

export default defineConfig(({ command }) => ({
  base: command === "build" ? `/${REPO_NAME}/` : "/",
  plugins: [react()],
  // engine はビルド済みJSではなく生のTSをそのまま参照するワークスペースパッケージなので、
  // 依存の事前バンドル対象から外してソースとして扱わせる。
  optimizeDeps: {
    exclude: ["@pifpaf/engine"],
  },
}));
