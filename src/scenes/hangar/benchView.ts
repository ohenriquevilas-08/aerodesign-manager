// O que cada bancada do hangar mostra (design §7.2 e §11): a tarefa em andamento com barra de
// progresso e as peças com seu estado visível. Funções puras (testadas em tests/scenes/):
// a cena só desenha o que elas devolvem a partir de `state.tasks`, `state.parts` e `state.members`.

import { canWork, findAction, partState, type GameState, type Part, type PartState, type PartType, type Task } from "../../sim";

export type BenchId = "wing" | "fuselage" | "electronics" | "report";

export const BENCH_IDS: readonly BenchId[] = ["wing", "fuselage", "electronics", "report"];

export interface BenchTaskView {
  id: string;
  label: string;
  /** 0–1. */
  progress: number;
  /** Esperando prazo (entrega, cura): barra tracejada, sem gente trabalhando. */
  waiting: boolean;
}

export interface BenchPartView {
  label: string;
  state: PartState;
  /** Fora da especificação (loja barata): o cartão mostra uma marca discreta. */
  counterfeit: boolean;
}

export interface BenchView {
  id: BenchId;
  title: string;
  /** Tarefa mostrada no cartão: a primeira ativa da bancada, senão a primeira esperando. */
  task: BenchTaskView | null;
  /** Outras tarefas da mesma bancada, além da mostrada. */
  queued: number;
  /** Até MAX_BENCH_PARTS peças; o resto entra em `moreParts`. */
  parts: BenchPartView[];
  moreParts: number;
}

export const BENCH_TITLES: Record<BenchId, string> = {
  wing: "Asa",
  fuselage: "Fuselagem",
  electronics: "Eletrônica",
  report: "Relatório"
};

/** Peças demais deixariam o cartão maior que a bancada. */
export const MAX_BENCH_PARTS = 4;

/** Bancada onde cada tipo de peça fica guardada e é trabalhada. */
export const PART_BENCH: Record<PartType, BenchId> = {
  wing: "wing",
  fuselage: "fuselage",
  tail: "fuselage",
  landingGear: "fuselage",
  powertrain: "electronics",
  electronics: "electronics"
};

/** Ações sem peça no efeito que acontecem numa bancada: relatório e ensaios de bancada. */
const ACTION_BENCH: Record<string, BenchId> = {
  "report-chapter": "report",
  document: "report",
  drawings: "report",
  "oral-rehearsal": "report",
  "test-structural": "wing",
  "test-thrust": "electronics"
};

/**
 * Bancada da tarefa, ou null se ela não acontece no hangar (estudo, rifa, divulgação, voo).
 * Ordem: relatório e ensaios de bancada pelo id (ACTION_BENCH); peça fabricada ou comprada pelo efeito do catálogo; reparo pela
 * peça alvo; por último o nome da ação, para ações de fabricação que o catálogo ainda não tem.
 */
export function benchForTask(state: GameState, task: Pick<Task, "actionId" | "targetId">): BenchId | null {
  const fixed = ACTION_BENCH[task.actionId];
  if (fixed) return fixed;
  const effect = findAction(task.actionId)?.effect;
  if (effect && (effect.kind === "fabricate" || effect.kind === "purchase-part")) return PART_BENCH[effect.part];
  if (effect?.kind === "repair") {
    const part = state.parts.find((p) => p.id === task.targetId);
    return part ? PART_BENCH[part.type] : null;
  }
  const id = task.actionId;
  if (/wing/.test(id)) return "wing";
  if (/fuselage|gear|tail/.test(id)) return "fuselage";
  if (/motor|servo|electronic|powertrain|esc|propeller/.test(id)) return "electronics";
  return null;
}

/** Progresso da tarefa: horas feitas, ou, na espera ⌛, o tempo passado sobre o prazo prometido. */
export function taskProgress(state: GameState, task: Task): number {
  if (task.status === "done") return 1;
  if (task.status === "waiting") {
    const promised = task.expectedReadyAt;
    const leadHours = (findAction(task.actionId)?.cost.leadDays ?? 0) * 24;
    if (promised === null || leadHours <= 0) return 0;
    // O prazo real (readyAt) não é mostrado: a barra para em 99% se a entrega atrasar.
    return clamp((state.clock.hours - (promised - leadHours)) / leadHours, 0, 0.99);
  }
  return task.hoursTotal > 0 ? clamp(task.hoursDone / task.hoursTotal, 0, 1) : 0;
}

export function benchViewsFromState(state: GameState): BenchView[] {
  const open = state.tasks.filter((task) => task.status !== "done");
  return BENCH_IDS.map((id) => {
    const tasks = open.filter((task) => benchForTask(state, task) === id);
    // Ativa na frente: é o que a equipe está fazendo agora.
    const shown = tasks.find((task) => task.status === "active") ?? tasks[0] ?? null;
    const parts = state.parts.filter((part) => PART_BENCH[part.type] === id);
    return {
      id,
      title: BENCH_TITLES[id],
      task: shown && {
        id: shown.id,
        label: shown.label,
        progress: taskProgress(state, shown),
        waiting: shown.status === "waiting"
      },
      queued: Math.max(0, tasks.length - 1),
      parts: parts.slice(0, MAX_BENCH_PARTS).map((part) => ({
        label: part.label,
        state: partState(part.condition),
        // Part.counterfeit é opcional no contrato (vem das lojas).
        counterfeit: (part as Part & { counterfeit?: boolean }).counterfeit === true
      })),
      moreParts: Math.max(0, parts.length - MAX_BENCH_PARTS)
    };
  });
}

/** Estado visível de cada peça do avião montado no centro do hangar; null = peça ainda não existe. */
export type AircraftView = Record<PartType, PartState | null>;

/** A melhor peça de cada tipo vai no avião: maior condição, e na igualdade maior qualidade. */
export function bestParts(parts: readonly Part[]): Partial<Record<PartType, Part>> {
  const best: Partial<Record<PartType, Part>> = {};
  parts.forEach((part) => {
    const current = best[part.type];
    if (!current || part.condition > current.condition || (part.condition === current.condition && part.quality > current.quality)) {
      best[part.type] = part;
    }
  });
  return best;
}

export function aircraftViewFromState(state: GameState): AircraftView {
  const best = bestParts(state.parts);
  const view = (type: PartType) => (best[type] ? partState(best[type].condition) : null);
  return {
    wing: view("wing"),
    fuselage: view("fuselage"),
    tail: view("tail"),
    landingGear: view("landingGear"),
    powertrain: view("powertrain"),
    electronics: view("electronics")
  };
}

/**
 * Onde cada integrante fica no hangar. `bench` null = fora das bancadas (sem tarefa, tarefa
 * fora do hangar, ou presidente): fica na área livre, parado. `working` só para quem está
 * numa tarefa ativa da bancada; quem está alocado numa tarefa esperando prazo fica de pé, esperando.
 */
export interface WorkerView {
  memberId: string;
  name: string;
  bench: BenchId | null;
  /** Posição entre os que estão no mesmo lugar (bancada ou área livre), em ordem de `members`. */
  slot: number;
  working: boolean;
}

/**
 * `present`: ids de quem está na oficina agora (escala, design §5.5); quem não está não aparece.
 * Sem `present`, todos aparecem.
 */
export function workerViewsFromState(state: GameState, present?: readonly string[]): WorkerView[] {
  const taskById = new Map(state.tasks.map((task) => [task.id, task]));
  const counts = new Map<BenchId | null, number>();
  const here = present ? new Set(present) : null;
  const members = here ? state.members.filter((member) => here.has(member.id)) : state.members;
  return members.map((member) => {
    // `assignees` é a fonte; Member.taskId espelha.
    const task = state.tasks.find((t) => t.status !== "done" && t.assignees.includes(member.id)) ?? (member.taskId ? taskById.get(member.taskId) : undefined);
    const bench = canWork(member) && task && task.status !== "done" ? benchForTask(state, task) : null;
    const slot = counts.get(bench) ?? 0;
    counts.set(bench, slot + 1);
    return { memberId: member.id, name: member.name, bench, slot, working: bench !== null && task?.status === "active" };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
