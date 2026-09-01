// 日本語。**元の実装の文面をそのまま移したもの**で、表示は以前と変わらない。
// 卓のならず者じみた口調はこの言語の持ち味なので、他言語もそこは合わせる。

import type { Strings } from "./types";

export const ja: Strings = {
  meta: { htmlLang: "ja", label: "日本語" },

  lang: {
    caption: "言語",
    aria: (current) => `言語: ${current}。押すと切り替わる`,
  },

  intro: {
    body1: "奥の部屋に、四つの椅子。灰皿は満杯で、誰も窓を開けない。",
    body2: "全員が7枚のチップを積む。負けるたびに減り、尽きた者から店を出られなくなる。",
    warn: "最後の一人になるまで、誰も帰れない。",
    sit: (bankroll) => `席に着く（所持金 ${bankroll}）`,
    rules: "ルールを読む",
    disclaimer: "※ 演出です。実際に撃たれることはありません。",
  },

  betting: {
    kicker: "掛け金",
    bankroll: "所持金",
    brokeBody1: "一文無しだ。ファミリーが立て替えてくれるそうだが、",
    brokeBody2: "返せなかったときのことは、聞かないほうがいい。",
    borrow: (amount) => `${amount} 借りる`,
    body1: "4人卓、持ちチップ7枚。最後まで残れば配当がつく。",
    body2: "勝率はおよそ4分の1。配当は残りチップと連勝で 2.0〜5.7倍。",
    rules: "ルールを読む",
  },

  topbar: {
    round: (n) => `第${n}ラウンド`,
    wager: "掛け金",
    rules: "ルール",
    speedCaption: "CPUの速さ",
    speedAria: (label) => `CPUの速さ: ${label}。押すと切り替わる`,
    vira: "ヴィラ",
    buyViraAria: (card) => `ヴィラの ${card} を買う`,
    viraGone: "買われた",
  },

  speed: { FAST: "はやい", NORMAL: "ふつう", SLOW: "じっくり" },

  table: {
    stock: "山札",
    discard: "捨て札",
    drawAria: "山札から1枚引く",
    takeDiscardAria: (card) => `捨て札の ${card} を拾う`,
    takeHint: "タップで拾う",
  },

  hand: {
    sort: "整列",
    lockTag: "拾",
    cardAria: (card, locked) =>
      `${card}${locked ? "（拾ったばかりで捨てられない）" : ""}。ドラッグで並べ替え`,
  },

  turn: {
    folded: "降りた",
    over: "勝負あり",
    waiting: (name) => `${name} の番…`,
    firstDraw: "先手だ。ヴィラを買うか、山札から引くか。",
    keepDecision: "その札、取るか捨てるか。",
    draw: "山札か、捨て札から1枚。",
    discard: "1枚捨てろ。",
  },

  actions: {
    draw: "山札から引く",
    discard: "選んだ札を捨てる",
    canBater: "上がれる",
    cannotBater: "まだ上がれない",
  },

  fold: {
    kicker: "手札を見て決めろ",
    title: "勝負するか、降りるか",
    note: (lossPlay, lossCom10) =>
      `勝負して負ければ *${lossPlay}チップ*、10枚上がりを食らえば *${lossCom10}チップ* 失う。`,
    noteFold: (lossFold) => `降りれば *${lossFold}チップ* で済むが、このラウンドは勝てない。`,
    chipsInHand: (chips) => `手持ち ${chips} チップ`,
    play: "勝負する",
    fold: (lossFold) => `降りる（−${lossFold}）`,
  },

  keep: {
    kicker: "一番手の特権",
    title: "この札を手札に入れるか",
    noteLong: "下の手札と見比べて決めろ。並べ替えてもいい。",
    note: "引き直せるのは*一度きり*。",
    keep: "手札に入れる",
    reject: "捨てて引き直す",
  },

  intercept: {
    kicker: "手番を待たずに",
    title: "その捨て札で上がれる",
    noteLong: "自分の番でなくても拾って上がれる。",
    note: "見送れば*次の者*に権利が移る。",
    take: "拾って上がる",
    pass: "見送る",
  },

  result: {
    kicker: "ラウンド終了",
    noWinner: "決着つかず",
    youWon: "あんたが取った",
    theyWon: (name) => `${name} が取った`,
    revealLabel: "上がり手",
    revealCount: (n) => `${n}枚`,
    trinca: "組",
    sequence: "階段",
    took: "取った",
    noChange: "±0",
    bust: "破産",
    streak: (name, n) => `${name} が *${n}連勝*`,
    next: "次のラウンドへ",
  },

  matchOver: {
    winLead: "テーブルに残ったのはあんただけだ。",
    loseLead: "チップが尽きた。掛け金は戻らない。",
    chipsLeft: (n) => `残りチップ ${n}`,
    times: (x) => `${x}倍`,
    streak: (n) => `${n}連勝`,
    clean: "ワイルド無しの上がり",
    withWild: "ワイルドを使った上がり",
    payout: "配当",
    bankroll: (n) => `所持金 ${n}`,
    back: "卓に戻る",
    brokeTitle: "...",
    broke: "一文無しだ",
  },

  dealing: {
    split: "山を割る",
    revealVira: "ヴィラをめくる",
    deal: "3枚ずつ配る",
  },

  seat: {
    chipsAria: (n) => `残りチップ ${n}`,
    handAria: (n) => `手札 ${n}枚`,
    thinking: "…考えている",
    folded: "降りた",
  },

  card: {
    coringa: "コリンガ",
    suits: { S: "スペード", H: "ハート", D: "ダイヤ", C: "クラブ" },
  },

  personas: [
    { name: "あなた", title: "よそ者" },
    { name: "ドン・ヴィエイラ", title: "頭目" },
    { name: "ゼ・ナヴァーリャ", title: "剃刀" },
    { name: "ドナ・ローザ", title: "未亡人" },
  ],

  rules: {
    title: "この卓の決まり",
    close: "閉じる",

    s1: {
      title: "目的",
      body:
        "9枚の手札をすべて*役*にして、最初に「*バテル*」と宣言した者がその" +
        "ラウンドを取る。取られた者はチップを失い、尽きた者から卓を去る。" +
        "最後に残った一人が場の金を持って帰る。",
    },

    s2: {
      title: "卓と札",
      deck: "ジョーカー抜き52枚を*2組*（計104枚）。同じ札が2枚ずつある",
      players: "4人。各自に9枚配り、残りが山札",
      ranks: "数字の並びは 2 3 4 … K。*A は一番上にも一番下にも使える*",
    },

    s3: {
      title: "ヴィラとコリンガ",
      body:
        "配り終えたら山から1枚を表にする。これが*ヴィラ*。" +
        "その*次のランク*で、かつ*ヴィラと同じ記号*の札だけがワイルド（＝*コリンガ*）になる。",
      example: "ヴィラが 7♠ なら、ワイルドは *8♠ だけ*。8♥ 8♦ 8♣ はただの札。",
      note: "2組デッキなので、コリンガは103枚中わずか2枚。引けたら大きい。",
    },

    s4: {
      title: "役",
      trincaHead: "トリンカ（組）— 同じランク",
      trincaLead: "枚数によって、記号の条件が変わる。",
      colCount: "枚数",
      colSuits: "記号",
      colExample: "例",
      cards: (n) => `${n}枚`,
      suits0: "すべて違う",
      suits1: "1つ重複する",
      suits2: "2つ重複する",
      notAllowed: "は不可",
      trincaNote: "6枚組は無い。同じランクが6枚あるなら、3枚組が2つになる。",
      sequenceHead: "シーケンス（階段）— 同じ記号の連番",
      seqBasic: "同じ記号で数字が続く3枚以上",
      seqAce: "A は両端で使える。",
      seqNoWrap: "ただし*A をまたぐことはできない。*",
      wildNote: "どちらの役でも、足りない札はコリンガで代用できる。",
    },

    s5: {
      title: "手番",
      step1: "*1枚取る* — 山札の一番上か、捨て札の一番上（＝直前の誰かが捨てた札）",
      step2: "10枚を組み替えて、上がれるか確かめる",
      step3: "*1枚捨てる* — 捨てた札は次の者から見える",
      note:
        "捨て札から拾った札は、その手番でそのまま捨て直せない。" +
        "ただし上がるときに余らせるのは構わない。",
    },

    s6: {
      title: "一番手の特権",
      lead: "各ラウンドの一番手だけ、最初の手番で次のどちらかを選べる。",
      buyVira: "*ヴィラを買う* — 場のヴィラをそのまま手札に入れる",
      drawFirst:
        "*引いてから決める* — 山札から1枚引き、見てから取るか捨てるか決める。" +
        "捨てれば引き直せるが、*それは一度きり*",
    },

    s7: {
      title: "上がり（バテル）",
      colShape: "形",
      colDetail: "内容",
      nine: "9枚",
      nineDetail: "10枚のうち9枚が役。余り1枚を捨てて上がる（3+3+3 か 4+5）",
      ten: "10枚",
      tenDetail: "10枚すべてが役。捨てずに上がる（3+3+4 か 5+5）",
      note: "10枚で上がられた者は、失うチップが1枚増える。",
    },

    s8: {
      title: "捨て札への割り込み",
      lead:
        "*あと1枚で上がれるなら、自分の番を待たなくていい。*" +
        "誰かが捨てた札がその1枚なら、手番を飛ばして拾い、その場で上がれる。",
      p1: "拾えるのは捨てられた直後の1枚だけ",
      p2: "拾った札は役の一部になっていること。取ってすぐ捨てるのは認めない",
      p3: "捨てた本人は割り込めない。降りている者も割り込めない",
      p4: "*複数が同時に成立したら、捨てた人の次の席から順に権利が回る。*見送れば次の者へ",
    },

    s9: {
      title: "チップと勝敗",
      lead: "全員が7チップを持って始める。ラウンドを取られると減る。",
      colCase: "状況",
      colLoss: "失うチップ",
      lost: "勝負して負けた",
      folded: "降りていた",
      com10: "10枚上がりを食らった",
      body: "0になった者は*破産*して卓を去る。最後に残った一人がマッチの勝者。",
      note: "山札が尽きたら、捨て札がそのままの順で新しい山札になる。",
    },

    s10: {
      title: "降りる（コヘール）",
      body:
        "ラウンドが始まる前に手札を見て、勝ち目が薄ければ*降りられる*。" +
        "失うのは1チップで済むが、そのラウンドは勝てない。",
    },

    s11: {
      title: "配当",
      lead: "マッチを制すれば掛け金が戻る。倍率は勝ち方で変わる。",
      colFactor: "要素",
      colRate: "倍率",
      chips: "残りチップ（1枚 → 7枚）",
      chipsRate: "2.7 → 4.5 倍",
      streak: "連勝（2連勝目から）",
      streakRate: "+0.4 ずつ、最大 +1.2",
      wild: "決め手にコリンガを使った",
      wildRate: "×0.75",
      note:
        "おおむね *2.0〜5.7倍*。コリンガ無しで上がったほうが難しいぶん、配当は高い。" +
        "負ければ掛け金は戻らない。",
    },
  },
};
