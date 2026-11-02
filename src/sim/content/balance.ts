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
    /** Fase 8, S4: queda por dia de jogo de quem parou de exaustão (energia abaixo de energy.exhaustedBelow). */
    exhaustedDecayPerDay: 4,
    /** Fase 8, S5: motivação por hora trabalhada no que a pessoa gosta de verdade (e perda no que detesta). */
    likedPerHour: 0.3,
    dislikedPerHour: 0.15,
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
    /**
     * Fase 8, S3: rendimento de cada pessoa além do número ideal da ação, na ordem em que entram
     * (a 1ª extra rende 70%, a 2ª 50%...). Passando da tabela vale o último valor.
     */
    extraEfficiency: [0.7, 0.5, 0.35, 0.25, 0.18, 0.12] as readonly number[]
  },

  /**
   * Fase 8, S4: energia por aluno (0–100). Trabalhar gasta por hora trabalhada; descansar, dormir e
   * o fim de semana recuperam por hora de relógio. PROPOSTA: calibrar no balanceamento.
   */
  energy: {
    start: 100,
    /** Gasto por hora trabalhada; madrugada multiplica (depois da 1h, mais ainda); disciplina detestada também. */
    workPerHour: 5,
    overnightFactor: 1.6,
    lateOvernightFactor: 2.2,
    dislikedFactor: 1.4,
    /** Recuperação por hora de relógio: acordado, dormindo (23h–7h) e fim de semana (multiplicador). Sem recuperar enquanto trabalha. */
    awakePerHour: 0.5,
    sleepPerHour: 1.5,
    sleepFromHour: 23,
    sleepToHour: 7,
    weekendFactor: 1.5,
    /** Abaixo disto rendimento e qualidade caem (linear até exhaustedBelow); abaixo de exhaustedBelow a pessoa para. */
    tiredBelow: 40,
    exhaustedBelow: 15,
    /** Rendimento e qualidade em exhaustedBelow (em tiredBelow é 1). */
    factorAtExhausted: 0.5,
    /** Leitura de tendência: variação diária abaixo disto é "estável". */
    trendEpsilonPerDay: 2
  },

  /** Fase 8, S5: facilidade escondida por disciplina. */
  aptitude: {
    /** Multiplicador do ganho de conhecimento. */
    factor: { slow: 0.6, normal: 1, fast: 1.5 } as Record<string, number>,
    /** Chance de sorteio: devagar, rápido (o resto é normal). */
    chanceSlow: 0.25,
    chanceFast: 0.25,
    /** Horas trabalhadas na disciplina até a facilidade aparecer. */
    revealAfterHours: 10
  },

  /** Fase 8, S2: entrega em marcos. */
  yield: {
    /** Fabricação: corte, montagem e acabamento (a peça só voa depois da última). */
    fabricateStep: 1 / 3
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
   * pesos em kg, potência em W, envergadura e corda em m. Calibrado para o projeto padrão
   * (b 2,8 m, c 0,40 m, N 2, 550 W, hélice 14", leve, balsa) dar ~3,4 kg vazio e ~11–12 kg
   * de carga a Hρ 1000 m. Fase 5: o peso vazio sai do orçamento de massa por subsistema.
   */
  aircraft: {
    /** Corda de referência, m: a corrida e o braço de cauda se medem em relação a ela. */
    refChordM: 0.4,
    /** Braço da cauda horizontal lh, em cordas (aerodesign típico: 2,5 a 3 c). */
    tailArmChords: 2.5,
    /**
     * Orçamento de massa (design §6.4). Asa = casca (kg/m² × S) + longarina (kg/m² × b² × c_ref/c):
     * o momento fletor cresce com b e a altura da longarina com c, então asa fina e longa pesa mais.
     * Valores de asas de balsa entelada de aerodesign (0,8–1,2 kg/m² com longarina).
     */
    mass: {
      wingSkin: { balsa: 0.9, mixed: 0.8, composite: 0.72 } as Record<string, number>,
      wingSpar: { balsa: 0.09, mixed: 0.08, composite: 0.065 } as Record<string, number>,
      /** Asa voadora: corda central maior e reflexo pesam mais. */
      flyingWingFactor: 1.1,
      /** Empenagem: kg/m² de superfície + fixo (articulações, deriva). Canard (N=3) = fração de S. */
      tailAreal: 1.05,
      tailFixed: 0.04,
      tailMaterial: { balsa: 1, mixed: 0.92, composite: 0.85 } as Record<string, number>,
      canardAreaShare: 0.15,
      canardFixed: 0.02,
      /** Fuselagem e baia de carga + cone de cauda por metro de braço (a asa voadora não tem). */
      fuselageBase: 0.4,
      fuselagePerTailArmM: 0.24,
      gear: { low: 0.25, high: 0.35 } as Record<string, number>,
      /** Motor + ESC + hélice: fixo + por W + hélice ∝ D² (referência 14"). */
      powertrainBase: 0.1,
      powertrainPerW: 0.0003,
      propKgAtRef: 0.035,
      /** LiPo para ~2 min a 600 W de pico (4S–6S, 2200–3300 mAh): fixo + por W. */
      batteryBase: 0.12,
      batteryPerW: 0.0004,
      /** Servos, receptor, wattímetro e fiação; canard tem servo a mais. */
      electronics: 0.2,
      electronicsCanard: 0.03,
      /** Filosofia muda a estrutura (asa, fuselagem, empenagem, trem), não o que se compra pronto. */
      philosophy: { payload: 1.08, light: 0.9, stable: 1 } as Record<string, number>,
      /** Desvio ± de cada subsistema no sorteio escondido: estrutura feita em casa varia mais que componente comprado. */
      builtSpread: 0.06,
      boughtSpread: 0.02
    },
    lift: {
      /**
       * Massa sustentada ao nível do mar = coef × S × AR / (AR + 2) × N × filosofia × trimagem.
       * coef ≈ ½ ρ0 V² CLmax / g com V ≈ 13 m/s e CLmax de perfil de alta sustentação (~1,9);
       * AR/(AR+2) é a perda de sustentação da asa finita (aproximação de Helmbold).
       */
      coef: 18.9,
      surfaces: { 1: 0.88, 2: 1, 3: 1.08 } as Record<number, number>,
      philosophy: { payload: 1.1, light: 0.95, stable: 1 } as Record<string, number>,
      /** Margem estática baixa = menos sustentação negativa na cauda: + carga por ponto abaixo de trimRefMargin. */
      trimPerMarginPoint: 0.004,
      trimRefMargin: 12,
      trimRange: [0.92, 1.06] as const
    },
    takeoff: {
      /** Corrida = k × m² / (σ² × (S / c_ref) × P × fator de sustentação × fator de tração) × vento. */
      k: 226,
      /** Velocidade de rotação de referência para o efeito do vento, m/s. */
      liftoffSpeedMs: 13,
      /** Trem alto rotaciona um pouco antes (ângulo de ataque maior na corrida). */
      gearFactor: { low: 1, high: 0.97 } as Record<string, number>,
      /** Tração estática com potência fixa ∝ D^(2/3) (teoria do momento: T = (2ρA P²)^(1/3)). */
      refPropIn: 14,
      propExponent: 2 / 3,
      /** Asa baixa ganha efeito solo na corrida. */
      lowWingGroundEffect: 1.04,
      /** Margem acima de 20% CMA: profundor não levanta o nariz; corrida cresce por ponto. */
      overStableFrom: 20,
      overStablePerPoint: 0.015
    },
    /** Hélice máxima por altura do trem, pol. (folga ao solo). */
    maxPropIn: { low: 15, high: 20 } as Record<string, number>,
    /**
     * Estabilidade longitudinal (design §6.5). Ponto neutro (% CMA) ≈ 25 + η × VH × (at/aw) × (1 − dε/dα) × 100
     * − fuselagem, com aw ∝ AR/(AR+2), cauda de AR 4 e dε/dα ≈ 4/(AR+2) (downwash de asa elíptica).
     * Asa voadora: 25 + reflexo/enflechamento. Canard desestabiliza.
     */
    neutralPoint: {
      wingAc: 25,
      tailEfficiency: 0.9,
      tailAspectRatio: 4,
      fuselageShift: -3,
      flyingWing: 33,
      canardShift: -8
    },
    /** Faixas de margem estática, % CMA. ok dentro de `ok`; risco dentro de `risk`; fora = falha. */
    staticMarginBands: { ok: [5, 20], risk: [0, 30] } as const,
    /** Desvio ± da margem real sobre a nominal (onde o CG cai de fato), % CMA. */
    staticMarginSpread: 3,
    /** Margem de erro da estimativa da margem estática sem conhecimento nem ensaios, % CMA. */
    staticMarginMargin: 5,
    /**
     * Estabilidade 0–1 (risco de queda e de pouso duro) a partir da margem estática real:
     * negativa = instável; sobe até overStableFrom; + filosofia, posição da asa e N.
     */
    stability: {
      unstableBase: 0.2,
      unstablePerPoint: 0.03,
      floor: 0.05,
      lowBase: 0.15,
      lowPerPoint: 0.04,
      lowUntil: 10,
      highPerPoint: 0.02,
      philosophy: { payload: 0, light: 0, stable: 0.1 } as Record<string, number>,
      wing: { high: 0.03, low: -0.03 } as Record<string, number>,
      surfaces: { 1: -0.1, 2: 0, 3: 0 } as Record<number, number>
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
    /** Horas escritas (somando os capítulos) para o envio manual ser aceito (Fase 4, S4). */
    minWrittenHours: 1,
    /** Acervo documentado abaixo disto vira aviso no checklist do relatório. */
    lowDocumented: 30,
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
    lateChangePenalty: 5,
    /** Fase 7, S4: decisões do evento da competição. PROPOSTA. */
    event: {
      /** Cada bloco de voo cobre este tanto de horas (5 slots de 12 min por hora). */
      flightBlockHours: 2,
      /** Inspeção: avião incompleto, peças improvisadas no pátio. */
      improviseParts: { hours: 10, credits: 100, quality: 45 },
      /** Inspeção: eletrônica falsificada, trocada por uma certificada. */
      certifiedElectronics: { hours: 3, credits: 120 },
      /** Penalidade (pontos) por voar com liberação condicional sem o vídeo, ou com a eletrônica falsificada. */
      noVideoPenalty: 15,
      counterfeitPenalty: 10,
      /** Carga da bateria: sobre a previsão da equipe. */
      boldShare: 1.08,
      safeShare: 0.92,
      /** Reparo entre baterias: completo leva a peça a `to`; remendo soma `gain`. */
      repairFull: { hours: 6, credits: 60, to: 85 },
      repairPatch: { hours: 2, credits: 15, gain: 25 },
      /** Conhecimento tácito por bateria voada (horas-equivalentes) em Desempenho e Estabilidade. */
      knowledgeHoursPerFlight: 2
    }
  },

  /**
   * Ensaio de voo como evento (Fase 5, S2; design §7.3). Locais em content/testVenues.ts.
   */
  flightTests: {
    /** Hora da primeira decolagem e intervalo entre decolagens (h). */
    startHour: 8,
    /** A chamada do evento vem este tanto de horas antes da primeira decolagem (viagem e montagem). */
    callLeadHours: 3,
    /** Rajada: chance por decolagem, força (m/s) e perda de pilotagem efetiva enquanto dura. */
    gustChance: 0.35,
    gustMs: [5, 8] as const,
    gustPilotPenalty: 20,
    /** Esperar 30 min: chance de a rajada passar; tirar carga: perda de pilotagem que sobra. */
    gustPassesChance: 0.7,
    reducedLoadPenalty: 8,
    /** Peça com folga na checagem: chance de aparecer, custo de trocar e perda de condição se voar assim. */
    looseChance: 0.4,
    looseFixHours: 1,
    looseFixCredits: 10,
    looseFixGain: 15,
    looseConditionPenalty: 15,
    intervalHours: 0.5,
    /** Horas que a tripulação passa no campo (conhecimento tácito). */
    crewHours: 6,
    /** Pilotagem mínima de um integrante para pilotar o ensaio. */
    minPiloting: 30,
    /** Piloto contratado: custo ◆ e nível de pilotagem. */
    hiredPilotCost: 150,
    hiredPilot: 80,
    /** Tripulação e cargas por evento. */
    maxCrew: 6,
    maxTakeoffs: 5,
    /** Fração do pago devolvida no cancelamento. */
    refundShare: 0.5,
    /** Chance de dano no transporte por km de estrada (ida); dano sorteado na faixa. */
    transportRiskPerKm: 0.002,
    transportDamage: [10, 25] as const,
    /** Desgaste por decolagem em cada peça instalada. */
    wearPerTakeoff: 3,
    /** Evidência por decolagem: válida (dá um ponto da reta) ou no limite (não decolou, rompeu a fita). */
    validEvidence: { payload: 0.4, takeoff: 0.3, stability: 0.5 },
    limitEvidence: { payload: 0.6, takeoff: 0.5, stability: 0.2 },
    /** Conhecimento por hora para a tripulação (Desempenho, Aerodinâmica, Estabilidade). */
    knowledgePerHour: 0.4
  },

  /** Pessoas (Fase 7, S5): proporção realista da engenharia aeronáutica, sem diversidade forçada. */
  people: {
    /** Chance de cada aluno sorteado (fundadores, candidatos, trainees) ter nome e aparência femininos. */
    femaleShare: 0.2,
    /** Fase 8, S5: conhecimento inicial de todo aluno em cada disciplina: base + sorteio ±spread (baixo e parecido). */
    baseKnowledge: 8,
    knowledgeSpread: 3,
    /** Fase 8, S5: de cada preferência declarada, esta fração bate com o gosto real. */
    statedTruthShare: 0.6
  },

  /** Dia da dinâmica da seletiva (Fase 7, S2; Fase 9, S3). PROPOSTA. */
  selectionDay: {
    /** Hora do dia em que o evento é chamado. */
    startHour: 9,
    /** Grupos de groupMin a groupMax pessoas (Fase 9). */
    groupMin: 5,
    groupMax: 6,
    /** Limiares das anotações. */
    talkative: 45,
    shy: 25,
    eager: 75,
    knowsLot: 30,
    knowsSome: 15,
    steadyHands: 35,
    clumsyHands: 15,
    /** Planador: distância base (m), ruído (m) e chance de alguém travar no desafio. */
    gliderBase: 14,
    gliderNoise: 3,
    freezeChance: 0.6,
    /** Chance de se recuperar na segunda chance = motivação/100 + isto. */
    recoverBonus: 0.1,
    /** Capitães com a recomendação ouvida: motivação a mais (quando a lista deles bate com a sua). */
    captainsHeardBoost: 3
  },

  /**
   * Seletiva imersiva (Fase 9, docs/phases/fase-9.md). PROPOSTA. Funil esperado num Ano 1 bem
   * divulgado: ~90 inscritos, ~55 na palestra, ~30 na dinâmica, ~16 entrevistados, ~10 trainees.
   */
  selection: {
    /** Etapa 1: horas-pessoa da divulgação e abertura (a tarefa dura cerca de 1 semana) e alcance que ela soma. */
    promoHours: 30,
    promoOutreach: 6,
    /** Etapa 2: dias de inscrição abertos. */
    inscriptionDays: 21,
    /** Palestra: dias depois do fim das inscrições e hora do dia. */
    lectureGapDays: 2,
    lectureHour: 19,
    /** Dinâmica: dias depois da palestra (a hora é selectionDay.startHour). */
    dynamicGapDays: 3,
    /** Inscritos esperados = base do formato × época × (1 + alcance × reachScale) × (1 + reputação × reputationScale), ±spread. */
    reachScale: 0.03,
    reputationScale: 0.004,
    totalSpread: 0.15,
    minTotal: 8,
    maxTotal: 140,
    /** Janelas da temporada (mês UTC 1–12 → fator): novembro (fundação) e março (calouros) rendem; o resto, menos. */
    windowFactor: { 11: 0.8, 3: 1.25 } as Record<number, number>,
    offWindowFactor: 0.5,
    /** Chegada: fração acumulada = 1 - (1 - dia/dias)^arrivalCurve (mais gente no começo). */
    arrivalCurve: 1.6,
    /** Inscritos a mais por ponto de alcance somado durante as inscrições. */
    extraPerReach: 0.8,
    /** Palestra: chance de ir = base + motivação/100 × slope (a tag não importa). */
    lectureAttendBase: 0.25,
    lectureAttendSlope: 0.6,
    /** Dinâmica: no máximo isto de convidados (quem tem tag "chamar" primeiro, "não" nunca) e chance de faltar. */
    dynamicCap: 36,
    dynamicNoShow: 0.1,
    /** Quantos grupos o jogador acompanha de perto. */
    watchedGroups: 2,
    /** Teto de quem passa para a entrevista e de aprovados. */
    interviewCap: 24,
    approveCap: 20,
    /** Entrevista: horas-pessoa por entrevistador, entrevistadores por entrevista e perguntas por pessoa. */
    interviewHours: 1.5,
    interviewers: 2,
    maxQuestions: 3,
    /** Ruído das respostas (± pontos de 0 a 100) e quanto a comunicação média dos entrevistadores o reduz (fração a 100). */
    interviewNoise: 18,
    noiseReductionByComm: 0.55
  },

  /** Formação por área (Fase 4, S3; design §5.1). */
  formation: {
    /** Motivação perdida ao trocar de uma área para outra (sair do "sem área" é grátis). */
    changeAreaMotivation: 8
  },

  /** Notícias do Portal (Fase 4, S5). */
  news: {
    /** Máximo guardado no estado (as mais antigas saem). */
    max: 60,
    /** Não repete a mesma notícia do mesmo anúncio dentro desta janela, horas de jogo. */
    dedupeHours: 72
  },

  /** Escala da oficina (design §5.5). */
  workshop: {
    capacity: 4,
    /** Chance de ter aula em cada turno de dia útil (sorteada por pessoa). */
    classChance: { morning: 0.6, afternoon: 0.5, evening: 0.15 } as Record<string, number>,
    /** Teto de turnos por pessoa na escala sugerida pelo capitão. */
    maxShiftsPerWeek: 5,
    /** Motivação perdida por hora de madrugada; cada madrugada seguida soma este fator. */
    overnightMotivationPerHour: 0.6,
    overnightStreakExtra: 0.5,
    /** Na semana de um prazo, a madrugada une a equipe: motivação ganha por hora. */
    deadlineBoostPerHour: 0.4,
    deadlineWindowDays: 7,
    /** Qualidade perdida se todas as horas da tarefa fossem de madrugada (depois da 1h contam em dobro). */
    overnightQualityPenalty: 15,
    lateNightHour: 1,
    /** Mentoria no turno: veterano (≥ veteranMin) ensina novato com pelo menos minGap de diferença. */
    mentorPerHour: 0.3,
    veteranMin: 40,
    minGap: 20
  },

  /** Temporada desde novembro (Fase 6, S1). PROPOSTA: valores a calibrar no simulador de ano. */
  season: {
    /** Férias de verão (meados de dez a 13/fev): fração das horas por integrante. */
    summerFactor: 0.5,
    /** Leitura do regulamento: sem ela, a penalidade por alteração de projeto na inspeção é multiplicada por isto. */
    unreadPenaltyFactor: 2
  },

  /** Trainees (Fase 6, S2): etapa de dez a jan. */
  trainee: {
    /** Horas de treino do trainee para completar a etapa (progresso 100%). */
    hoursRequired: 24,
    /** Conhecimento ganho por hora de treino na disciplina de foco do trainee. */
    knowledgePerHour: 0.6,
    /** Sem capitão no treino, o trainee aproveita só esta fração das horas. */
    withoutCaptainShare: 0.5,
    /** No fim da etapa: chance de ficar = piso + (teto - piso) × motivação/100, × (0,5 + 0,5 × progresso). */
    stayChanceAtZero: 0.4,
    stayChanceAtFull: 0.95
  },

  /** Perfil do presidente (Fase 6, S2). PROPOSTA. */
  agenda: {
    /** Motivação para cada integrante ao concluir uma tarefa alinhada com a agenda. */
    alignedBoost: 1,
    /** Dias seguidos sem tarefa da agenda até o presidente perder motivação. */
    idleDays: 3,
    /** Motivação perdida por dia depois disso. */
    idlePenalty: 3,
    /** Dias guardados no registro (o "mês" da agenda). */
    logDays: 30
  },

  /** Orientador (Fase 6, S2): reputação 0–100, só exibida no Ano 1. */
  advisor: {
    startReputation: 10,
    reportSubmitted: 3,
    /** Fim da competição: ganho = base + por posição abaixo do último lugar do campo, arredondado. */
    competitionBase: 2,
    competitionPerPlaceFromLast: 0.25
  },

  calendar: {
    /** Aviso de prazo próximo, em dias (design §4.1). */
    warnDays: 7
  }
} as const;
