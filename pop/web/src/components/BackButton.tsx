// 一つ前の画面へ戻る、隅の小さなボタン。
//
// **卓の外の画面（入口・掛け金・オンラインの入口）だけに置く。**
// 対局が始まってからは戻る道を作らない（単機版もオンラインもそう決めてある）。
//
// 見出しの邪魔をしないよう、パネルの左上に薄く重ねる。押せる範囲は
// 見た目より広く取ってあり、指でも狙える。

import { useT } from "../i18n";
import { sfx } from "../audio";

export function BackButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      className="backButton"
      onClick={() => {
        sfx.click();
        onClick();
      }}
      aria-label={t.nav.back}
      title={t.nav.back}
    >
      <span className="backButton__arrow" aria-hidden="true">
        ←
      </span>
      <span className="backButton__label">{t.nav.back}</span>
    </button>
  );
}
