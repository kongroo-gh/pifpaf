// English.
//
// 日本語版の突き放した口調をそのまま英語にしている。丁寧に均すと卓の雰囲気が消える。
// ポルトガル語の見出し（BATER! / SENTAR À MESA など）とカード表記は訳さない。

import type { Strings } from "./types";

export const en: Strings = {
  meta: { htmlLang: "en", label: "English" },

  nav: {
    back: "Back",
  },

  settings: {
    title: "Settings",
    open: "Open settings",
    close: "Close",
    language: "Language",
    speed: "CPU speed",
    speedNote: "About two seconds a turn on Normal. The deal always plays at the same pace.",
    sound: "Sound",
    soundOn: "On",
    soundOff: "Off",
    soundNote: "The table's sounds are synthesised on your device. Nothing plays until you touch the screen.",
  },

  online: {
    enter: "Play with others",
    title: "Join a table",
    nameLabel: "Name",
    namePlaceholder: "Nobody",
    createTitle: "Create a table",
    createHint: "You will host it. A short code is generated automatically.",
    create: "Create table",
    joinTitle: "Join with a code",
    roomLabel: "Table code",
    roomPlaceholder: "e.g. 7K3M",
    roomHint: "Enter the four characters sent by the host.",
    join: "Sit down",
    leave: "Leave the table",
    connecting: "Looking for the online table…",
    reconnecting: "Restoring the table connection…",
    failed: "The online table could not be opened",
    retry: "Back to the table entrance",
    waiting: "Waiting for players",
    waitingHint: "Share this code. Players will appear here as they take a seat.",
    inviteCode: "Table code",
    copyCode: "Copy code",
    copied: "Copied",
    host: "Host",
    you: "You",
    hostOnly: "The host will start the game.",
    startFull: "Everyone's here. Start",
    needMore: (n) => `${n} more to start`,
    callBots: (n) => `Fill ${n} empty seats with CPUs`,
    callBotsHint: "If nobody shows up, you can call in CPUs and start.",
    emptySeat: "empty",
    botSeat: "CPU",
    offline: "disconnected",
    theirTurn: (name) => `${name} is up…`,
    spectating: "Watching only (no seat)",
    waitingForNext: "Waiting for the others…",
  },

  intro: {
    body1: "Four chairs in the back room. The ashtray is full and nobody opens a window.",
    body2:
      "Everyone stacks seven chips. They go down each time you lose, " +
      "and whoever runs out doesn't walk back out the door.",
    warn: "Nobody leaves until one is left.",
    sit: (bankroll) => `Take a seat (purse ${bankroll})`,
    rules: "Read the rules",
  },

  betting: {
    kicker: "The stake",
    bankroll: "Purse",
    brokeBody1: "You're cleaned out. The family will front you the money,",
    brokeBody2: "but don't ask what happens if you can't pay it back.",
    borrow: (amount) => `Borrow ${amount}`,
    body1: "Four at the table, seven chips each. Last one standing gets paid.",
    body2: "Roughly one chance in four. Payout runs 2.0–5.7× on chips left and streak.",
    rules: "Read the rules",
  },

  topbar: {
    round: (n) => `Round ${n}`,
    wager: "Stake",
    rules: "Rules",
    vira: "VIRA",
    buyViraAria: (card) => `Buy the vira, ${card}`,
    viraGone: "taken",
  },

  speed: { FAST: "Fast", NORMAL: "Normal", SLOW: "Slow" },

  table: {
    stock: "Stock",
    discard: "Discard",
    drawAria: "Draw one from the stock",
    takeDiscardAria: (card) => `Take ${card} from the discard pile`,
    takeHint: "Tap to take",
  },

  hand: {
    sort: "Sort",
    lockTag: "T",
    cardAria: (card, locked) =>
      `${card}${locked ? " (just taken, cannot be discarded)" : ""}. Drag to reorder`,
  },

  turn: {
    folded: "Folded",
    over: "Round over",
    waiting: (name) => `${name} is up…`,
    firstDraw: "You're first. Buy the vira, or draw from the stock.",
    keepDecision: "That card. Keep it or throw it.",
    draw: "One card. Stock or discard.",
    discard: "Throw one.",
  },

  actions: {
    draw: "Draw from stock",
    discard: "Discard selected",
    canBater: "You can go out",
    cannotBater: "Not yet",
  },

  fold: {
    kicker: "Look at your hand and decide",
    title: "Play it, or fold",
    note: (lossPlay, lossCom10) =>
      `Play and lose, that's *${lossPlay} chips*. Take a ten-card bater and it's *${lossCom10}*.`,
    noteFold: (lossFold) => `Fold and it's only *${lossFold}*, but you can't win the round.`,
    chipsInHand: (chips) => `${chips} chips in hand`,
    play: "Play",
    fold: (lossFold) => `Fold (−${lossFold})`,
  },

  keep: {
    kicker: "First player's privilege",
    title: "Keep this card?",
    noteLong: "Weigh it against the hand below. Reorder it if you like.",
    note: "You get *one* redraw.",
    keep: "Take it",
    reject: "Throw it and redraw",
  },

  intercept: {
    kicker: "Don't wait your turn",
    title: "That discard wins it for you",
    noteLong: "You can take it and go out even when it isn't your turn.",
    note: "Pass and the right moves to the *next player*.",
    take: "Take it and go out",
    pass: "Pass",
  },

  result: {
    kicker: "End of round",
    noWinner: "No decision",
    youWon: "You took it",
    theyWon: (name) => `${name} took it`,
    revealLabel: "Winning hand",
    revealCount: (n) => `${n} cards`,
    trinca: "Set",
    sequence: "Run",
    took: "Took it",
    noChange: "±0",
    bust: "Busted",
    streak: (name, n) => `${name} is on a *${n}-round streak*`,
    next: "Next round",
  },

  matchOver: {
    winLead: "You're the only one left at the table.",
    loseLead: "Your chips are gone. The stake stays here.",
    chipsLeft: (n) => `${n} chips left`,
    times: (x) => `${x}×`,
    streak: (n) => `${n}-round streak`,
    clean: "Went out without a wild",
    withWild: "Went out using a wild",
    payout: "Payout",
    bankroll: (n) => `Purse ${n}`,
    back: "Back to the table",
    brokeTitle: "...",
    broke: "Not a penny left",
  },

  dealing: {
    split: "Cutting the deck",
    revealVira: "Turning the vira",
    deal: "Three at a time",
  },

  seat: {
    chipsAria: (n) => `${n} chips left`,
    handAria: (n) => `${n} cards in hand`,
    thinking: "…thinking",
    folded: "Folded",
  },

  card: {
    coringa: "coringa",
    suits: { S: "spades", H: "hearts", D: "diamonds", C: "clubs" },
  },

  personas: [
    { name: "You", title: "The Outsider" },
    { name: "Don Vieira", title: "The Boss" },
    { name: "Zé Navalha", title: "The Razor" },
    { name: "Dona Rosa", title: "The Widow" },
  ],

  rules: {
    title: "House rules",
    close: "Close",

    s1: {
      title: "The point",
      body:
        "Turn all nine cards in your hand into *melds* and be the first to call " +
        "“*bater*” — that takes the round. Whoever loses it pays chips, and " +
        "whoever runs out leaves the table. The last one sitting takes the money home.",
    },

    s2: {
      title: "Table and cards",
      deck: "Two 52-card decks, no jokers (*104 cards*). Every card exists twice",
      players: "Four players. Nine cards each; the rest is the stock",
      ranks: "Ranks run 2 3 4 … K. *The ace works at either end*",
    },

    s3: {
      title: "Vira and coringa",
      body:
        "Once the cards are dealt, one is turned face up from the stock. That's the *vira*. " +
        "Only the *next rank up* in the *same suit as the vira* is wild — the *coringa*.",
      example: "Vira 7♠, so *only 8♠* is wild. 8♥ 8♦ 8♣ are ordinary cards.",
      note: "Two decks means just two coringas among 103 cards. Drawing one is worth a lot.",
    },

    s4: {
      title: "Melds",
      trincaHead: "Trinca (set) — same rank",
      trincaLead: "The suit requirement changes with the size.",
      colCount: "Size",
      colSuits: "Suits",
      colExample: "Example",
      cards: (n) => `${n} cards`,
      suits0: "all different",
      suits1: "one repeated",
      suits2: "two repeated",
      notAllowed: "does not count",
      trincaNote: "There is no six-card set. Six of a rank is simply two sets of three.",
      sequenceHead: "Sequence (run) — same suit in order",
      seqBasic: "Three or more in a row, all the same suit",
      seqAce: "The ace works at either end.",
      seqNoWrap: "But *you cannot run through the ace.*",
      wildNote: "In either meld, a missing card can be covered by the coringa.",
    },

    s5: {
      title: "Your turn",
      step1: "*Take one* — the top of the stock, or the top discard (what the last player threw)",
      step2: "Rearrange your ten and see whether you can go out",
      step3: "*Throw one* — the next player can see what you threw",
      note:
        "A card you took from the discard cannot be thrown again on the same turn. " +
        "Leaving it over when you go out is fine.",
    },

    s6: {
      title: "First player's privilege",
      lead: "Only the first player of each round gets a choice on their opening turn.",
      buyVira: "*Buy the vira* — take the face-up vira straight into your hand",
      drawFirst:
        "*Draw, then decide* — take one from the stock, look at it, and keep or throw it. " +
        "Throwing it lets you draw again, but *only once*",
    },

    s7: {
      title: "Going out (bater)",
      colShape: "Shape",
      colDetail: "What it means",
      nine: "9 cards",
      nineDetail: "Nine of your ten are melded. Throw the odd one and go out (3+3+3 or 4+5)",
      ten: "10 cards",
      tenDetail: "All ten are melded. Go out without throwing (3+3+4 or 5+5)",
      note: "Anyone beaten by a ten-card bater pays one extra chip.",
    },

    s8: {
      title: "Cutting in on a discard",
      lead:
        "*If you're one card from going out, you don't have to wait your turn.* " +
        "When somebody throws that card, take it out of turn and go out on the spot.",
      p1: "Only the card that was just thrown can be taken",
      p2: "The card you take has to be part of a meld. Taking it and throwing it is not allowed",
      p3: "Whoever threw it cannot cut in. Neither can anyone who folded",
      p4:
        "*If several people qualify at once, the right passes from the seat after the thrower.*" +
        " Pass, and it moves to the next",
    },

    s9: {
      title: "Chips and the match",
      lead: "Everyone starts on seven chips. Losing a round costs you.",
      colCase: "Situation",
      colLoss: "Chips lost",
      lost: "Played and lost",
      folded: "Had folded",
      com10: "Beaten by a ten-card bater",
      body: "Anyone reaching zero is *busted* and leaves. The last one sitting wins the match.",
      note: "When the stock runs out, the discard pile becomes the new stock in the same order.",
    },

    s10: {
      title: "Folding (correr)",
      body:
        "Look at your hand before the round starts, and *fold* if it looks hopeless. " +
        "It only costs one chip, but you cannot win that round.",
    },

    s11: {
      title: "Payout",
      lead: "Win the match and the stake comes back. The multiplier depends on how you won.",
      colFactor: "Factor",
      colRate: "Multiplier",
      chips: "Chips left (1 → 7)",
      chipsRate: "2.7 → 4.5×",
      streak: "Streak (from the second win)",
      streakRate: "+0.4 each, up to +1.2",
      wild: "Used a coringa to finish",
      wildRate: "×0.75",
      note:
        "Roughly *2.0–5.7×*. Going out without a coringa is harder, so it pays more. " +
        "Lose and the stake does not come back.",
    },
  },
};
