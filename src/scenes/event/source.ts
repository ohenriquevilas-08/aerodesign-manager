// Leitura do modo evento para as cenas: junta `eventView(state)` da simulação com a equipe presente,
// os grupos da dinâmica e as luzes da inspeção. Sem evento aberto, devolve o `eventChannel` (só a
// montagem de dev, /event-dev.html, usa o canal).

import { applicantView, eventView, inspectionFindings, type CompetitionEventContext, type GameState, type SelectionDayContext } from "../../sim";
import { eventChannel } from "./channel";
import type { EventPerson, InspectionItemView, StageView } from "./contract";

/** Verificações que a simulação não reprova hoje: acendem verdes para a bancada não ficar vazia. */
const ROUTINE_CHECKS: InspectionItemView[] = [
  { id: "wing", label: "Fixação da asa", status: "ok" },
  { id: "kill", label: "Chave de segurança", status: "ok" },
  { id: "payload", label: "Compartimento de carga", status: "ok" }
];

function inspectionItems(state: GameState): InspectionItemView[] {
  const context = state.activeEvent?.context as CompetitionEventContext;
  const waived = state.competition?.waivedIssues ?? [];
  const items = inspectionFindings(state).map((finding): InspectionItemView => {
    const handled = context.inspectionHandled.includes(finding.id);
    // Aceita com penalidade: amarela; decidida e ainda travando: vermelha; ainda não vista: amarela piscando.
    const status = waived.includes(finding.id) ? "pending" : handled ? "fail" : "pending";
    return { id: finding.id, label: finding.text, status };
  });
  return [...ROUTINE_CHECKS, ...items];
}

export function readEventView(state: GameState): StageView | null {
  const view = eventView(state);
  const event = state.activeEvent;
  if (!view || !event) return eventChannel.current;

  const people = (ids: string[]): EventPerson[] =>
    ids.flatMap((id) => {
      const member = state.members.find((item) => item.id === id);
      return member ? [{ id, name: member.name, look: member.look }] : [];
    });

  let selection: StageView["selection"] = null;
  if (event.context.kind === "selection-day") {
    const context: SelectionDayContext = event.context;
    selection = {
      observedGroupId: context.watchedGroupId,
      observedGroupIds: context.watchedGroupIds,
      groups: context.groups.map((group) => ({
        id: group.id,
        label: group.name,
        gliderDistanceM: group.gliderDistanceM,
        members: group.candidateIds.flatMap((id) => {
          const candidate = applicantView(state, id);
          return candidate ? [{ id, name: candidate.name, look: candidate.look }] : [];
        })
      }))
    };
  }

  return {
    id: view.id,
    kind: view.kind,
    day: view.day,
    dayCount: view.totalDays,
    blocks: view.blocks,
    blockIndex: view.blockIndex,
    ...(view.venueId ? { venueId: view.venueId } : {}),
    crew: people(view.presentIds),
    selection,
    inspection: event.context.kind === "competition" ? { items: inspectionItems(state) } : null
  };
}
