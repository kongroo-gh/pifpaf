// ルールブック。遊ぶ人向けの読み物で、ゲームの進行には関与しない。
//
// 実装の根拠は rules.md に置いてあり、こちらはその要点を卓上の言葉に直したもの。
// ルールを変えたときは、rules.md とこの文面の両方を直すこと。
//
// 文面は i18n の辞書（t.rules）が持ち、ここにあるのは組み立てだけ。
// ただし**カードの表記（7♠ や A-2-3）は訳さない**ので、そのまま書いてある。
// 強調は訳文ごとに位置が動くため、辞書側の `*` を <Em> が開く。

import { useT, useLangControl, Rich } from "../i18n";

export interface RuleBookProps {
  onClose: () => void;
}

export function RuleBook({ onClose }: RuleBookProps) {
  const t = useT();
  const r = t.rules;

  return (
    <div className="rulebook" role="dialog" aria-modal="true" aria-label={r.title}>
      <div className="rulebook__sheet">
        <header className="rulebook__head">
          <div>
            <p className="rulebook__kicker">REGRAS DA CASA</p>
            <h2 className="rulebook__title">{r.title}</h2>
          </div>
          <div className="rulebook__headActions">
            {/* 読んでいる最中に言語を変えたくなるので、ここにも置く */}
            <LanguageButton />
            <button type="button" className="rulebook__close" onClick={onClose}>
              {r.close}
            </button>
          </div>
        </header>

        <div className="rulebook__body">
          <Section n="1" title={r.s1.title}>
            <p>
              <Em text={r.s1.body} />
            </p>
          </Section>

          <Section n="2" title={r.s2.title}>
            <ul>
              <li>
                <Em text={r.s2.deck} />
              </li>
              <li>
                <Em text={r.s2.players} />
              </li>
              <li>
                <Em text={r.s2.ranks} />
              </li>
            </ul>
          </Section>

          <Section n="3" title={r.s3.title}>
            <p>
              <Em text={r.s3.body} />
            </p>
            <p className="rulebook__example">
              <Em text={r.s3.example} />
            </p>
            <p className="rulebook__note">{r.s3.note}</p>
          </Section>

          <Section n="4" title={r.s4.title}>
            <h4>{r.s4.trincaHead}</h4>
            <p>{r.s4.trincaLead}</p>
            <table className="rulebook__table">
              <thead>
                <tr>
                  <th>{r.s4.colCount}</th>
                  <th>{r.s4.colSuits}</th>
                  <th>{r.s4.colExample}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{r.s4.cards(3)}</td>
                  <td>{r.s4.suits0}</td>
                  {/* カードの表記は言語に依存しないので、訳さずそのまま置く */}
                  <td className="ok">7♠ 7♥ 7♦</td>
                </tr>
                <tr>
                  <td>{r.s4.cards(4)}</td>
                  <td>{r.s4.suits1}</td>
                  <td className="ok">
                    7♠ 7♣ 7♥ 7♥ <span className="ng">/ 7♠ 7♥ 7♦ 7♣ {r.s4.notAllowed}</span>
                  </td>
                </tr>
                <tr>
                  <td>{r.s4.cards(5)}</td>
                  <td>{r.s4.suits2}</td>
                  <td className="ok">7♠ 7♠ 7♣ 7♣ 7♥</td>
                </tr>
              </tbody>
            </table>
            <p className="rulebook__note">{r.s4.trincaNote}</p>

            <h4>{r.s4.sequenceHead}</h4>
            <ul>
              <li>{r.s4.seqBasic}</li>
              <li>
                {r.s4.seqAce} <span className="ok">A-2-3</span> /{" "}
                <span className="ok">Q-K-A</span>
              </li>
              <li>
                <Em text={r.s4.seqNoWrap} /> <span className="ng">K-A-2</span>
              </li>
            </ul>

            <p className="rulebook__note">{r.s4.wildNote}</p>
          </Section>

          <Section n="5" title={r.s5.title}>
            <ol>
              <li>
                <Em text={r.s5.step1} />
              </li>
              <li>{r.s5.step2}</li>
              <li>
                <Em text={r.s5.step3} />
              </li>
            </ol>
            <p className="rulebook__note">{r.s5.note}</p>
          </Section>

          <Section n="6" title={r.s6.title}>
            <p>{r.s6.lead}</p>
            <ul>
              <li>
                <Em text={r.s6.buyVira} />
              </li>
              <li>
                <Em text={r.s6.drawFirst} />
              </li>
            </ul>
          </Section>

          <Section n="7" title={r.s7.title}>
            <table className="rulebook__table">
              <thead>
                <tr>
                  <th>{r.s7.colShape}</th>
                  <th>{r.s7.colDetail}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{r.s7.nine}</td>
                  <td>{r.s7.nineDetail}</td>
                </tr>
                <tr>
                  <td>{r.s7.ten}</td>
                  <td>{r.s7.tenDetail}</td>
                </tr>
              </tbody>
            </table>
            <p className="rulebook__note">{r.s7.note}</p>
          </Section>

          <Section n="8" title={r.s8.title}>
            <p>
              <Em text={r.s8.lead} />
            </p>
            <ul>
              <li>{r.s8.p1}</li>
              <li>{r.s8.p2}</li>
              <li>{r.s8.p3}</li>
              <li>
                <Em text={r.s8.p4} />
              </li>
            </ul>
          </Section>

          <Section n="9" title={r.s9.title}>
            <p>{r.s9.lead}</p>
            <table className="rulebook__table">
              <thead>
                <tr>
                  <th>{r.s9.colCase}</th>
                  <th>{r.s9.colLoss}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{r.s9.lost}</td>
                  <td>2</td>
                </tr>
                <tr>
                  <td>{r.s9.folded}</td>
                  <td>1</td>
                </tr>
                <tr>
                  <td>{r.s9.com10}</td>
                  <td>3</td>
                </tr>
              </tbody>
            </table>
            <p>
              <Em text={r.s9.body} />
            </p>
            <p className="rulebook__note">{r.s9.note}</p>
          </Section>

          <Section n="10" title={r.s10.title}>
            <p>
              <Em text={r.s10.body} />
            </p>
          </Section>

          <Section n="11" title={r.s11.title}>
            <p>{r.s11.lead}</p>
            <table className="rulebook__table">
              <thead>
                <tr>
                  <th>{r.s11.colFactor}</th>
                  <th>{r.s11.colRate}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{r.s11.chips}</td>
                  <td>{r.s11.chipsRate}</td>
                </tr>
                <tr>
                  <td>{r.s11.streak}</td>
                  <td>{r.s11.streakRate}</td>
                </tr>
                <tr>
                  <td>{r.s11.wild}</td>
                  <td>{r.s11.wildRate}</td>
                </tr>
              </tbody>
            </table>
            <p className="rulebook__note">
              <Em text={r.s11.note} />
            </p>
          </Section>
        </div>

        <footer className="rulebook__foot">
          <button type="button" className="btn btn--again" onClick={onClose}>
            FECHAR<small>{r.close}</small>
          </button>
        </footer>
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rulebook__section">
      <h3>
        <span className="rulebook__num">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

/** 辞書の `*` を、この読み物の強調表示として開く。 */
function Em({ text }: { text: string }) {
  return <Rich text={text} emClass="rulebook__em" />;
}

/** ヘッダーに置く言語切り替え。盤面のものより小さく、言語名だけ。 */
function LanguageButton() {
  const { t, cycleLang } = useLangControl();
  return (
    <button
      type="button"
      className="rulebook__lang"
      onClick={cycleLang}
      aria-label={t.lang.aria(t.meta.label)}
    >
      {t.meta.label}
    </button>
  );
}
