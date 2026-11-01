// Formação por área (Fase 4, S3): quem está em qual área, capitão e vagas. A UI desenha o "campo"
// a partir de formationView; o presidente fica fora da formação.

import { BALANCE } from "./content/balance";
import { DEFAULT_CATEGORY, FORMATIONS, findFormationArea, type FormationCategory } from "./content/formations";
import { warn } from "./tasks";
import { canWork, clamp, DISCIPLINE_LABELS, rosterMembers } from "./team";
import type { Discipline, GameState, Member } from "./types";

export interface FormationAreaView {
  discipline: Discipline;
  label: string;
  captainId: string | null;
  memberIds: string[];
  /** Vagas de integrante ainda livres. */
  openSlots: number;
  captainOpen: boolean;
  /** Aviso do que para sem a área; null se ela tem alguém. */
  warning: string | null;
}

export interface FormationView {
  category: FormationCategory;
  areas: FormationAreaView[];
  /** Integrantes sem área (novatos recém-chegados), fora o presidente. */
  unassigned: string[];
  /** O presidente (você), fora do campo; null se não existe. */
  presidentId: string | null;
}

export function formationView(state: GameState, category: FormationCategory = DEFAULT_CATEGORY): FormationView {
  const players = rosterMembers(state);
  const areas = FORMATIONS[category].map((def): FormationAreaView => {
    const inArea = players.filter((member) => member.area === def.discipline);
    const captain = inArea.find((member) => member.role === "captain") ?? null;
    const memberIds = inArea.filter((member) => member.role !== "captain").map((member) => member.id);
    return {
      discipline: def.discipline,
      label: DISCIPLINE_LABELS[def.discipline],
      captainId: captain?.id ?? null,
      memberIds,
      openSlots: Math.max(0, def.members - memberIds.length),
      captainOpen: captain === null,
      warning: inArea.length === 0 ? def.stops : null
    };
  });
  const known = new Set<Discipline>(FORMATIONS[category].map((def) => def.discipline));
  return {
    category,
    areas,
    unassigned: players.filter((member) => !member.area || !known.has(member.area)).map((member) => member.id),
    presidentId: state.members.find((member) => !canWork(member))?.id ?? null
  };
}

const patch = (state: GameState, memberId: string, change: Partial<Member>): GameState => ({
  ...state,
  members: state.members.map((item) => (item.id === memberId ? { ...item, ...change } : item))
});

/**
 * Põe o integrante numa área (ou tira, com `area` null). Recusa: presidente, área desconhecida,
 * área cheia, dois capitães na mesma área. Trocar de uma área para outra custa motivação
 * (BALANCE.formation.changeAreaMotivation); o conhecimento tácito fica na disciplina antiga.
 */
export function setArea(state: GameState, memberId: string, area: Discipline | null, captain = false): GameState {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return warn(state, "Integrante não encontrado.");
  if (!canWork(member)) return warn(state, "O presidente coordena a equipe; ele não entra na formação.");
  if (area === null) {
    if (member.area === null && member.role === "member") return state;
    return patch(state, memberId, { area: null, role: "member" });
  }
  const def = findFormationArea(DEFAULT_CATEGORY, area);
  if (!def) return warn(state, "Essa área não existe na formação da categoria.");
  const others = state.members.filter((item) => item.id !== memberId && canWork(item) && item.area === area);
  if (captain) {
    if (others.some((item) => item.role === "captain")) return warn(state, `${DISCIPLINE_LABELS[area]} já tem capitão.`);
  } else if (others.filter((item) => item.role !== "captain").length >= def.members) {
    return warn(state, `${DISCIPLINE_LABELS[area]} está cheia (${def.members} vagas de integrante).`);
  }
  const role = captain ? "captain" : "member";
  if (member.area === area && member.role === role) return state;
  const moved = member.area !== null && member.area !== area;
  return patch(state, memberId, {
    area,
    role,
    ...(moved ? { motivation: clamp(member.motivation - BALANCE.formation.changeAreaMotivation) } : {})
  });
}
