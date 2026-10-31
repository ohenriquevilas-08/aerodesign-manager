// Classe Regular, Regulamento SAE BRASIL AeroDesign 2026 Rev01 (no jogo: Aerodesign Brasil).
// Os números ficam aqui para que o regulamento anual possa variar sem tocar nas fórmulas.

export const REGULAR_2026 = {
  maxSpan: 4.0, // m, R[7.2.0.1]
  maxPower: 600, // W de pico em voo, R[7.2.0.1]
  maxTakeoffWeight: 20, // kg, R[7.6.0.1]
  obstacleHeight: 0.9, // m, R[7.8.0.1]
  obstacleDistance: 55, // m, R[7.8.0.1]
  minValidPayload: 5.0, // kg, R[10.2.1.1]
  maxUnloadSeconds: 600, // R[7.7.7.1]
  maxSurfaces: 3, // N, 7.7.4
  reportMax: 185, // NR máx., 11.1
  oralMax: 40, // 11.1
  /** Corte por eficiência estrutural a partir da 4ª bateria (Tabela 10.1). Índice 0 = bateria 1. */
  batteryCutoffs: [
    { minEE: null, minTeams: null, topPositions: null },
    { minEE: null, minTeams: null, topPositions: null },
    { minEE: null, minTeams: null, topPositions: null },
    { minEE: 2.5, minTeams: 25, topPositions: 10 },
    { minEE: 3.0, minTeams: 20, topPositions: 10 },
    { minEE: 3.5, minTeams: 15, topPositions: 10 },
    { minEE: 4.0, minTeams: 15, topPositions: 10 }
  ]
} as const;

/** Máximo por capítulo do relatório (11.1). */
export const REPORT_CHAPTERS = {
  conceptual: 30,
  aerodynamics: 25,
  performance: 25,
  stability: 25,
  loads: 25,
  structures: 30,
  electrical: 25
} as const;
