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

  /**
   * Modelo do avião (design §6). Física simplificada e plausível para a Classe Regular:
   * pesos em kg, potência em W, envergadura em m. Calibrado para o projeto padrão
   * (b 2,8 m, N 2, 550 W, leve, balsa) dar ~3,3 kg vazio e ~11–12 kg de carga a Hρ 1000 m.
   */
  aircraft: {
    weight: {
      /** Fuselagem, compartimento de carga e eletrônica. */
      fuselage: 0.9,
      /** Grupo motopropulsor: fixo + por W de potência projetada. */
      powertrainBase: 0.25,
      powertrainPerW: 0.0006,
      /** Asa: coeficiente × b^wingExponent × fator do material. */
      wingCoef: 0.45,
      wingExponent: 1.3,
      wingMaterial: { balsa: 1, mixed: 0.9, composite: 0.8 } as Record<string, number>,
      /** Empenagem e superfícies extras por N (asa voadora não tem empenagem). */
      tail: { 1: 0, 2: 0.25, 3: 0.45 } as Record<number, number>,
      gear: { low: 0.25, high: 0.35 } as Record<string, number>,
      philosophy: { payload: 1.08, light: 0.9, stable: 1 } as Record<string, number>
    },
    lift: {
      /** Massa máxima sustentada ao nível do mar: coeficiente × b^spanExponent × N × filosofia. */
      coef: 7.24,
      spanExponent: 0.8,
      surfaces: { 1: 0.88, 2: 1, 3: 1.08 } as Record<number, number>,
      philosophy: { payload: 1.1, light: 0.95, stable: 1 } as Record<string, number>
    },
    takeoff: {
      /** Corrida = k × m² / (σ² × b × P × fator de sustentação) × vento. */
      k: 226,
      /** Velocidade de rotação de referência para o efeito do vento, m/s. */
      liftoffSpeedMs: 13,
      /** Trem alto rotaciona um pouco antes (ângulo de ataque maior na corrida). */
      gearFactor: { low: 1, high: 0.97 } as Record<string, number>
    },
    /** Estabilidade 0–1 (risco de queda e de pouso duro). */
    stability: {
      philosophy: { payload: 0.6, light: 0.6, stable: 0.9 } as Record<string, number>,
      surfaces: { 1: -0.2, 2: 0, 3: 0.05 } as Record<number, number>
    },
    /** Desvio escondido do peso vazio por material: viés + variação ± (design §6.2). */
    material: {
      balsa: { bias: 0.02, spread: 0.06 },
      mixed: { bias: 0, spread: 0.08 },
      composite: { bias: -0.02, spread: 0.12 }
    } as Record<string, { bias: number; spread: number }>,
    /** Variação ± da sustentação real por filosofia: apostar em carga é mais incerto. */
    philosophySpread: { payload: 0.12, light: 0.09, stable: 0.06 } as Record<string, number>,
    /** Qualidade de peça considerada "na média" do modelo nominal. */
    referenceQuality: 75,
    /** Peso extra por ponto de qualidade abaixo da referência (média das peças instaladas). */
    weightPerQualityPoint: 0.002,
    /** Sustentação a mais por ponto de qualidade da asa acima da referência. */
    liftPerQualityPoint: 0.0015,
    /** Potência real do grupo motopropulsor: piso + fração pela qualidade; falsificado perde mais. */
    powerAtZeroQuality: 0.85,
    counterfeitPower: 0.8,
    /** Margem relativa das estimativas sem conhecimento nem ensaios (design §6.2). */
    margin: { emptyWeight: 0.15, payload: 0.25, takeoff: 0.2 },
    /** Fração da margem que o conhecimento máximo (100) elimina. */
    knowledgeCut: 0.6,
    /** Pesar o avião completo na balança equivale a este número de ensaios de peso vazio. */
    scaleEvidence: 8,
    /** O centro da estimativa fica a até esta fração da margem do valor real. */
    biasShare: 0.7,
    /** Mudar o projeto depois de ensaiar invalida parte dos ensaios. */
    redesignEvidenceKept: 0.5
  },

  /** Ensaios (design §7.3): evidência ganha × multiplicador de rendimento, risco e desgaste. */
  tests: {
    structural: { evidence: 1, breakChance: 0.25, breakDamage: 45, wear: 5 },
    thrust: { evidence: 0.7, standEvidence: 2, wear: 3 },
    flight: { payloadEvidence: 1, takeoffEvidence: 0.5, incidentChance: 0.15, wear: 4, damage: [30, 70] as const },
    video: { payloadEvidence: 0.3, incidentChance: 0.12, wear: 4, damage: [30, 70] as const },
    /** Piloto da CT (design §5.1): nível fixo para quem não tem piloto próprio. */
    ctPilot: 55,
    pilotingPerHour: 0.6
  },

  /**
   * Relatório (design §9.1). Nota do capítulo = máximo × esforço(horas) × conteúdo, com
   * conteúdo = base + peso do acervo documentado + peso dos ensaios citados.
   */
  report: {
    /** Horas para chegar a ~63% do esforço possível num capítulo (1 − e^(−h/H)). */
    chapterHours: 25,
    drawingsHours: 20,
    contentBase: 0.35,
    contentKnowledge: 0.45,
    contentTests: 0.2,
    /** Ensaios para ~63% do peso dos ensaios citados. */
    testsScale: 2,
    /** Variação (±) da nota da CT: de maxSpread (acervo 0) a minSpread (acervo 100). */
    minSpread: 0.06,
    maxSpread: 0.18,
    /** Envio atrasado (16 a 23/ago): perde esta fração da NR por dia começado. Provisório. */
    latePenaltyPerDay: 0.05,
    /** Apresentação oral (0–40): base + comunicação de quem apresenta + acervo + ensaios. */
    oralBase: 0.25,
    oralCommunication: 0.35,
    oralKnowledge: 0.25,
    oralPractice: 0.15,
    oralPracticeHours: 10,
    oralSpread: 0.1
  },

  /** Lojas do navegador (design §8.4). */
  shop: {
    /** Atraso extra máximo sobre o prazo sorteado na faixa da vitrine, por origem da loja. */
    lateness: { national: 0.15, import: 0.4, used: 0.1 } as Record<string, number>,
    /** Dias até o pedido sair da loja (no máximo esta fração do prazo). */
    processingDays: 1,
    processingShare: 0.2,
    /** Fração do trajeto em que o importado passa pela fiscalização. */
    customsPoint: 0.6,
    /** Dias para liberar depois de pagar o imposto. */
    customsReleaseDays: [2, 5] as const,
    /** Peça fora da especificação sai com a qualidade multiplicada por isto. */
    counterfeitQuality: 0.7,
    /** Promoção relâmpago: chance por dia, por loja que faz promoção; desconto; duração. */
    sale: { shops: ["hobbykong"] as readonly string[], chancePerDay: 0.12, discount: [0.2, 0.35] as const, days: 2 },
    /** Chance por dia de um anúncio com estoque limitado repor uma unidade. */
    restockChancePerDay: 0.15
  },

  /** Competição de voo (design §9). Valores provisórios; regras fixas em regulation2026.ts. */
  competition: {
    /** Durante as janelas de voo, 1 h de jogo dura isto em segundos reais em 1× (fora delas, o normal). */
    realSecondsPerGameHour: 20,
    /** Dia do marco: exposição e inspeção; voos nos dias seguintes. */
    flightDays: 3,
    windowStartHour: 7,
    windowEndHour: 17,
    /** Uma equipe decola a cada slotMinutes. */
    slotMinutes: 12,
    maxBatteries: 7,
    /** Clima de São José dos Campos no fim de outubro (Apêndice 4 dá o Hρ). */
    weather: {
      pressureHpa: 945,
      pressureSpread: 2,
      minTempK: 289.15,
      maxTempK: 302.15,
      coldestHour: 6,
      hottestHour: 15,
      dailyTempSpread: 2,
      windMean: 1.5,
      windSpread: 2,
      afternoonWind: 1
    },
    /** Subida depois da rotação: gradiente = base + ganho × (1 − corrida/55). */
    climbBase: 0.08,
    climbGain: 0.2,
    rotationNoise: 0.05,
    clearanceNoise: 0.1,
    /** Parada desde o toque, m: base + por kg de massa − por m/s de vento de proa. */
    stopBase: 20,
    stopPerKg: 1.2,
    stopPerHeadwind: 3,
    stopNoise: 6,
    /** Fim da área de pouso, m: parar depois disso é pouso fora da pista (sem BPO). */
    landingZoneM: 60,
    /** Retirada de carga (2 pessoas): base − ganho × agilidade média/100, ± ruído (s). */
    unloadBase: 34,
    unloadGain: 20,
    unloadNoise: 3,
    /** Chances-base de incidente, multiplicadas pelo risco (piloto, estabilidade, condição). */
    crashChance: 0.02,
    damageChance: 0.05,
    landingOutChance: 0.08,
    /** Acima da sustentação disponível o avião estola: chance de queda por fração de excesso de massa. */
    stallPerExcess: 4,
    /** Penalidade por alteração de projeto depois de 27/set (Apêndice 6). Provisório. */
    lateChangePenalty: 5
  },

  calendar: {
    /** Aviso de prazo próximo, em dias (design §4.1). */
    warnDays: 7
  }
} as const;
