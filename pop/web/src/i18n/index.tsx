// 表示言語の保持と切り替え。
//
// 辞書そのものは types.ts の `Strings` に縛られているので、
// 言語を足す作業は「辞書を1本書いて DICTS に載せる」だけで済む。
// 埋め忘れはビルドが止めてくれる。
//
// engine 側には一切持ち込まない。ルールは言語に依存しないし、
// engine を UI から独立させておく原則を崩さないため
// （engine が返すエラー文言は開発用で、画面には出していない）。

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Lang, Strings } from "./types";
import { LANGS } from "./types";
import { ja } from "./ja";
import { en } from "./en";
import { pt } from "./pt";

export type { Lang, Strings } from "./types";
export { LANGS } from "./types";

const DICTS: Record<Lang, Strings> = { ja, en, pt };

const LANG_KEY = "pifpaf.lang";

function isLang(v: string | null): v is Lang {
  return v !== null && (LANGS as string[]).includes(v);
}

/** 保存された選択 →ブラウザの言語 →日本語、の順に決める。 */
function initialLang(): Lang {
  try {
    const saved = window.localStorage.getItem(LANG_KEY);
    if (isLang(saved)) return saved;
  } catch {
    // 保存できない環境でも既定で動けばよい
  }

  try {
    for (const tag of navigator.languages ?? [navigator.language]) {
      // "en-US" や "ja-JP" のような地域つきでも先頭だけ見る
      const base = tag.toLowerCase().split("-")[0];
      if (isLang(base ?? null)) return base as Lang;
    }
  } catch {
    // navigator が無い環境（テスト等）
  }

  return "ja";
}

interface LanguageValue {
  lang: Lang;
  t: Strings;
  setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      // 保存できなくてもその場では切り替わる
    }
  }, []);

  // 読み上げソフトと、フォント・行分けの既定を言語に合わせる
  useEffect(() => {
    document.documentElement.lang = DICTS[lang].meta.htmlLang;
  }, [lang]);

  const value = useMemo<LanguageValue>(
    () => ({ lang, t: DICTS[lang], setLang }),
    [lang, setLang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

function useLanguage(): LanguageValue {
  const ctx = useContext(LanguageContext);
  if (ctx === null) throw new Error("LanguageProvider の外で言語を参照している");
  return ctx;
}

/** 文言だけ要るとき。ほとんどの画面はこれで足りる。 */
export function useT(): Strings {
  return useLanguage().t;
}

/** 切り替えボタン側。 */
export function useLangControl(): LanguageValue {
  return useLanguage();
}

/**
 * 席番号から呼び名を引く。
 * `noUncheckedIndexedAccess` があるので、範囲外は空文字で受ける。
 */
export function personaName(t: Strings, seat: number): string {
  return t.personas[seat]?.name ?? "";
}

export function personaTitle(t: Strings, seat: number): string {
  return t.personas[seat]?.title ?? "";
}

/** 比較用に、大小文字とアクセント記号の違いを落とす。 */
function normalize(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * ポルトガル語の装飾語に訳を添える。**同じことを言っているなら添えない。**
 *
 * 装飾語は全言語で共通なので、ポルトガル語で読むと訳と重なることがある
 * （「AJUSTES — Ajustes」「FIM DA RODADA — fim da rodada」）。
 * 辞書側を空にして回ることもできるが、言語を足すたびに同じ罠を踏むので、
 * 突き合わせて自動で落とす。訳が空文字のときも同じ扱い。
 */
export function withGloss(flavor: string, gloss: string): string {
  if (gloss === "" || normalize(flavor) === normalize(gloss)) return flavor;
  return `${flavor} — ${gloss}`;
}

/**
 * ボタンの下に添える小さな注釈。**見出しと同じことを言っているなら出さない。**
 * `withGloss` と同じ理由（ポルトガル語では装飾語と訳が重なる）。
 */
export function Gloss({ flavor, text }: { flavor: string; text: string }) {
  if (text === "" || normalize(flavor) === normalize(text)) return null;
  return <small>{text}</small>;
}

/** 上の規則で見出しを描く。 */
export function Kicker({
  flavor,
  gloss,
  className,
}: {
  flavor: string;
  gloss: string;
  className: string;
}) {
  return <p className={className}>{withGloss(flavor, gloss)}</p>;
}

/**
 * `*` で挟んだところを強調して描く。
 *
 * 訳文の中で強調位置は動く（日本語と英語で語順が違う）。
 * JSX に <strong> を直接書くと訳文ごとに構造を作り直す羽目になるので、
 * 印だけ文字列に持たせて、描くときに開く。
 */
export function Rich({ text, emClass }: { text: string; emClass?: string }) {
  const parts = text.split("*");
  return (
    <>
      {parts.map((part, i) =>
        // 奇数番目が `*` に挟まれていた部分
        i % 2 === 1 ? (
          <strong key={i} className={emClass}>
            {part}
          </strong>
        ) : (
          part
        )
      )}
    </>
  );
}
