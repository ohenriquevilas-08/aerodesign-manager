// Contrato de dados da simulação. Tudo aqui é serializável (vai para o save)
// e não depende de DOM, Preact ou Phaser. Ver docs/architecture.md.

/** Disciplinas do relatório 2026 (Regulamento 11.1). Eixo comum entre equipe, projeto e nota. */
export type Discipline =
  | "conceptual"
  | "aerodynamics"
  | "performance"
  | "stability"
  | "loads"
  | "structures"
  | "electrical";

export type RiskLevel = "none" | "low" | "medium" | "high";

/**
 * Custo de qualquer ação (design §8). Sempre exibido na mesma ordem:
 * horas ⏱, créditos ◆, prazo ⌛, risco ⚠.
 */
export interface Cost {
  /** Horas-pessoa consumidas da equipe. */
  hours: number;
  /** Créditos debitados do caixa. */
  credits: number;
  /** Dias de espera no calendário sem ocupar ninguém (entrega, cura, resposta). */
  leadDays: number;
  risk: RiskLevel;
}

export type ClockSpeed = 0 | 1 | 2 | 4;

export interface Clock {
  /** Horas de jogo desde o início da temporada (SEASON_START). */
  hours: number;
  /** 0 = pausado. */
  speed: ClockSpeed;
}

export type Role = "president" | "captain" | "member";

export interface Member {
  id: string;
  name: string;
  role: Role;
  /** Conhecimento tácito por disciplina, 0–100. */
  knowledge: Record<Discipline, number>;
  fabrication: number;
  piloting: number;
  agility: number;
  /** 0–100; multiplica horas e qualidade. */
  motivation: number;
  /** Horas disponíveis por dia em período normal de aulas. */
  hoursPerDay: number;
  /** Semestre previsto de saída, ex.: "2027.2". */
  graduation: string;
  taskId: string | null;
}

export type PartType = "wing" | "fuselage" | "tail" | "landingGear" | "powertrain" | "electronics";

/** Estados visíveis (design §7.2). Derivados de `condition`. */
export type PartState = "new" | "worn" | "damaged" | "broken";

export interface Part {
  id: string;
  type: PartType;
  label: string;
  /** 0–100. */
  quality: number;
  /** 0–100. */
  condition: number;
}

export type TaskStatus = "waiting" | "active" | "done";

export interface Task {
  id: string;
  /** Id do catálogo de ações. */
  actionId: string;
  label: string;
  /** Horas-pessoa totais e já feitas. */
  hoursTotal: number;
  hoursDone: number;
  /** Momento (horas de jogo) em que a espera de prazo termina; null se não há espera. */
  readyAt: number | null;
  status: TaskStatus;
  assignees: string[];
}

export interface InboxMessage {
  id: string;
  at: number;
  from: string;
  title: string;
  body: string;
  read: boolean;
}

export interface RivalTeam {
  id: string;
  name: string;
  institution: string;
  acronym: string;
  city: string;
  state: string;
  /** Arquétipo das rivais de destaque; null para o resto do campo. */
  archetype: string | null;
}

export interface GameState {
  version: 1;
  seed: number;
  rngState: number;
  clock: Clock;
  teamName: string;
  credits: number;
  members: Member[];
  /** Conhecimento documentado da equipe por disciplina (piso para todos). */
  documented: Record<Discipline, number>;
  parts: Part[];
  tasks: Task[];
  inbox: InboxMessage[];
  rivals: RivalTeam[];
}
