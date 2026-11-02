// Palestras de mentira para conferir a cena sem a simulação (montagem /lecture-dev.html e testes).
// Passam pelo mesmo caminho da cena de verdade: campanha (stub local) → lectureViewFromCampaign.

import type { MemberLook } from "../../sim";
import { palette } from "../palette";
import { lectureViewFromCampaign, type Applicant, type LecturePerson, type LectureView, type SelectionCampaign } from "./contract";

const FIRST = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gabi", "Hugo", "Iara", "João", "Karen", "Lucas", "Mara", "Nico", "Olga", "Pedro", "Rita", "Samuel", "Tânia", "Vitor"];
const LAST = ["Alves", "Barros", "Costa", "Dias", "Esteves", "Farias", "Gomes", "Lima", "Moura", "Nunes", "Ramos", "Silva"];
const COURSES = ["Eng. Aeronáutica", "Eng. Aeronáutica", "Eng. Aeronáutica", "Eng. Mecânica", "Eng. Mecânica", "Eng. Elétrica", "Computação", "Eng. de Produção"];

const founderLook = (skin: number, hair: number, hairColor: number, accessory?: MemberLook["accessory"]): MemberLook => ({
  skin,
  hair,
  hairColor,
  shirt: palette.highlight,
  ...(accessory ? { accessory } : {})
});

export const MOCK_FOUNDERS: LecturePerson[] = [
  { id: "f1", name: "Marina", look: founderLook(1, 0, 1, "glasses") },
  { id: "f2", name: "Caio", look: founderLook(3, 3, 0) },
  { id: "f3", name: "Beatriz", look: founderLook(0, 1, 3, "cap") }
];

/** Campanha de mentira: `registered` inscritos, dos quais `present` vieram (os outros faltaram). */
export function mockCampaign(registered: number, present: number): SelectionCampaign {
  const applicants: Applicant[] = Array.from({ length: registered }, (_, i) => ({
    id: `a${i}`,
    name: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`,
    course: COURSES[i % COURSES.length]!,
    semester: 1 + (i % 8),
    motivationText: "",
    // Os `present` primeiros vieram; o resto faltou.
    stage: i < present ? "lecture" : "absent",
    tag: null,
    notes: [],
    revealed: {}
  }));
  return { id: "mock", format: "open", stage: "lecture", openedAt: 0, closesAt: 0, lectureAt: 0, dynamicDayAt: 0, applicants, vacancies: null };
}

/** Palestra de mentira com `present` presentes de `registered` inscritos e `founders` fundadores no palco. */
export function mockLectureView(present: number, registered = Math.round(present / 0.6), founders = 1): LectureView {
  return lectureViewFromCampaign(mockCampaign(Math.max(registered, present), present), MOCK_FOUNDERS.slice(0, founders), "Equipe Aerodesign");
}
