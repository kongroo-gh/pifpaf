import { useEffect, useRef } from "react";
import { useT } from "../i18n";
import { LanguagePills } from "./Settings";

/** 現在の表示言語に合わせて、Pif Paf の文化的背景を紹介する。 */
export function AboutPifPaf({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const t = useT();

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="about-pifpaf-title"
      onCancel={onClose}
      style={{ width: "min(640px, calc(100vw - 32px))", maxHeight: "calc(100dvh - 32px)", boxSizing: "border-box", overflowY: "auto", padding: "24px", background: "var(--night)", color: "var(--moon)", border: "1px solid var(--star)", borderRadius: "16px", boxShadow: "0 24px 80px #000b" }}
    >
      <article lang={t.meta.htmlLang} style={{ lineHeight: 1.9 }}>
        <h1 id="about-pifpaf-title" style={{ fontSize: "1.5rem", marginTop: 0 }}>{t.about.title}</h1>
        <LanguagePills />
        {t.about.sections.map(section => (
          <section key={section.title}>
            <h2 style={{ fontSize: "1.1rem", color: "var(--star)", marginTop: "24px" }}>{section.title}</h2>
            {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          </section>
        ))}
        <button type="button" className="btn btn--rules btn--strip" onClick={onClose}>{t.about.back}</button>
      </article>
    </dialog>
  );
}
