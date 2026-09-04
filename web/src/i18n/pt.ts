// Português (Brasil)。この卓の「地元の言葉」。
//
// 他の言語では雰囲気づけのために残しているポルトガル語の見出し
// （BATER! / SENTAR À MESA / CORINGA など）が、ここでは普通の言葉になる。
// そのぶん見出しと注釈が同じことを言わないよう、注釈は「補う」側に寄せてある。
//
// 席の肩書き（personas[].title）は空にしてある。異名（O Chefe など）が
// もともとポルトガル語なので、訳を並べると同じ語が2回出てしまう。
//
// 用語は本家の呼び方に合わせる: vira / coringa / trinca / sequência /
// bater（上がる）/ correr（降りる）/ monte（山札）/ lixo（捨て札）。

import type { Strings } from "./types";

export const pt: Strings = {
  meta: { htmlLang: "pt-BR", label: "Português" },

  nav: {
    back: "Voltar",
  },

  leave: {
    open: "Deixar a mesa",
    title: "Deixar a mesa",
    warnSolo: (wager) => `Se sair agora, os *${wager}* apostados ficam na mesa.`,
    warnOnline: "Sair desfaz a mesa. A partida acaba para todos que estão nela.",
    confirm: "Sair",
    cancel: "Ficar",
  },

  settings: {
    title: "Ajustes",
    open: "Abrir os ajustes",
    close: "Fechar",
    language: "Idioma",
    speed: "Velocidade da CPU",
    sound: "Som",
    soundOn: "Ligado",
    soundOff: "Desligado",
  },

  online: {
    enter: "Jogar com outros",
    title: "Entrar numa mesa",
    nameLabel: "Nome",
    namePlaceholder: "Ninguém",
    createTitle: "Criar uma mesa",
    createHint: "Você será o anfitrião. Um código curto será criado automaticamente.",
    create: "Criar mesa",
    joinTitle: "Entrar com código",
    roomLabel: "Código da mesa",
    roomPlaceholder: "ex.: 7K3M",
    roomHint: "Digite os quatro caracteres enviados pelo anfitrião.",
    join: "Sentar",
    leave: "Sair da mesa",
    connecting: "Procurando a mesa online…",
    reconnecting: "Restaurando a conexão com a mesa…",
    failed: "Não foi possível abrir a mesa online",
    retry: "Voltar à entrada",
    waiting: "Esperando jogadores",
    waitingHint: "Compartilhe este código. Os jogadores aparecerão aqui ao sentar.",
    inviteCode: "Código da mesa",
    copyCode: "Copiar código",
    copied: "Copiado",
    host: "Anfitrião",
    you: "Você",
    hostOnly: "O anfitrião inicia o jogo.",
    startFull: "Todos aqui. Começar",
    needMore: (n) => `Faltam ${n} para começar`,
    callBots: (n) => `Completar ${n} lugares com a CPU`,
    callBotsHint: "Se ninguém aparecer, chame a CPU e comece.",
    emptySeat: "vazio",
    botSeat: "CPU",
    offline: "desconectado",
    theirTurn: (name) => `Vez de ${name}…`,
    spectating: "Só assistindo (sem lugar)",
    waitingForNext: "Esperando os outros…",
    away: "Conexão caiu",
    awayWho: (names) => `${names.join(", ")} caiu.`,
    awayCountdown: (seconds) => `Segurando a mesa por ${seconds}s. Depois disso, ela se desfaz.`,
    closed: "Mesa desfeita",
    closedBy: (names) => `${names.join(", ")} saiu da mesa.`,
    closedNote: "Ninguém assume o lugar vazio. Esta acaba aqui.",
    closedBack: "Voltar ao menu",
  },

  intro: {
    body1: "Quatro cadeiras nos fundos. O cinzeiro está cheio e ninguém abre a janela.",
    body2:
      "Cada um põe sete fichas na mesa. Elas caem a cada derrota, " +
      "e quem fica sem elas não sai mais pela porta.",
    warn: "Ninguém vai embora até sobrar um.",
    sit: (bankroll) => `Sentar (caixa ${bankroll})`,
    rules: "Ler as regras",
  },

  betting: {
    kicker: "a aposta",
    bankroll: "Caixa",
    brokeBody1: "Você está limpo. A família adianta o dinheiro,",
    brokeBody2: "mas não pergunte o que acontece se não puder pagar.",
    borrow: (amount) => `Pegar ${amount}`,
    body1: "Quatro na mesa, sete fichas para cada. Quem sobrar leva o prêmio.",
    body2: "Mais ou menos uma chance em quatro. Paga de 2,0 a 5,7× pelas fichas e pela sequência de vitórias.",
    rules: "Ler as regras",
  },

  topbar: {
    round: (n) => `Rodada ${n}`,
    wager: "Aposta",
    rules: "Regras",
    vira: "VIRA",
    buyViraAria: (card) => `Comprar a vira, ${card}`,
    viraGone: "comprada",
  },

  speed: { FAST: "Rápido", NORMAL: "Normal", SLOW: "Devagar" },

  table: {
    stock: "monte",
    discard: "lixo",
    drawAria: "Comprar uma carta do monte",
    takeDiscardAria: (card) => `Pegar ${card} do lixo`,
    takeHint: "Toque para pegar",
  },

  hand: {
    sort: "Arrumar",
    lockTag: "P",
    cardAria: (card, locked) =>
      `${card}${locked ? " (recém-pegada, não pode ser descartada)" : ""}. Arraste para reordenar`,
  },

  turn: {
    folded: "Correu",
    over: "Rodada encerrada",
    waiting: (name) => `Vez de ${name}…`,
    firstDraw: "Você é o primeiro. Compre a vira, ou tire do monte.",
    keepDecision: "Essa carta. Fica com ela ou joga fora.",
    draw: "Uma carta. Do monte ou do lixo.",
    discard: "Descarte uma.",
  },

  actions: {
    draw: "Comprar do monte",
    discard: "Descartar a escolhida",
    canBater: "Dá para bater",
    cannotBater: "Ainda não",
  },

  fold: {
    kicker: "olhe a mão e decida",
    title: "Jogar, ou correr",
    note: (lossPlay, lossCom10) =>
      `Jogar e perder custa *${lossPlay} fichas*. Levar um bater de dez cartas custa *${lossCom10}*.`,
    noteFold: (lossFold) =>
      `Correr custa só *${lossFold}*, mas aí você não ganha a rodada.`,
    chipsInHand: (chips) => `${chips} fichas na mão`,
    play: "Entrar na rodada",
    fold: (lossFold) => `Sair da rodada (−${lossFold})`,
  },

  keep: {
    kicker: "privilégio de quem começa",
    title: "Fica com esta carta?",
    noteLong: "Compare com a mão aí embaixo. Pode reordenar à vontade.",
    note: "Só dá para comprar de novo *uma vez*.",
    keep: "Levar para a mão",
    reject: "Jogar fora e comprar outra",
  },

  intercept: {
    kicker: "sem esperar a sua vez",
    title: "Esse descarte fecha a sua mão",
    noteLong: "Dá para pegar e bater mesmo fora da sua vez.",
    note: "Se deixar passar, o direito vai para o *próximo*.",
    take: "Pegar e bater",
    pass: "Deixar passar",
  },

  result: {
    kicker: "fim da rodada",
    noWinner: "Sem vencedor",
    youWon: "Você levou",
    theyWon: (name) => `${name} levou`,
    revealLabel: "Mão vencedora",
    revealCount: (n) => `${n} cartas`,
    trinca: "Trinca",
    sequence: "Sequência",
    took: "Levou",
    noChange: "±0",
    bust: "Quebrou",
    streak: (name, n) => `${name} está com *${n} vitórias seguidas*`,
    next: "Próxima rodada",
    waitingFor: (names) => `Esperando ${names.join(", ")} seguir.`,
  },

  matchOver: {
    winLead: "Você é o único que sobrou na mesa.",
    loseLead: "Suas fichas acabaram. A aposta fica aqui.",
    chipsLeft: (n) => `${n} fichas restantes`,
    times: (x) => `${x}×`,
    streak: (n) => `${n} vitórias seguidas`,
    clean: "Bateu sem coringa",
    withWild: "Bateu usando coringa",
    payout: "Pagamento",
    bankroll: (n) => `Caixa ${n}`,
    back: "Voltar para a mesa",
    brokeTitle: "...",
    broke: "Sem um tostão",
  },

  dealing: {
    split: "Cortando o baralho",
    revealVira: "Virando a vira",
    deal: "Três de cada vez",
  },

  seat: {
    chipsAria: (n) => `${n} fichas restantes`,
    handAria: (n) => `${n} cartas na mão`,
    thinking: "…pensando",
    folded: "Correu",
  },

  card: {
    coringa: "coringa",
    suits: { S: "espadas", H: "copas", D: "ouros", C: "paus" },
  },

  // 肩書きは空。異名がそのままポルトガル語なので、訳を並べると重複する
  personas: [
    { name: "Você", title: "" },
    { name: "Dom Vieira", title: "" },
    { name: "Zé Navalha", title: "" },
    { name: "Dona Rosa", title: "" },
  ],

  rules: {
    title: "Regras",
    close: "Fechar",

    s1: {
      title: "O objetivo",
      body:
        "Transforme as nove cartas da mão em *jogos* e seja o primeiro a *bater* — " +
        "quem bate leva a rodada. Quem perde paga fichas, e quem fica sem elas " +
        "deixa a mesa. O último sentado leva o dinheiro.",
    },

    s2: {
      title: "A mesa e as cartas",
      deck: "Dois baralhos de 52 cartas, sem curingas (*104 cartas*). Cada carta existe duas vezes",
      players: "Quatro jogadores. Nove cartas para cada; o resto é o monte",
      ranks: "A ordem vai de 2 3 4 … K. *O ás serve nas duas pontas*",
    },

    s3: {
      title: "A vira e o coringa",
      body:
        "Depois de distribuir, uma carta do monte é virada para cima. Essa é a *vira*. " +
        "Só a carta do *valor seguinte* e do *mesmo naipe da vira* é curinga — o *coringa*.",
      example: "Vira 7♠, então *só o 8♠* é curinga. 8♥ 8♦ 8♣ são cartas comuns.",
      note: "Com dois baralhos, são apenas dois coringas em 103 cartas. Tirar um vale muito.",
    },

    s4: {
      title: "Os jogos",
      trincaHead: "Trinca — cartas do mesmo valor",
      trincaLead: "A exigência de naipe muda conforme o tamanho.",
      colCount: "Tamanho",
      colSuits: "Naipes",
      colExample: "Exemplo",
      cards: (n) => `${n} cartas`,
      suits0: "todos diferentes",
      suits1: "um repetido",
      suits2: "dois repetidos",
      notAllowed: "não vale",
      trincaNote:
        "Não existe trinca de seis. Seis cartas do mesmo valor são simplesmente duas de três.",
      sequenceHead: "Sequência — mesmo naipe em ordem",
      seqBasic: "Três ou mais em ordem, todas do mesmo naipe",
      seqAce: "O ás serve nas duas pontas.",
      seqNoWrap: "Mas *não dá para passar por cima do ás.*",
      wildNote: "Nos dois jogos, a carta que falta pode ser coberta pelo coringa.",
    },

    s5: {
      title: "A sua vez",
      step1: "*Pegue uma* — do topo do monte, ou o último descarte (o que o jogador anterior jogou)",
      step2: "Reorganize as dez e veja se dá para bater",
      step3: "*Descarte uma* — o próximo jogador vê o que você jogou",
      note:
        "A carta que você pegou do lixo não pode ser descartada na mesma jogada. " +
        "Deixá-la sobrando na hora de bater é permitido.",
    },

    s6: {
      title: "O privilégio de quem começa",
      lead: "Só o primeiro jogador de cada rodada escolhe, na jogada de abertura.",
      buyVira: "*Comprar a vira* — levar a vira virada direto para a mão",
      drawFirst:
        "*Comprar e decidir* — tire uma do monte, olhe, e fique com ela ou jogue fora. " +
        "Jogando fora dá para comprar de novo, mas *só uma vez*",
    },

    s7: {
      title: "Bater",
      colShape: "Forma",
      colDetail: "O que significa",
      nine: "9 cartas",
      nineDetail: "Nove das suas dez estão em jogos. Descarte a que sobra e bata (3+3+3 ou 4+5)",
      ten: "10 cartas",
      tenDetail: "As dez estão em jogos. Bata sem descartar (3+3+4 ou 5+5)",
      note: "Quem leva um bater de dez cartas paga uma ficha a mais.",
    },

    s8: {
      title: "Bater no lixo",
      lead:
        "*Se falta uma carta para você bater, não precisa esperar a sua vez.* " +
        "Quando alguém descartar essa carta, pegue fora da vez e bata na hora.",
      p1: "Só dá para pegar a carta que acabou de ser descartada",
      p2: "A carta pegada tem que fazer parte de um jogo. Pegar e descartar não vale",
      p3: "Quem descartou não pode bater no lixo. Quem correu também não",
      p4:
        "*Se mais de um puder, o direito corre a partir do lugar seguinte ao de quem descartou.*" +
        " Deixando passar, vai para o próximo",
    },

    s9: {
      title: "Fichas e a partida",
      lead: "Todos começam com sete fichas. Perder a rodada custa caro.",
      colCase: "Situação",
      colLoss: "Fichas perdidas",
      lost: "Jogou e perdeu",
      folded: "Tinha corrido",
      com10: "Levou um bater de dez cartas",
      body: "Quem chega a zero *quebra* e sai. O último sentado ganha a partida.",
      note: "Quando o monte acaba, o lixo vira o novo monte na mesma ordem.",
    },

    s10: {
      title: "Correr",
      body:
        "Olhe a mão antes de a rodada começar e *corra* se ela não prometer nada. " +
        "Custa só uma ficha, mas aí você não ganha aquela rodada.",
    },

    s11: {
      title: "O pagamento",
      lead: "Ganhando a partida, a aposta volta. O multiplicador depende de como você ganhou.",
      colFactor: "Fator",
      colRate: "Multiplicador",
      chips: "Fichas restantes (1 → 7)",
      chipsRate: "2,7 → 4,5×",
      streak: "Vitórias seguidas (a partir da segunda)",
      streakRate: "+0,4 cada, até +1,2",
      wild: "Usou um coringa para fechar",
      wildRate: "×0,75",
      note:
        "Em geral, de *2,0 a 5,7×*. Bater sem coringa é mais difícil, então paga mais. " +
        "Perdendo, a aposta não volta.",
    },
  },
};
