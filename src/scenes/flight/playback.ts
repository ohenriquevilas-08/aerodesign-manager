// Entrada da cena do voo (design §9.3 e §9.4). Descreve uma bateria JÁ resolvida pela
// simulação: a cena só anima o que recebe e nunca decide desfecho, distância ou nota.
// Tudo serializável, sem Phaser, para a simulação poder produzir e testar.

/** Desfechos possíveis de uma bateria (design §9.4). */
export type FlightOutcome =
  /** Voo válido: decolou, passou o obstáculo, fez o circuito e pousou dentro da pista. */
  | "valid"
  /** Não saiu do chão antes do obstáculo de 55 m: voo inválido. */
  | "no-takeoff"
  /** Saiu do chão mas passou baixo demais e rompeu a fita do obstáculo: voo inválido. */
  | "tape-break"
  /** Voo válido, mas parou fora da pista: sem BPO. */
  | "landing-out"
  /** Pouso duro: voo pode valer, mas peças saem danificadas. */
  | "damage"
  /** Perda de controle e queda: peças danificadas ou quebradas. */
  | "crash";

/** Em que trecho a queda acontece (só para `crash`). */
export type CrashPhase = "climb" | "circuit" | "approach";

export interface FlightPlayback {
  /** Número da bateria (1, 2, 3...). */
  battery: number;
  teamName: string;
  /** Carga útil embarcada, kg. */
  payloadKg: number;
  /** Altitude densidade do momento, m (Apêndice 4). */
  densityAltitudeM: number;
  /** Vento na pista: velocidade em m/s; positivo = de proa (contra a corrida), negativo = de cauda. */
  headwindMs: number;
  /** Distância da largada até a roda sair do chão, m. null se não decolou. */
  rotationDistanceM: number | null;
  /**
   * Folga sobre o topo do obstáculo de 0,9 m, aos 55 m, em m.
   * Positiva = passou por cima; negativa = abaixo da fita (rompeu). null se não chegou lá voando.
   */
  obstacleClearanceM: number | null;
  outcome: FlightOutcome;
  /** Distância de parada a partir do toque no solo, m. null se não houve pouso. */
  stopDistanceM: number | null;
  /** Tempo da retirada rápida de carga, s. null se não houve retirada. */
  unloadTimeS: number | null;
  /** Trecho da queda; usado só quando `outcome` é "crash". Padrão: "circuit". */
  crashPhase?: CrashPhase;
  /** Peças afetadas, para o cartão final ("Trem de pouso danificado"). */
  damagedParts?: string[];
}

/** Regras fixas do regulamento que a cena desenha (Regulamento 2026, Classe Regular). */
export const FLIGHT_RULES = {
  /** Obstáculo: altura e distância do início da corrida. */
  obstacleHeightM: 0.9,
  obstacleDistanceM: 55,
  /** Marcações de distância desenhadas na pista. */
  runwayMarksM: [40, 45, 50, 55],
  /** Quadrado da retirada rápida de carga, m (até 2 pessoas). */
  unloadSquareM: 3,
  /** Retirada: bônus máximo até 20 s, zero a partir de 30 s (BRC). */
  unloadFullBonusS: 20,
  unloadZeroBonusS: 30
} as const;

/** Rótulos dos desfechos, em PT-BR, para o carimbo e o cartão final. */
export const OUTCOME_LABEL: Record<FlightOutcome, string> = {
  valid: "Voo válido",
  "no-takeoff": "Não decolou antes do obstáculo",
  "tape-break": "Rompeu a fita",
  "landing-out": "Pouso fora da pista",
  damage: "Pouso com dano",
  crash: "Queda"
};
