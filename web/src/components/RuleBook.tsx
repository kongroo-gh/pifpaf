// ルールブック。遊ぶ人向けの読み物で、ゲームの進行には関与しない。
//
// 実装の根拠は rules.md に置いてあり、こちらはその要点を卓上の言葉に直したもの。
// ルールを変えたときは、rules.md とこの文面の両方を直すこと。

export interface RuleBookProps {
  onClose: () => void;
}

export function RuleBook({ onClose }: RuleBookProps) {
  return (
    <div className="rulebook" role="dialog" aria-modal="true" aria-label="ルールブック">
      <div className="rulebook__sheet">
        <header className="rulebook__head">
          <div>
            <p className="rulebook__kicker">REGRAS DA CASA</p>
            <h2 className="rulebook__title">この卓の決まり</h2>
          </div>
          <button type="button" className="rulebook__close" onClick={onClose}>
            閉じる
          </button>
        </header>

        <div className="rulebook__body">
          <Section n="1" title="目的">
            <p>
              9枚の手札をすべて<Em>役</Em>にして、最初に「<Em>バテル</Em>」と宣言した者がその
              ラウンドを取る。取られた者はチップを失い、尽きた者から卓を去る。
              最後に残った一人が場の金を持って帰る。
            </p>
          </Section>

          <Section n="2" title="卓と札">
            <ul>
              <li>ジョーカー抜き52枚を<Em>2組</Em>（計104枚）。同じ札が2枚ずつある</li>
              <li>4人。各自に9枚配り、残りが山札</li>
              <li>
                並びは 2 3 4 … K A。<Em>2 が一番下、A が一番上</Em>
              </li>
            </ul>
          </Section>

          <Section n="3" title="ヴィラとコリンガ">
            <p>
              配り終えたら山から1枚を表にする。これが<Em>ヴィラ</Em>。
              その<Em>次のランク</Em>で、かつ<Em>ヴィラと同じ記号</Em>の札だけがワイルド
              （＝<Em>コリンガ</Em>）になる。
            </p>
            <Example>
              ヴィラが 7♠ なら、ワイルドは <Em>8♠ だけ</Em>。8♥ 8♦ 8♣ はただの札。
            </Example>
            <p className="rulebook__note">
              2組デッキなので、コリンガは103枚中わずか2枚。引けたら大きい。
            </p>
          </Section>

          <Section n="4" title="役">
            <h4>トリンカ（組）— 同じランク</h4>
            <p>枚数によって、記号の条件が変わる。</p>
            <table className="rulebook__table">
              <thead>
                <tr>
                  <th>枚数</th>
                  <th>記号</th>
                  <th>例</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>3枚</td>
                  <td>すべて違う</td>
                  <td className="ok">7♠ 7♥ 7♦</td>
                </tr>
                <tr>
                  <td>4枚</td>
                  <td>1つ重複する</td>
                  <td className="ok">
                    7♠ 7♣ 7♥ 7♥ <span className="ng">／ 7♠ 7♥ 7♦ 7♣ は不可</span>
                  </td>
                </tr>
                <tr>
                  <td>5枚</td>
                  <td>2つ重複する</td>
                  <td className="ok">7♠ 7♠ 7♣ 7♣ 7♥</td>
                </tr>
              </tbody>
            </table>
            <p className="rulebook__note">
              6枚組は無い。同じランクが6枚あるなら、3枚組が2つになる。
            </p>

            <h4>シーケンス（階段）— 同じ記号の連番</h4>
            <ul>
              <li>同じ記号で数字が続く3枚以上</li>
              <li>
                <Em>A をまたぐ並びは作れない。</Em>Q-K-A は良いが、K-A-2 や A-2-3 は役にならない
              </li>
            </ul>

            <p className="rulebook__note">
              どちらの役でも、足りない札はコリンガで代用できる。
            </p>
          </Section>

          <Section n="5" title="手番">
            <ol>
              <li>
                <Em>1枚取る</Em> — 山札の一番上か、捨て札の一番上（＝直前の誰かが捨てた札）
              </li>
              <li>10枚を組み替えて、上がれるか確かめる</li>
              <li>
                <Em>1枚捨てる</Em> — 捨てた札は次の者から見える
              </li>
            </ol>
            <p className="rulebook__note">
              捨て札から拾った札は、その手番でそのまま捨て直せない。
              ただし上がるときに余らせるのは構わない。
            </p>
          </Section>

          <Section n="6" title="一番手の特権">
            <p>各ラウンドの一番手だけ、最初の手番で次のどちらかを選べる。</p>
            <ul>
              <li>
                <Em>ヴィラを買う</Em> — 場のヴィラをそのまま手札に入れる
              </li>
              <li>
                <Em>引いてから決める</Em> — 山札から1枚引き、見てから取るか捨てるか決める。
                捨てれば引き直せるが、<Em>それは一度きり</Em>
              </li>
            </ul>
          </Section>

          <Section n="7" title="上がり（バテル）">
            <table className="rulebook__table">
              <thead>
                <tr>
                  <th>形</th>
                  <th>内容</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>9枚</td>
                  <td>10枚のうち9枚が役。余り1枚を捨てて上がる（3+3+3 か 4+5）</td>
                </tr>
                <tr>
                  <td>
                    10枚<span className="rulebook__badge">重い</span>
                  </td>
                  <td>10枚すべてが役。捨てずに上がる（3+3+4 か 5+5）</td>
                </tr>
              </tbody>
            </table>
            <p className="rulebook__note">10枚で上がられた者は、失うチップが1枚増える。</p>
          </Section>

          <Section n="8" title="捨て札への割り込み">
            <p>
              <Em>あと1枚で上がれるなら、自分の番を待たなくていい。</Em>
              誰かが捨てた札がその1枚なら、手番を飛ばして拾い、その場で上がれる。
            </p>
            <ul>
              <li>拾えるのは捨てられた直後の1枚だけ</li>
              <li>拾った札は役の一部になっていること。取ってすぐ捨てるのは認めない</li>
              <li>捨てた本人は割り込めない。降りている者も割り込めない</li>
              <li>
                <Em>複数が同時に成立したら、捨てた人の次の席から順に権利が回る。</Em>
                見送れば次の者へ
              </li>
            </ul>
          </Section>

          <Section n="9" title="チップと勝敗">
            <p>全員が7チップを持って始める。ラウンドを取られると減る。</p>
            <table className="rulebook__table">
              <thead>
                <tr>
                  <th>状況</th>
                  <th>失うチップ</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>勝負して負けた</td>
                  <td>2</td>
                </tr>
                <tr>
                  <td>降りていた</td>
                  <td>1</td>
                </tr>
                <tr>
                  <td>10枚上がりを食らった</td>
                  <td>3</td>
                </tr>
              </tbody>
            </table>
            <p>
              0になった者は<Em>破産</Em>して卓を去る。最後に残った一人がマッチの勝者。
            </p>
            <p className="rulebook__note">
              山札が尽きたら、捨て札がそのままの順で新しい山札になる。
            </p>
          </Section>

          <Section n="10" title="降りる（コヘール）">
            <p>
              ラウンドが始まる前に手札を見て、勝ち目が薄ければ<Em>降りられる</Em>。
              失うのは1チップで済むが、そのラウンドは勝てない。
            </p>
          </Section>

          <Section n="11" title="配当">
            <p>マッチを制すれば掛け金が戻る。倍率は勝ち方で変わる。</p>
            <table className="rulebook__table">
              <thead>
                <tr>
                  <th>要素</th>
                  <th>倍率</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>残りチップ（1枚 → 7枚）</td>
                  <td>2.7 → 4.5 倍</td>
                </tr>
                <tr>
                  <td>連勝（2連勝目から）</td>
                  <td>+0.4 ずつ、最大 +1.2</td>
                </tr>
                <tr>
                  <td>決め手にコリンガを使った</td>
                  <td>×0.75</td>
                </tr>
              </tbody>
            </table>
            <p className="rulebook__note">
              おおむね <Em>2.0〜5.7倍</Em>。コリンガ無しで上がったほうが難しいぶん、配当は高い。
              負ければ掛け金は戻らない。
            </p>
          </Section>
        </div>

        <footer className="rulebook__foot">
          <button type="button" className="btn btn--again" onClick={onClose}>
            FECHAR<small>閉じる</small>
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

function Em({ children }: { children: React.ReactNode }) {
  return <strong className="rulebook__em">{children}</strong>;
}

function Example({ children }: { children: React.ReactNode }) {
  return <p className="rulebook__example">{children}</p>;
}
