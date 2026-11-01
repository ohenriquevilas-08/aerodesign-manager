// Entrada da cena do voo (design §9.3 e §9.4). Descreve uma bateria JÁ resolvida pela
// simulação: a cena só anima o que recebe e nunca decide desfecho, distância ou nota.
// Tudo serializável, sem Phaser, para a simulação poder produzir e testar.

// Os tipos moram em sim/types.ts desde a Fase 3 (a simulação produz o playback).
import type { FlightOutcome } from "../../sim";

export type { CrashPhase, FlightOutcome, FlightPlayback } from "../../sim";

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
