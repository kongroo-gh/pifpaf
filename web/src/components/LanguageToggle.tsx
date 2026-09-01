// 言語の切り替えボタン。
//
// 押すたびに次の言語へ回る。選択肢を並べず1つのボタンにしてあるのは、
// 盤面のヘッダーが既に窮屈で（狭い画面ではルールボタンの文字すら畳んでいる）、
// 言語が3つに増えても幅が変わらないようにするため。
//
// CPUの速さの切り替えと同じ見た目にしてある。並んで置かれるので、
// 「押すと変わるもの」だと一目で分かるほうがよい。

import { useLangControl } from "../i18n";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { t, cycleLang } = useLangControl();

  return (
    <button
      type="button"
      className={`speedToggle langToggle ${className}`}
      onClick={cycleLang}
      aria-label={t.lang.aria(t.meta.label)}
    >
      <span className="speedToggle__label">{t.lang.caption}</span>
      <span className="speedToggle__value">{t.meta.label}</span>
    </button>
  );
}
