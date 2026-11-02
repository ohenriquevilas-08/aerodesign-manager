// Eventos de mentira para conferir a moldura sem a simulação (montagem /event-dev.html e testes).
// Mesmo formato do StageView de ./contract.ts; os números são escolhidos à mão.

import type { MemberLook } from "../../sim";
import { palette } from "../palette";
import type { EventBlock, EventPerson, StageView } from "./contract";
import { splitIntoGroups } from "./groups";

const SHIRT = palette.highlight;

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

const GROUP_LABELS = ["Grupo A", "Grupo B", "Grupo C", "Grupo D", "Grupo E", "Grupo F", "Grupo G", "Grupo H"];
const DISTANCES = [14.2, 21.6, 9.8, 17.5, 12.3, 19.1, 8.4, 16.0];

// Os candidatos vêm com a camiseta da equipe no perfil (como na simulação): a cena é que troca a roupa.
/** Quem veio à dinâmica na montagem de dev (Fase 9: dezenas de pessoas em grupos de 5 a 6). */
export const MOCK_CANDIDATE_COUNT = 32;

function groups(total = MOCK_CANDIDATE_COUNT) {
  const people = Array.from({ length: total }, (_, k) =>
    person(`k${k}`, `Candidato ${k + 1}`, candidateLooks[k % candidateLooks.length]!)
  );
  return splitIntoGroups(people).map((members, g) => ({
    id: `g${g}`,
    label: GROUP_LABELS[g]!,
    gliderDistanceM: DISTANCES[g]!,
    members
  }));
}

const block = (id: string, startsAt: number, label: string, kind: EventBlock["kind"]): EventBlock => ({
  id,
  startsAt,
  label,
  kind
});

export const MOCK_SELECTION_BLOCKS: EventBlock[] = [
  block("reception", 9, "Recepção", "reception"),
  block("presentation", 10, "Apresentação da equipe", "presentation"),
  block("challenge", 11, "Desafio: planador de balsa", "challenge"),
  block("interviews", 14, "Entrevistas rápidas", "interviews"),
  block("deliberation", 16, "Deliberação", "deliberation")
];

export const MOCK_FLIGHT_TEST_BLOCKS: EventBlock[] = [
  block("travel", 5, "Viagem e chegada", "travel"),
  block("assembly", 6.5, "Montagem e checagem", "assembly"),
  block("takeoff-1", 8, "Decolagem 1", "takeoff"),
  block("takeoff-2", 9, "Decolagem 2", "takeoff"),
  block("teardown", 10.5, "Desmontagem", "teardown")
];

export const MOCK_COMPETITION_BLOCKS: EventBlock[] = [
  block("arrival", 8, "Chegada ao pátio", "arrival"),
  block("exhibition", 9, "Exposição do avião", "exhibition"),
  block("inspection", 13, "Inspeção técnica", "inspection"),
  block("briefing", 16.5, "Reunião técnica", "briefing"),
  block("flights", 8.5, "Janela de voo", "flights"),
  block("awards", 17.5, "Premiação", "awards")
];

export function mockEventView(kind: StageView["kind"], blockIndex = 0, candidates = MOCK_CANDIDATE_COUNT): StageView {
  if (kind === "selection-day") {
    return {
      id: "mock-selection",
      kind,
      day: 1,
      dayCount: 1,
      blocks: MOCK_SELECTION_BLOCKS,
      blockIndex,
      crew: MOCK_CREW.slice(0, 4),
      selection: { groups: groups(candidates), observedGroupId: null, observedGroupIds: ["g1", "g4"] },
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
