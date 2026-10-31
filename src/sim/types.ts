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
  /** 0–100; captação (rifa, patrocínio) e seletiva. */
  communication: number;
  /** 0–100; multiplica horas e qualidade. */
  motivation: number;
  /** Horas disponíveis por dia em período normal de aulas. */
  hoursPerDay: number;
  /** Semestre previsto de saída, ex.: "2027.2". */
  graduation: string;
  taskId: string | null;
  /**
   * Horas de jogo seguidas em tarefa ativa; acima de BALANCE.motivation.overloadAfterHours
   * a pessoa está sobrecarregada. Recupera quando fica parada.
   */
  workStreakHours: number;
}

/** Candidato da seletiva (design §5.2): vira Member com role "member" ao ser convidado. */
export interface Candidate {
  id: string;
  name: string;
  /** Formato da seletiva que trouxe o candidato (content/selection.ts). */
  format: string;
  /** Disciplina em que o candidato chega sabendo algo. */
  focus: Discipline;
  knowledge: Record<Discipline, number>;
  fabrication: number;
  agility: number;
  communication: number;
  motivation: number;
  hoursPerDay: number;
  graduation: string;
  /** Parecer de um capitão, em PT-BR. */
  opinion: string;
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

/** waiting: esperando prazo ⌛ (readyAt); active: consome horas; done: concluída (fica como histórico). */
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
  /** Quem está alocado agora (espelha Member.taskId). Vazio depois de concluída. */
  assignees: string[];
  /** Horas trabalhadas por integrante; base de conhecimento e qualidade na conclusão. */
  contributions: Record<string, number>;
  /** Alvo escolhido no start-action (peça, tarefa ou disciplina), se a ação exige. */
  targetId: string | null;
  /** Momento (horas de jogo) da conclusão; null enquanto não termina. */
  doneAt: number | null;
}

export interface InboxMessage {
  id: string;
  at: number;
  from: string;
  title: string;
  body: string;
  read: boolean;
}

/** Motivo da pausa atual. "start": jogo recém-criado; "manual": jogador pausou. */
export type PauseReason = "start" | "manual" | "task-done" | "deadline-soon" | "deadline-passed";

export interface PauseInfo {
  reason: PauseReason;
  /** Horas de jogo em que pausou. */
  at: number;
  /** Mensagem da inbox que explica a pausa automática, se houver. */
  messageId: string | null;
}

/** Aviso curto de um comando recusado (ex.: sem caixa). `id` muda a cada aviso novo. */
export interface Warning {
  id: number;
  at: number;
  text: string;
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
  version: 2;
  seed: number;
  rngState: number;
  clock: Clock;
  teamName: string;
  credits: number;
  members: Member[];
  /** Conhecimento documentado da equipe por disciplina (piso para todos). */
  documented: Record<Discipline, number>;
  parts: Part[];
  /** Consumíveis em estoque (ex.: balsa), por id de item. */
  stock: Record<string, number>;
  /** Equipamentos permanentes possuídos (ex.: "scale"). */
  equipment: string[];
  tasks: Task[];
  inbox: InboxMessage[];
  rivals: RivalTeam[];
  /** Candidatos da última seletiva ainda sem resposta. Convite é gratuito. */
  candidates: Candidate[];
  /** Não nulo enquanto o relógio está pausado (speed 0): diz por quê. */
  pause: PauseInfo | null;
  /** Último comando recusado; a UI mostra quando `id` muda. */
  warning: Warning | null;
  /** Contador para ids determinísticos de tarefas, peças, mensagens e avisos. */
  nextId: number;
}
