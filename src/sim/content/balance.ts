// Números de balanceamento do loop de preparação. Todos provisórios (design §8.3):
// ficam centralizados aqui para o protótipo ajustar sem tocar nas regras.

export const BALANCE = {
  /** Passo máximo da simulação dentro de um tick, em horas de jogo. */
  stepHours: 1,

  motivation: {
    /** Fator de horas com motivação 0; com 100 o fator é 1 (design §4.2). */
    hoursFactorAtZero: 0.5,
    /** Queda por dia de jogo de quem está sem tarefa. */
    idleDecayPerDay: 1,
    /** Horas seguidas em tarefa a partir das quais a pessoa fica sobrecarregada. */
    overloadAfterHours: 14 * 24,
    /** Queda por dia de jogo de quem está sobrecarregado. */
    overloadDecayPerDay: 1.5,
    /** Quanto a sequência de trabalho se recupera por hora parada (em horas). */
    restRecoveryPerHour: 2,
    /** Ganho ao concluir uma tarefa, para cada pessoa alocada no fim. */
    completionBoost: 6
  },

  knowledge: {
    /** Conhecimento tácito ganho por hora trabalhada na disciplina, com retorno decrescente. */
    perHour: 0.5,
    /** Fração da distância entre o melhor tácito e o documentado que "Documentar" converte. */
    documentTransfer: 0.5,
    /** Fabricação ganha por hora em tarefa que fabrica peça. */
    fabricationPerHour: 0.3,
    /** Agilidade ganha por hora em treino de retirada de carga. */
    agilityPerHour: 1
  },

  parts: {
    /** Qualidade da peça fabricada = base × multiplicador de rendimento + bônus de equipamento. */
    fabricatedQualityBase: 60,
    /** Bônus de qualidade de fabricação por equipamento possuído. */
    equipmentQualityBonus: { scale: 5 } as Record<string, number>,
    purchasedQuality: 85
  },

  crew: {
    /** Rendimento de cada pessoa além do número ideal da ação. */
    extraEfficiency: 0.5
  },

  sponsor: {
    /** Chance de o patrocinador dizer sim com qualidade 0 e 100; o sorteio usa rngState. */
    chanceAtZero: 0.3,
    chanceAtFull: 0.9,
    /** Valor base, multiplicado pelo rendimento. */
    amount: 800
  },

  outcome: {
    /** Multiplicador esperado do resultado com qualidade 0 e 100 (linear entre os dois). */
    curveAtZero: 0.5,
    curveAtFull: 1.5,
    /** Variação sorteada (±) com qualidade 0; cai linearmente até 0 com qualidade 100. */
    maxSpread: 0.4
  },

  outreach: {
    /** Fração do alcance de divulgação que se perde por dia de jogo. */
    decayPerDay: 0.03,
    /** Incerteza (±) do número de inscritos, além da qualidade de quem conduz a seletiva. */
    applicantSpread: 0.3
  },

  lead: {
    /** Prazo real = prazo prometido × fator sorteado nesta faixa (entregas atrasam mais do que adiantam). */
    minFactor: 0.8,
    maxFactor: 1.4
  },

  calendar: {
    /** Aviso de prazo próximo, em dias (design §4.1). */
    warnDays: 7
  }
} as const;
