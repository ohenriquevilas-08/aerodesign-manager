// Palestras de mentira para conferir a cena sem a simulação (montagem /lecture-dev.html e testes).
// Passam pelo mesmo caminho da cena de verdade: planilha (ApplicantView) → lectureViewFromApplicants.

import { drawLook, type ApplicantView, type MemberLook } from "../../sim";
import { palette } from "../palette";
import { hashString, lectureViewFromApplicants, type LecturePerson, type LectureView } from "./contract";

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

/** Planilha de mentira: `registered` inscritos, dos quais `present` vieram (os outros faltaram). */
export function mockApplicants(registered: number, present: number): ApplicantView[] {
  return Array.from({ length: registered }, (_, i): ApplicantView => {
    const id = `a${i}`;
    return {
      id,
      name: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`,
      course: "aeronautical",
      courseLabel: COURSES[i % COURSES.length]!,
      semester: 1 + (i % 8),
      motivationText: "",
      // Os `present` primeiros vieram; o resto faltou.
      stage: i < present ? "lecture" : "absent",
      tag: null,
      notes: [],
      lecture: i < present ? "present" : "absent",
      dynamic: null,
      questionIds: [],
      answers: [],
      look: drawLook(hashString(id) || 1, i % 3 === 0).look
    };
  });
}

/** Palestra de mentira com `present` presentes de `registered` inscritos e `founders` fundadores no palco. */
export function mockLectureView(present: number, registered = Math.round(present / 0.6), founders = 1): LectureView {
  return lectureViewFromApplicants("mock", mockApplicants(Math.max(registered, present), present), MOCK_FOUNDERS.slice(0, founders), "Equipe Aerodesign");
}
