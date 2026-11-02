// Seletiva imersiva (Fase 9, U1 a U4): lógica pura das telas da planilha, do funil, das entrevistas e
// da aprovação. Só lê a simulação (`applicantViews`, `selectionView`); nada de Preact aqui.

import {
  BALANCE,
  clockToDate,
  dateToHours,
  TRAINEE_END,
  type ApplicantStage,
  type ApplicantTag,
  type ApplicantView,
  type FunnelCounts,
  type SelectionStage
} from "../../sim";

export const STAGE_LABEL: Record<ApplicantStage, string> = {
  applied: "Inscrito",
  lecture: "Na palestra",
  dynamic: "Na dinâmica",
  interview: "Entrevista",
  approved: "Aprovado",
  rejected: "Fora",
  absent: "Faltou"
};

export const TAG_LABEL: Record<NonNullable<ApplicantTag>, string> = { call: "Chamar", maybe: "Talvez", no: "Não" };

/** Tecla da planilha → marca (`null` limpa). `undefined` = a tecla não é da planilha. */
export function tagForKey(key: string): ApplicantTag | null | undefined {
  switch (key.toLowerCase()) {
    case "c":
      return "call";
    case "t":
      return "maybe";
    case "n":
      return "no";
    case "x":
    case "delete":
    case "backspace":
      return null;
    default:
      return undefined;
  }
}

export type SheetColumn = "arrival" | "name" | "course" | "semester" | "stage" | "tag";

export interface SheetSort {
  column: SheetColumn;
  descending: boolean;
}

export interface SheetFilter {
  text: string;
  course: string;
  stage: ApplicantStage | "all";
  tag: NonNullable<ApplicantTag> | "none" | "all";
}

export const NO_FILTER: SheetFilter = { text: "", course: "all", stage: "all", tag: "all" };

const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function filterApplicants(rows: readonly ApplicantView[], filter: SheetFilter): ApplicantView[] {
  const term = normalize(filter.text.trim());
  return rows.filter((row) => {
    if (filter.course !== "all" && row.course !== filter.course) return false;
    if (filter.stage !== "all" && row.stage !== filter.stage) return false;
    if (filter.tag === "none" ? row.tag !== null : filter.tag !== "all" && row.tag !== filter.tag) return false;
    return term === "" || normalize(`${row.name} ${row.courseLabel} ${row.motivationText}`).includes(term);
  });
}

const TAG_ORDER: Record<string, number> = { call: 0, maybe: 1, none: 2, no: 3 };
const STAGE_ORDER: ApplicantStage[] = ["applied", "lecture", "dynamic", "interview", "approved", "rejected", "absent"];

/** Ordena sem mexer na lista original; "arrival" é a ordem de chegada (a da simulação). */
export function sortApplicants(rows: readonly ApplicantView[], sort: SheetSort): ApplicantView[] {
  const indexed = rows.map((row, index) => ({ row, index }));
  const key = (row: ApplicantView): string | number => {
    switch (sort.column) {
      case "name":
        return normalize(row.name);
      case "course":
        return normalize(row.courseLabel);
      case "semester":
        return row.semester;
      case "stage":
        return STAGE_ORDER.indexOf(row.stage);
      case "tag":
        return TAG_ORDER[row.tag ?? "none"]!;
      default:
        return 0;
    }
  };
  indexed.sort((a, b) => {
    const ka = key(a.row);
    const kb = key(b.row);
    const cmp = ka < kb ? -1 : ka > kb ? 1 : 0;
    // Empate (e a ordem de chegada) segue a posição original; invertida, a mais nova primeiro.
    return cmp !== 0 ? (sort.descending ? -cmp : cmp) : sort.descending ? b.index - a.index : a.index - b.index;
  });
  return indexed.map((item) => item.row);
}

/** Próxima ordenação: clicar na mesma coluna inverte a ordem. */
export function nextSort(sort: SheetSort, column: SheetColumn): SheetSort {
  return sort.column === column ? { column, descending: !sort.descending } : { column, descending: false };
}

/** Anda `delta` linhas na lista (para o teclado), sem sair dela. */
export function stepIndex(current: number, delta: number, length: number): number {
  if (length === 0) return -1;
  const from = current < 0 ? (delta > 0 ? -1 : length) : current;
  return Math.max(0, Math.min(length - 1, from + delta));
}

// ------------------------------------------------------------------ funil

export interface FunnelStep {
  id: "applicants" | "lecture" | "dynamic" | "interview" | "approved";
  label: string;
  count: number;
  /** Fração do total de inscritos (largura da barra). */
  ratio: number;
  /** A etapa já aconteceu (ou está acontecendo). */
  reached: boolean;
}

const STAGE_RANK: Record<SelectionStage, number> = {
  promotion: 0,
  open: 1,
  lecture: 2,
  dynamic: 3,
  shortlist: 4,
  interview: 5,
  interviewing: 5,
  decision: 6
};

/** O funil afinando: inscritos → palestra → dinâmica → entrevistas → aprovados. */
export function funnelSteps(counts: FunnelCounts, rows: readonly ApplicantView[], stage: SelectionStage): FunnelStep[] {
  const called = rows.filter((row) => row.stage === "interview").length;
  const total = Math.max(1, counts.applicants);
  const rank = STAGE_RANK[stage];
  const step = (id: FunnelStep["id"], label: string, count: number, reachedAt: number): FunnelStep => ({
    id,
    label,
    count,
    ratio: Math.min(1, count / total),
    reached: rank >= reachedAt
  });
  return [
    step("applicants", "Inscritos", counts.applicants, 1),
    step("lecture", "Na palestra", counts.present, 3),
    step("dynamic", "Na dinâmica", counts.dynamic, 4),
    step("interview", "Entrevistas", Math.max(called, counts.interviewed), 5),
    step("approved", "Aprovados", counts.approved, 7)
  ];
}

/** As etapas da campanha como a mesa do jogador as vê. */
export const CAMPAIGN_STEPS: readonly { stages: SelectionStage[]; label: string }[] = [
  { stages: ["promotion"], label: "Divulgação" },
  { stages: ["open"], label: "Inscrições" },
  { stages: ["lecture"], label: "Palestra" },
  { stages: ["dynamic", "shortlist"], label: "Dinâmica" },
  { stages: ["interview", "interviewing"], label: "Entrevistas" },
  { stages: ["decision"], label: "Aprovação" }
];

export const campaignStepIndex = (stage: SelectionStage): number => CAMPAIGN_STEPS.findIndex((item) => item.stages.includes(stage));

// ------------------------------------------------------------------ datas

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "5/dez às 19h" a partir das horas de jogo. */
export function dateLabel(hours: number): string {
  const date = new Date(clockToDate(hours));
  return `${date.getUTCDate()}/${MONTHS[date.getUTCMonth()]} às ${date.getUTCHours()}h`;
}

/** "hoje", "amanhã" ou "em N dias". */
export function inDays(at: number, now: number): string {
  const days = Math.ceil((at - now) / 24);
  if (days <= 0) return "hoje";
  return days === 1 ? "amanhã" : `em ${days} dias`;
}

// ------------------------------------------------------------------ entrevistas e aprovação

const S = BALANCE.selection;

/** Horas-pessoa para entrevistar `count` pessoas (a mesma conta de `interviewHours` na simulação). */
export const interviewCost = (count: number): number => count * S.interviewHours * S.interviewers;

/** Horas-pessoa de uma sessão de "Treinamento de trainees" (catálogo de ações). */
export const TRAINING_SESSION_HOURS = 8;

export interface TrainingCost {
  trainees: number;
  /** Horas de treino de cada trainee para completar a etapa. */
  hoursEach: number;
  /** Horas-pessoa de treino de todos. */
  totalHours: number;
  /** Quantas sessões de treinamento (as horas da tarefa se dividem entre todos) isso dá. */
  sessions: number;
  /** Dias até o fim da etapa trainee (1/fev); 0 ou menos = a etapa já acabou. */
  daysLeft: number;
}

/** O que `trainees` aprovados custam em horas de capitão até o fim da etapa trainee. */
export function trainingCost(trainees: number, nowHours: number): TrainingCost {
  const totalHours = trainees * BALANCE.trainee.hoursRequired;
  return {
    trainees,
    hoursEach: BALANCE.trainee.hoursRequired,
    totalHours,
    sessions: Math.ceil(totalHours / TRAINING_SESSION_HOURS),
    daysLeft: Math.max(0, Math.ceil((dateToHours(TRAINEE_END) - nowHours) / 24))
  };
}
