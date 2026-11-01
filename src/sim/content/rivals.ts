// Perfis das rivais por arquétipo (design §2.1). Cada número é uma faixa [mín, máx];
// a simulação sorteia dentro dela a partir do seed da partida e do id da equipe.
// Valores provisórios: o balanceamento acontece no protótipo.

export type Range = readonly [number, number];

export interface RivalArchetype {
  /** Envergadura, m. */
  span: Range;
  surfaces: 1 | 2 | 3;
  emptyWeightKg: Range;
  /** Eficiência estrutural real a Hρ 1000 m (carga ÷ peso vazio). */
  ee: Range;
  /** Potência projetada, W (limitada a 600). */
  powerW: Range;
  /** Erro relativo das previsões de carga e peso vazio (FPV, PAC). */
  predictionError: Range;
  /** Nota do relatório (0–185) e da apresentação oral (0–40). */
  report: Range;
  oral: Range;
  pilot: Range;
  stability: Range;
  /** Carga escolhida ÷ carga prevista pela reta: > 1 = arrisca. */
  aggressiveness: Range;
  unloadSeconds: Range;
}

/** Campo comum (archetype null). */
export const GENERIC_RIVAL: RivalArchetype = {
  span: [2.2, 3.6],
  surfaces: 2,
  emptyWeightKg: [3, 4.6],
  ee: [1.6, 3.2],
  powerW: [450, 600],
  predictionError: [0.05, 0.16],
  report: [55, 140],
  oral: [14, 32],
  pilot: [50, 80],
  stability: [0.6, 0.85],
  aggressiveness: [0.94, 1.07],
  unloadSeconds: [17, 34]
};

export const RIVAL_ARCHETYPES: Record<string, RivalArchetype> = {
  /** A tradicional, multicampeã: avião eficiente e previsões precisas. */
  tradicional: {
    ...GENERIC_RIVAL,
    span: [2.6, 3.0],
    emptyWeightKg: [2.8, 3.2],
    ee: [3.4, 3.9],
    powerW: [560, 600],
    predictionError: [0.02, 0.04],
    report: [145, 165],
    oral: [32, 37],
    pilot: [82, 92],
    stability: [0.82, 0.9],
    aggressiveness: [0.97, 1],
    unloadSeconds: [14, 18]
  },
  /** A que aposta tudo em carga: asa grande, arrisca a carga. */
  carga: {
    ...GENERIC_RIVAL,
    span: [3.6, 4.0],
    emptyWeightKg: [4, 4.6],
    ee: [3.1, 3.6],
    powerW: [580, 600],
    predictionError: [0.05, 0.08],
    report: [105, 130],
    oral: [24, 30],
    pilot: [72, 82],
    stability: [0.65, 0.75],
    aggressiveness: [1.02, 1.06],
    unloadSeconds: [15, 20]
  },
  /** A obcecada por relatório: avião modesto, NR altíssima. */
  relatorio: {
    ...GENERIC_RIVAL,
    span: [2.4, 2.8],
    emptyWeightKg: [3, 3.5],
    ee: [2.6, 3],
    predictionError: [0.02, 0.04],
    report: [160, 172],
    oral: [35, 39],
    pilot: [68, 78],
    stability: [0.82, 0.9],
    aggressiveness: [0.94, 0.98],
    unloadSeconds: [18, 22]
  },
  /** A do instituto de aeronáutica: técnica, fria, quase sem erro de previsão. */
  tecnica: {
    ...GENERIC_RIVAL,
    span: [2.8, 3.2],
    emptyWeightKg: [2.9, 3.3],
    ee: [3.2, 3.6],
    powerW: [560, 600],
    predictionError: [0.01, 0.03],
    report: [140, 155],
    oral: [30, 35],
    pilot: [78, 88],
    stability: [0.86, 0.92],
    aggressiveness: [0.95, 0.98],
    unloadSeconds: [15, 19]
  },
  /** A novata ambiciosa (como você): alto risco, alta variância. */
  novata: {
    ...GENERIC_RIVAL,
    span: [2.6, 3.4],
    emptyWeightKg: [3.4, 4.2],
    ee: [2.2, 3],
    predictionError: [0.08, 0.14],
    report: [85, 115],
    oral: [20, 28],
    pilot: [58, 70],
    stability: [0.6, 0.72],
    aggressiveness: [1.02, 1.08],
    unloadSeconds: [20, 28]
  }
};
