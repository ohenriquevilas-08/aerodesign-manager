// Dedicação escolhida ao iniciar uma tarefa: troca horas por qualidade.
// Valores provisórios, para balancear no protótipo.

import type { TaskDedication } from "../types";

export type Dedication = TaskDedication;

export interface DedicationDef {
  id: Dedication;
  label: string;
  /** Multiplica as horas-pessoa da ação. */
  hoursFactor: number;
  /** Somado à qualidade da equipe (0–100) no rendimento da tarefa. */
  qualityBonus: number;
}

export const DEDICATIONS: readonly DedicationDef[] = [
  { id: "rush", label: "Rápido", hoursFactor: 0.6, qualityBonus: -15 },
  { id: "normal", label: "Normal", hoursFactor: 1, qualityBonus: 0 },
  { id: "careful", label: "Caprichado", hoursFactor: 1.6, qualityBonus: 15 }
];

export function findDedication(id: Dedication): DedicationDef {
  return DEDICATIONS.find((item) => item.id === id) ?? DEDICATIONS[1]!;
}
