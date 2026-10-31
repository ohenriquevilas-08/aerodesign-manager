// O que cada bancada do hangar mostra (design §7.2 e §11): a tarefa em andamento com barra de
// progresso e as peças com seu estado visível. É o ponto de extensão da simulação no hangar:
// a cena só desenha o que `benchViewsFromState` devolve.

import type { GameState, PartState } from "../../sim";

export type BenchId = "wing" | "fuselage" | "electronics" | "report";

export interface BenchTaskView {
  label: string;
  /** 0–1. */
  progress: number;
  /** Esperando prazo (entrega, cura): barra tracejada, sem gente trabalhando. */
  waiting: boolean;
}

export interface BenchPartView {
  label: string;
  state: PartState;
}

export interface BenchView {
  id: BenchId;
  title: string;
  task: BenchTaskView | null;
  parts: BenchPartView[];
}

export const BENCH_TITLES: Record<BenchId, string> = {
  wing: "Asa",
  fuselage: "Fuselagem",
  electronics: "Eletrônica",
  report: "Relatório"
};

/**
 * Hoje: dados simulados que andam com o relógio, só para a cena ter o que mostrar.
 * Quando a simulação ligar tarefas e peças às bancadas, trocar o corpo desta função
 * (ex.: tarefas por `actionId`, peças por `PartType`) e manter a assinatura.
 */
export function benchViewsFromState(state: GameState): BenchView[] {
  const hours = state.clock.hours;
  const cycle = (period: number, offset: number) => (((hours + offset) / period) % 1 + 1) % 1;
  return [
    {
      id: "wing",
      title: BENCH_TITLES.wing,
      task: { label: "Nervuras da asa", progress: cycle(60, 12), waiting: false },
      parts: [{ label: "Asa P1", state: "new" }]
    },
    {
      id: "fuselage",
      title: BENCH_TITLES.fuselage,
      task: { label: "Cura da treliça", progress: cycle(90, 40), waiting: true },
      parts: [
        { label: "Fuselagem P1", state: "worn" },
        { label: "Trem de pouso", state: "damaged" }
      ]
    },
    {
      id: "electronics",
      title: BENCH_TITLES.electronics,
      task: { label: "Chicote e servos", progress: cycle(40, 5), waiting: false },
      parts: [{ label: "Hélice", state: "broken" }]
    },
    {
      id: "report",
      title: BENCH_TITLES.report,
      task: { label: "Cap. Aerodinâmica", progress: cycle(120, 70), waiting: false },
      parts: []
    }
  ];
}
