// 設定（言語とCPUの速さ）。
//
// 置き方が2通りある。
// - 卓に着く前（イントロ・掛け金画面）は、選択肢をそのまま並べる。
//   最初に決めてもらいたいものなので、開く操作を挟まない。
// - 対局中は隅の歯車から開く。盤面は既に窮屈で、常時出しておく余地がない。
//
// どちらも同じ `SettingsControls` を使う。並べ方が違うだけで中身は同じ。

import { useLangControl, LANGS, Kicker, Gloss } from "../i18n";
import type { Lang } from "../i18n";
import { SPEEDS } from "../game/useGame";
import type { Speed } from "../game/useGame";
import { ja } from "../i18n/ja";
import { en } from "../i18n/en";
import { pt } from "../i18n/pt";

/** 言語名は「その言語自身の表記」で出す。読めない言語に切り替えて戻れなくならないように。 */
const LANG_LABEL: Record<Lang, string> = {
  ja: ja.meta.label,
  en: en.meta.label,
  pt: pt.meta.label,
};

export interface SettingsControlsProps {
  speed: Speed;
  onSpeed: (s: Speed) => void;
}

/**
 * 言語だけの選択。ルールブックの見出しでも使う。
 * 読んでいる最中が、言語を変えたくなる一番ありそうな瞬間なので。
 */
export function LanguagePills({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useLangControl();
  return (
    <div className={`settings__choices ${className}`} role="group" aria-label={t.settings.language}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          className={`settings__choice ${l === lang ? "settings__choice--on" : ""}`}
          aria-pressed={l === lang}
          onClick={() => setLang(l)}
        >
          {LANG_LABEL[l]}
        </button>
      ))}
    </div>
  );
}

export function SettingsControls({ speed, onSpeed }: SettingsControlsProps) {
  const { t } = useLangControl();

  return (
    <div className="settings">
      <div className="settings__group">
        <p className="settings__label">{t.settings.language}</p>
        <LanguagePills />
      </div>

      <div className="settings__group">
        <p className="settings__label">{t.settings.speed}</p>
        <div className="settings__choices" role="group" aria-label={t.settings.speed}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className={`settings__choice ${s === speed ? "settings__choice--on" : ""}`}
              aria-pressed={s === speed}
              onClick={() => onSpeed(s)}
            >
              {t.speed[s]}
            </button>
          ))}
        </div>
        <p className="settings__note">{t.settings.speedNote}</p>
      </div>
    </div>
  );
}

/** 対局中に隅から開く設定画面。 */
export function SettingsPanel({
  speed,
  onSpeed,
  onClose,
}: SettingsControlsProps & { onClose: () => void }) {
  const { t } = useLangControl();

  return (
    <div className="panel panel--settings" role="dialog" aria-modal="true" aria-label={t.settings.title}>
      <div className="panel__box">
        <Kicker flavor="AJUSTES" gloss={t.settings.title} className="panel__kicker" />
        <SettingsControls speed={speed} onSpeed={onSpeed} />
        <div className="panel__actions">
          <button className="btn btn--again" onClick={onClose}>
            FECHAR<Gloss flavor="FECHAR" text={t.settings.close} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** 盤面の隅に置く歯車。 */
export function SettingsButton({ onClick }: { onClick: () => void }) {
  const { t } = useLangControl();
  return (
    <button
      type="button"
      className="iconButton"
      onClick={onClick}
      aria-label={t.settings.open}
      title={t.settings.title}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.4h-4l-.3 2.6c-.6.25-1.2.6-1.7 1l-2.4-1-2 3.5L4.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.5 2.4-1c.5.4 1.1.75 1.7 1l.3 2.6h4l.3-2.6c.6-.25 1.2-.6 1.7-1l2.4 1 2-3.5-2-1.5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
