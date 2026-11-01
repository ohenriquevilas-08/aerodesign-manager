// Eventos de mentira para conferir a moldura sem a simulação (montagem /event-dev.html e testes).
// Mesmo formato do EventView de ./contract.ts; os números são escolhidos à mão.

import type { MemberLook } from "../../sim";
import { palette } from "../palette";
import type { EventBlock, EventPerson, EventView } from "./contract";

const SHIRT = palette.highlight;
const CANDIDATE_SHIRTS = [palette.inkMuted, palette.accent, palette.ok, palette.ink, palette.warn, palette.inkDim];

const look = (skin: number, hair: number, hairColor: number, accessory?: MemberLook["accessory"]): MemberLook => ({
  skin,
  hair,
  hairColor,
  shirt: SHIRT,
  ...(accessory ? { accessory } : {})
});

const person = (id: string, name: string, l: MemberLook): EventPerson => ({ id, name, look: l });

export const MOCK_CREW: EventPerson[] = [
  person("c1", "Marina", look(1, 0, 1, "glasses")),
  person("c2", "Caio", look(3, 3, 0)),
  person("c3", "Beatriz", look(0, 1, 3, "cap")),
  person("c4", "Rafael", look(2, 2, 4)),
  person("c5", "Lia", look(4, 4, 0, "headband"))
];

const candidateLooks: MemberLook[] = [
  look(0, 1, 2),
  look(2, 0, 0, "glasses"),
  look(4, 3, 1),
  look(1, 2, 5),
  look(3, 4, 0, "cap"),
  look(5, 1, 0),
  look(2, 3, 3),
  look(1, 0, 4, "headband"),
  look(0, 2, 1),
  look(3, 1, 0),
  look(4, 0, 2, "glasses"),
  look(1, 4, 3)
];

const GROUP_LABELS = ["Grupo A", "Grupo B", "Grupo C", "Grupo D"];
const DISTANCES = [14.2, 21.6, 9.8, 17.5];

function groups() {
  return GROUP_LABELS.map((label, g) => ({
    id: `g${g}`,
    label,
    gliderDistanceM: DISTANCES[g]!,
    members: [0, 1, 2].map((k) => person(`k${g * 3 + k}`, `Candidato ${g * 3 + k + 1}`, { ...candidateLooks[g * 3 + k]!, shirt: CANDIDATE_SHIRTS[(g * 3 + k) % CANDIDATE_SHIRTS.length]! }))
  }));
}

const block = (id: string, startsAt: number, label: string, kind: EventBlock["kind"]): EventBlock => ({
  id,
  startsAt,
  label,
  kind
});

export const MOCK_SELECTION_BLOCKS: EventBlock[] = [
  block("reception", 8, "Recepção", "briefing"),
  block("presentation", 9, "Apresentação da equipe", "presentation"),
  block("challenge", 10, "Desafio: planador de balsa", "challenge"),
  block("launch", 11.5, "Lançamentos", "launch"),
  block("interview", 13, "Entrevistas rápidas", "interview"),
  block("deliberation", 15, "Deliberação", "deliberation")
];

export const MOCK_FLIGHT_TEST_BLOCKS: EventBlock[] = [
  block("travel", 7, "Viagem e chegada", "arrival"),
  block("setup", 8.5, "Montagem e checagem", "setup"),
  block("flight-1", 10, "Decolagem 1", "flight"),
  block("flight-2", 11, "Decolagem 2", "flight"),
  block("teardown", 13, "Desmontagem", "teardown")
];

export const MOCK_COMPETITION_BLOCKS: EventBlock[] = [
  block("arrival", 8, "Chegada ao pátio", "arrival"),
  block("inspection", 9, "Inspeção técnica", "inspection"),
  block("exhibit", 11, "Exposição", "exhibit"),
  block("queue", 13, "Fila da bateria 1", "queue"),
  block("flight", 14, "Bateria 1", "flight"),
  block("repair", 16, "Reparo", "repair"),
  block("ceremony", 17.5, "Premiação", "ceremony")
];

export function mockEventView(kind: EventView["kind"], blockIndex = 0): EventView {
  if (kind === "selection-day") {
    return {
      id: "mock-selection",
      kind,
      day: 1,
      dayCount: 1,
      blocks: MOCK_SELECTION_BLOCKS,
      blockIndex,
      crew: MOCK_CREW.slice(0, 4),
      selection: { groups: groups(), observedGroupId: "g1" },
      inspection: null
    };
  }
  if (kind === "flight-test") {
    return {
      id: "mock-flight-test",
      kind,
      day: 1,
      dayCount: 1,
      venueId: "aeroclub",
      blocks: MOCK_FLIGHT_TEST_BLOCKS,
      blockIndex,
      crew: MOCK_CREW.slice(0, 3),
      selection: null,
      inspection: null
    };
  }
  return {
    id: "mock-competition",
    kind,
    day: 1,
    dayCount: 3,
    blocks: MOCK_COMPETITION_BLOCKS,
    blockIndex,
    crew: MOCK_CREW,
    selection: null,
    inspection: {
      items: [
        { id: "cg", label: "Centro de gravidade", status: "ok" },
        { id: "wing", label: "Fixação da asa", status: "ok" },
        { id: "gear", label: "Trem de pouso", status: "pending" },
        { id: "kill", label: "Chave de segurança", status: "ok" },
        { id: "payload", label: "Compartimento de carga", status: "fail" }
      ]
    }
  };
}
