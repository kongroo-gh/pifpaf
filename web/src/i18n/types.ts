// 表示文言の型。**これが翻訳の契約**。
//
// 言語を足すときは、この型を満たす辞書を1本書くだけでよい。
// 埋め忘れは `tsc --noEmit` が全部並べて教えてくれる（実行時に落ちない）。
//
// 方針:
// - **ポルトガル語の装飾語は訳さない。** BATER! / SENTAR À MESA / CORINGA などは
//   卓の雰囲気そのものなので全言語で共通。訳すのはその下の小さな注釈だけ。
//   だから辞書に入っているのは「注釈」であって「見出し」ではない。
// - **カードの表記も訳さない。** 7♠ や A-2-3 は言語に依存しない。
// - 数を含む文は関数にする。英語の単複や語順は差し込みでは吸収できない。
// - 強調したい部分は `*` で挟む（`<Rich>` が <strong> にする）。
//   翻訳者が訳文の中で強調位置を動かせるようにするため。

export type Lang = "ja" | "en" | "pt";

/** 設定画面に並べる順。 */
export const LANGS: Lang[] = ["ja", "en", "pt"];

export interface Strings {
  meta: {
    /** <html lang> に入れる値 */
    htmlLang: string;
    /** 切替ボタンに出す言語名。その言語自身の表記で書く */
    label: string;
  };

  /** 画面のあいだを行き来する言葉 */
  nav: {
    /** 隅の戻るボタン。一つ前の画面へ */
    back: string;
  };

  /** 対局の途中で卓を降りる。隅の印から開く確認 */
  leave: {
    /** 隅の印の読み上げ */
    open: string;
    /** 確認画面の見出し */
    title: string;
    /** 単機版で失うもの。`*` で挟んだところが強調される */
    warnSolo: (wager: number) => string;
    /** オンラインで起きること */
    warnOnline: string;
    /** 降りる側 */
    confirm: string;
    /** 続ける側 */
    cancel: string;
  };

  settings: {
    /** 歯車を押して開く画面の見出し */
    title: string;
    /** 歯車ボタンの読み上げ */
    open: string;
    close: string;
    language: string;
    speed: string;
    /** 効果音の入切 */
    sound: string;
    soundOn: string;
    soundOff: string;
  };

  /** オンライン対戦。単機版と違い、待ち・切断・再接続の言葉が要る */
  online: {
    /** イントロの ONLINE ボタンの下 */
    enter: string;
    title: string;
    nameLabel: string;
    namePlaceholder: string;
    createTitle: string;
    createHint: string;
    create: string;
    joinTitle: string;
    roomLabel: string;
    roomPlaceholder: string;
    roomHint: string;
    /** ENTRAR の下 */
    join: string;
    /** SAIR の下 */
    leave: string;
    connecting: string;
    reconnecting: string;
    failed: string;
    retry: string;
    /** 卓で人を待っているとき */
    waiting: string;
    waitingHint: string;
    inviteCode: string;
    copyCode: string;
    copied: string;
    host: string;
    you: string;
    hostOnly: string;
    /** COMEÇAR の下。4人そろったら始める */
    startFull: string;
    /** まだ4人そろっていないとき、あと何人かを添える */
    needMore: (n: number) => string;
    /** CHAMAR A CPU の下。人が集まらないとき、空席を CPU で埋めて始める */
    callBots: (n: number) => string;
    /** CPU を呼ぶ選択に添える一言 */
    callBotsHint: string;
    emptySeat: string;
    botSeat: string;
    offline: string;
    /** 相手の番を待っているとき */
    theirTurn: (name: string) => string;
    /** 自分が観戦（席が無い）とき */
    spectating: string;
    /** 結果画面で、まだ押していない人がいるとき */
    waitingForNext: string;
    /** 誰かの通信が切れて、戻りを待っているとき。ALGUÉM SUMIU の続き */
    away: string;
    /** 誰が消えたか。**連ね方が言語ごとに違う**ので配列で渡す */
    awayWho: (names: string[]) => string;
    /** あと何秒待つか。0 になったら卓は畳まれる */
    awayCountdown: (seconds: number) => string;
    /** 人が抜けて卓を畳んだとき。MESA DESFEITA の続き */
    closed: string;
    /** 誰が抜けたか。**連ね方が言語ごとに違う**ので配列で渡す */
    closedBy: (names: string[]) => string;
    /** 一戦が終わったことの念押し */
    closedNote: string;
    /** VOLTAR の下。行き先はメインメニュー */
    closedBack: string;
  };

  intro: {
    body1: string;
    body2: string;
    warn: string;
    /** SENTAR À MESA の下 */
    sit: (bankroll: number) => string;
    /** AS REGRAS の下 */
    rules: string;
  };

  betting: {
    /** A APOSTA の続き */
    kicker: string;
    bankroll: string;
    brokeBody1: string;
    brokeBody2: string;
    /** PEGAR EMPRESTADO の下 */
    borrow: (amount: number) => string;
    body1: string;
    body2: string;
    rules: string;
  };

  topbar: {
    round: (n: number) => string;
    wager: string;
    rules: string;
    vira: string;
    buyViraAria: (card: string) => string;
    viraGone: string;
  };

  speed: {
    FAST: string;
    NORMAL: string;
    SLOW: string;
  };

  table: {
    /** MONTE / の続き */
    stock: string;
    /** DESCARTE / の続き */
    discard: string;
    drawAria: string;
    takeDiscardAria: (card: string) => string;
    takeHint: string;
  };

  hand: {
    sort: string;
    /** 拾ったばかりの札に付く小さな印。1〜2文字に収める */
    lockTag: string;
    cardAria: (card: string, locked: boolean) => string;
  };

  turn: {
    folded: string;
    over: string;
    waiting: (name: string) => string;
    firstDraw: string;
    keepDecision: string;
    draw: string;
    discard: string;
  };

  actions: {
    /** COMPRAR の下 */
    draw: string;
    /** DESCARTAR の下 */
    discard: string;
    /** BATER! の下 */
    canBater: string;
    cannotBater: string;
  };

  fold: {
    /** A MÃO — の続き */
    kicker: string;
    title: string;
    note: (lossPlay: number, lossCom10: number) => string;
    noteFold: (lossFold: number) => string;
    chipsInHand: (chips: number) => string;
    /** JOGAR の下 */
    play: string;
    /** CORRER の下 */
    fold: (lossFold: number) => string;
  };

  keep: {
    /** PRIMEIRA MÃO — の続き */
    kicker: string;
    title: string;
    /** 狭い画面では畳まれる前半 */
    noteLong: string;
    note: string;
    /** FICAR の下 */
    keep: string;
    /** RECUSAR の下 */
    reject: string;
  };

  intercept: {
    /** BATER NO LIXO — の続き */
    kicker: string;
    title: string;
    noteLong: string;
    note: string;
    /** BATER! の下 */
    take: string;
    /** PASSAR の下 */
    pass: string;
  };

  result: {
    /** FIM DA RODADA — の続き */
    kicker: string;
    noWinner: string;
    youWon: string;
    theyWon: (name: string) => string;
    revealLabel: string;
    revealCount: (n: number) => string;
    trinca: string;
    sequence: string;
    took: string;
    noChange: string;
    bust: string;
    streak: (name: string, n: number) => string;
    /** CONTINUAR の下 */
    next: string;
    /** 「次へ」を押したあと、誰を待っているか。**連ね方も言語ごとに違う**ので配列で渡す */
    waitingFor: (names: string[]) => string;
  };

  matchOver: {
    winLead: string;
    loseLead: string;
    chipsLeft: (n: number) => string;
    times: (x: string) => string;
    streak: (n: number) => string;
    clean: string;
    withWild: string;
    payout: string;
    bankroll: (n: number) => string;
    /** VOLTAR À MESA の下 */
    back: string;
    brokeTitle: string;
    broke: string;
  };

  dealing: {
    split: string;
    revealVira: string;
    deal: string;
  };

  seat: {
    chipsAria: (n: number) => string;
    handAria: (n: number) => string;
    thinking: string;
    folded: string;
  };

  card: {
    /** describeCard がワイルド札に付ける語 */
    coringa: string;
    /** 読み上げ用のスート名 */
    suits: { S: string; H: string; D: string; C: string };
  };

  /**
   * 席順（0が自分）。ポルトガル語の異名は players.ts が持ち、
   * ここは呼び名とその訳だけ。異名は雰囲気なので訳さない。
   *
   * `title` が空文字なら異名だけを出す。ポルトガル語では異名そのものが
   * 肩書きなので、訳を並べると「O Chefe — O Chefe」になってしまうため。
   */
  personas: { name: string; title: string }[];

  rules: RuleStrings;
}

/** ルールブックの文面。節ごとに分けてある。 */
export interface RuleStrings {
  title: string;
  close: string;

  s1: { title: string; body: string };

  s2: {
    title: string;
    deck: string;
    players: string;
    ranks: string;
  };

  s3: {
    title: string;
    body: string;
    example: string;
    note: string;
  };

  s4: {
    title: string;
    trincaHead: string;
    trincaLead: string;
    colCount: string;
    colSuits: string;
    colExample: string;
    /** 枚数の欄。「3枚」「3 cards」 */
    cards: (n: number) => string;
    suits0: string;
    suits1: string;
    suits2: string;
    /** 4枚の例に添える否定 */
    notAllowed: string;
    trincaNote: string;
    sequenceHead: string;
    seqBasic: string;
    seqAce: string;
    seqNoWrap: string;
    wildNote: string;
  };

  s5: {
    title: string;
    step1: string;
    step2: string;
    step3: string;
    note: string;
  };

  s6: {
    title: string;
    lead: string;
    buyVira: string;
    drawFirst: string;
  };

  s7: {
    title: string;
    colShape: string;
    colDetail: string;
    nine: string;
    nineDetail: string;
    ten: string;
    tenDetail: string;
    note: string;
  };

  s8: {
    title: string;
    lead: string;
    p1: string;
    p2: string;
    p3: string;
    p4: string;
  };

  s9: {
    title: string;
    lead: string;
    colCase: string;
    colLoss: string;
    lost: string;
    folded: string;
    com10: string;
    body: string;
    note: string;
  };

  s10: { title: string; body: string };

  s11: {
    title: string;
    lead: string;
    colFactor: string;
    colRate: string;
    chips: string;
    chipsRate: string;
    streak: string;
    streakRate: string;
    wild: string;
    wildRate: string;
    note: string;
  };
}
