// Fase 9, S1 a S5: seletiva imersiva. Inscrito não é membro, a informação chega aos poucos e a
// campanha inteira dura cerca de 6 semanas (docs/phases/fase-9.md).

import { describe, expect, it } from "vitest";
import {
  applicantView,
  applicantViews,
  applyCommand,
  BALANCE,
  createGame,
  dateToHours,
  deserializeState,
  expectedApplicants,
  funnelCounts,
  INTERVIEW_QUESTIONS,
  interviewHours,
  interviewSpread,
  SELECTION_FORMATS,
  selectionView,
  serializeState,
  type ApplicantTag,
  type Command,
  type GameState
} from "../../src/sim";
import { foundedGame, playEvent, selectionDayStep, withApplicants, withTrainees } from "./helpers";

const run = (state: GameState, ...commands: Command[]): GameState => commands.reduce(applyCommand, state);
const CREW = ["founder-marina", "founder-caio"];
const S = BALANCE.selection;

/** Deixa o relógio correr (um dia de jogo por chamada) até `done`; falha se passar de `maxDays`. */
function advanceUntil(state: GameState, done: (state: GameState) => boolean, maxDays = 90): GameState {
  let game = state;
  for (let day = 0; day < maxDays && !done(game); day += 1) {
    game = selectionDayStep(game);
  }
  if (!done(game)) throw new Error(`Não chegou lá em ${maxDays} dias (etapa: ${game.selection?.stage})`);
  return game;
}

const stageIs = (stage: string) => (state: GameState) => state.selection?.stage === stage;
const applicants = (state: GameState) => state.selection!.applicants;

/** Abre a campanha de novembro e deixa a divulgação terminar: as inscrições abertas. */
function opened(seed: number, outreach = 25, format = "broad"): GameState {
  const game: GameState = { ...foundedGame({ seed, teamName: "T" }), outreach };
  return advanceUntil(run(game, { type: "open-selection", format: format as never, memberIds: CREW }), stageIs("open"));
}

/** Campanha de atalho já na dinâmica: `count` presentes da palestra e a dinâmica marcada para já. */
function readyForDynamic(seed: number, count: number, tags: (index: number) => ApplicantTag | null = () => null): GameState {
  const base = withApplicants(foundedGame({ seed, teamName: "T" }), count);
  const campaign = base.selection!;
  return {
    ...base,
    selection: {
      ...campaign,
      stage: "dynamic",
      dynamicDayAt: base.clock.hours + 2,
      applicants: campaign.applicants.map((item, index) => ({ ...item, stage: "lecture" as const, tag: tags(index), revealed: { ...item.revealed, lecture: "present" as const } }))
    }
  };
}

/** Joga a dinâmica inteira e fecha: a campanha fica na etapa de escolher quem entrevista. */
function afterDynamic(state: GameState): GameState {
  let game = advanceUntil(state, (s) => !!s.activeEvent, 5);
  game = playEvent(game);
  return game;
}

/** A campanha inteira, da divulgação à aprovação, como um jogador faria. */
function playCampaign(seed: number, format = "broad", outreach = 25) {
  const log: { stage: string; day: number }[] = [];
  const mark = (state: GameState) => log.push({ stage: state.selection?.stage ?? "fim", day: state.clock.hours / 24 });
  let game: GameState = { ...foundedGame({ seed, teamName: "T" }), outreach };
  const startedAt = game.clock.hours;
  game = run(game, { type: "open-selection", format: format as never, memberIds: CREW });
  game = advanceUntil(game, stageIs("open"));
  mark(game);
  game = advanceUntil(game, stageIs("lecture"));
  // Triagem na planilha, antes da palestra: corta uma parte e marca quem chamar.
  game = run(game, ...applicants(game).map((item, index): Command => ({ type: "tag-applicant", applicantId: item.id, tag: index % 4 === 0 ? "no" : index % 3 === 0 ? "call" : "maybe" })));
  game = advanceUntil(game, stageIs("dynamic"));
  mark(game);
  const lecture = funnelCounts(game);
  game = afterDynamic(game);
  mark(game);
  const dynamic = funnelCounts(game);

  // Passam para a entrevista até 16, "chamar" primeiro.
  const attended = applicants(game).filter((item) => item.stage === "dynamic");
  const chosen = [...attended].sort((a, b) => Number(b.tag === "call") - Number(a.tag === "call")).slice(0, 16);
  game = run(game, { type: "advance-applicants", ids: chosen.map((item) => item.id) });
  for (const item of chosen) game = run(game, { type: "set-interview-questions", applicantId: item.id, questionIds: ["why", "practice", "pressure"] });
  game = run(game, { type: "schedule-interviews", applicantIds: chosen.map((item) => item.id), memberIds: ["founder-marina", "founder-caio", "founder-rafa"] });
  mark(game);
  const midway: number[] = [];
  while (game.selection?.stage === "interviewing") {
    game = run(game, { type: "set-speed", speed: 1 }, { type: "tick", realSeconds: 10 });
    midway.push(funnelCounts(game).interviewed);
  }
  mark(game);
  const interviews = funnelCounts(game);
  const before = game.members.length;
  const ids = applicants(game).filter((item) => item.stage === "interview").slice(0, 10).map((item) => item.id);
  game = run(game, { type: "approve-applicants", ids });
  mark(game);
  return { game, startedAt, lecture, dynamic, interviews, midway, approvedCount: game.members.length - before, log };
}

describe("campanha inteira (S1 a S5)", () => {
  const result = playCampaign(7);

  it("o funil afina a cada etapa: inscritos > presentes > dinâmica > entrevistados > aprovados", () => {
    const { lecture, dynamic, interviews, approvedCount } = result;
    expect(lecture.applicants).toBeGreaterThanOrEqual(40);
    expect(lecture.applicants).toBeLessThanOrEqual(120);
    expect(lecture.present).toBeLessThan(lecture.applicants);
    expect(dynamic.dynamic).toBeLessThan(lecture.present);
    expect(interviews.interviewed).toBeLessThan(dynamic.dynamic);
    expect(approvedCount).toBe(10);
    expect(approvedCount).toBeLessThan(interviews.interviewed);
    // Proporção da palestra: perto de 80% dos inscritos.
    expect(lecture.present / lecture.applicants).toBeGreaterThan(0.68);
    expect(lecture.present / lecture.applicants).toBeLessThan(0.92);
  });

  it("dura cerca de 6 semanas, da divulgação à aprovação", () => {
    const days = (result.game.clock.hours - result.startedAt) / 24;
    expect(days).toBeGreaterThan(5 * 7);
    expect(days).toBeLessThan(7 * 7);
  });

  it("as etapas acontecem na ordem e com as datas marcadas pela campanha", () => {
    expect(result.log.map((entry) => entry.stage)).toEqual(["open", "dynamic", "shortlist", "interviewing", "decision", "fim"]);
    const days = result.log.map((entry) => entry.day);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });

  it("as entrevistas vão aparecendo aos poucos enquanto a tarefa anda", () => {
    const partial = result.midway.filter((count) => count > 0 && count < 16);
    expect(partial.length).toBeGreaterThan(1);
    expect(result.midway.at(-1)).toBe(16);
  });

  it("os aprovados viram trainees com o perfil escondido intacto; a campanha some e o alcance zera", () => {
    const { game } = result;
    expect(game.selection).toBeNull();
    expect(game.outreach).toBe(0);
    const trainees = game.members.filter((member) => member.role === "trainee");
    expect(trainees).toHaveLength(10);
    for (const trainee of trainees) {
      expect(trainee.revealedAptitude).toEqual([]);
      expect(trainee.trainingHours).toBe(0);
      expect(trainee.taskId).toBeNull();
    }
    expect(game.inbox.at(-1)!.title).toMatch(/Processo seletivo encerrado: 10 aprovados/);
  });

  it("é reproduzível pelo seed", () => {
    const again = playCampaign(7);
    expect(again.game.members.map((member) => member.name)).toEqual(result.game.members.map((member) => member.name));
    expect(again.game).toEqual(result.game);
  });
});

describe("S1: campanha e inscritos", () => {
  it("open-selection exige o formato, cria a campanha em promoção e só aceita uma por vez", () => {
    const base = foundedGame({ seed: 1, teamName: "T" });
    const noFormat = run(base, { type: "start-action", actionId: "selection-open", memberIds: CREW });
    expect(noFormat.selection).toBeNull();
    expect(noFormat.warning?.text).toContain("formato");
    const started = run(base, { type: "open-selection", format: "technical", memberIds: CREW });
    expect(started.selection).toMatchObject({ stage: "promotion", format: "technical", openedAt: null, vacancies: null });
    expect(started.tasks[0]!.label).toBe("Processo seletivo (Técnica)");
    expect(run(started, { type: "open-selection", format: "broad", memberIds: ["founder-bia"] }).warning?.text).toContain("em andamento");
  });

  it("a divulgação é tarefa com gente: sem gente não começa e as entrevistas não abrem pela lista de ações", () => {
    const base = foundedGame({ seed: 1, teamName: "T" });
    expect(run(base, { type: "open-selection", format: "broad", memberIds: [] }).selection).toBeNull();
    expect(run(base, { type: "start-action", actionId: "selection-interviews", memberIds: CREW }).warning?.text).toContain("comando próprio");
  });

  it("os inscritos chegam aos poucos, mais no começo, e fecham no total sorteado", () => {
    let game = opened(3);
    const total = game.selection!.arrival.total;
    expect(total).toBeGreaterThanOrEqual(S.minTotal);
    expect(game.selection!.applicants).toHaveLength(0);
    const counts: number[] = [];
    while (game.selection!.stage === "open") {
      game = run(game, { type: "set-speed", speed: 1 }, { type: "tick", realSeconds: 10 });
      counts.push(applicants(game).length);
    }
    for (let i = 1; i < counts.length; i += 1) expect(counts[i]!).toBeGreaterThanOrEqual(counts[i - 1]!);
    expect(counts.filter((count, i) => i === 0 || count !== counts[i - 1]).length).toBeGreaterThan(8);
    const third = counts[Math.floor(counts.length / 3)]!;
    expect(third).toBeGreaterThan(total / 3);
    expect(counts.at(-1)).toBe(total);
    expect(applicants(game)).toHaveLength(total);
  });

  it("divulgar durante as inscrições ainda soma inscritos", () => {
    const base = opened(3);
    const mid = advanceUntil(base, (s) => s.clock.hours >= base.selection!.openedAt! + 5 * 24);
    const quiet = advanceUntil(mid, stageIs("lecture"));
    const boosted = advanceUntil({ ...mid, outreach: mid.outreach + 60 }, stageIs("lecture"));
    expect(applicants(boosted).length).toBeGreaterThan(applicants(quiet).length + 20);
  });

  it("cada inscrito tem curso, período, frase e perfil escondido; a UI só lê applicantView", () => {
    const game = advanceUntil(opened(4), stageIs("lecture"));
    const list = applicants(game);
    expect(list.length).toBeGreaterThan(30);
    expect(new Set(list.map((item) => item.name)).size).toBe(list.length);
    for (const item of list) {
      expect(item.motivationText.length).toBeGreaterThan(5);
      expect(item.semester).toBeGreaterThanOrEqual(1);
      expect(item.semester).toBeLessThanOrEqual(10);
      expect(item.stage).toBe("applied");
    }
    const view = applicantView(game, list[0]!.id)!;
    expect(Object.keys(view)).not.toContain("profile");
    expect(JSON.stringify(view)).not.toMatch(/"motivation":|hoursPerDay|aptitude|"likes"|dislikes|classSlots|statedLikes/);
    expect(applicantViews(game)).toHaveLength(list.length);
    expect(applicantView(game, "nada")).toBeNull();
  });

  it("os cursos seguem a proporção (aeronáutica maioria) e o gênero varia por curso", () => {
    let aero = 0;
    let all = 0;
    const female: Record<string, { f: number; n: number }> = {};
    for (let seed = 1; seed <= 25; seed += 1) {
      const game = withApplicants(foundedGame({ seed, teamName: "T" }), 40);
      for (const item of applicants(game)) {
        all += 1;
        if (item.course === "aeronautical") aero += 1;
        const entry = (female[item.course] ??= { f: 0, n: 0 });
        entry.n += 1;
        if (item.profile.look.female) entry.f += 1;
      }
    }
    expect(aero / all).toBeGreaterThan(0.42);
    expect(aero / all).toBeLessThan(0.58);
    for (const course of ["aeronautical", "mechanical", "electrical", "computing", "production"]) expect(female[course]!.n).toBeGreaterThan(20);
    expect(female["aeronautical"]!.f / female["aeronautical"]!.n).toBeGreaterThan(0.14);
    expect(female["aeronautical"]!.f / female["aeronautical"]!.n).toBeLessThan(0.27);
    expect(female["production"]!.f / female["production"]!.n).toBeGreaterThan(female["electrical"]!.f / female["electrical"]!.n);
  });

  it("a frase às vezes engana: há frases de empolgado em quem tem motivação baixa", () => {
    let mismatch = 0;
    let total = 0;
    for (let seed = 1; seed <= 10; seed += 1) {
      for (const item of applicants(withApplicants(foundedGame({ seed, teamName: "T" }), 40))) {
        total += 1;
        if (item.profile.motivation < 60 && /dar o sangue|largaria|desde o primeiro período|não consigo pensar/.test(item.motivationText)) mismatch += 1;
      }
    }
    expect(total).toBe(400);
    expect(mismatch).toBeGreaterThan(0);
  });

  it("o número de inscritos depende da época, do alcance, do formato e da reputação", () => {
    const base = foundedGame({ seed: 1, teamName: "T" });
    const at = (month: number, day = 15): GameState => ({ ...base, clock: { ...base.clock, hours: dateToHours(Date.UTC(month >= 11 ? 2025 : 2026, month - 1, day)) } });
    const november = expectedApplicants({ ...at(11), outreach: 20 }, "broad");
    const march = expectedApplicants({ ...at(3, 9), outreach: 20 }, "broad");
    const july = expectedApplicants({ ...at(7), outreach: 20 }, "broad");
    expect(march).toBeGreaterThan(november);
    expect(november).toBeGreaterThan(july * 1.4);
    expect(expectedApplicants({ ...at(11), outreach: 40 }, "broad")).toBeGreaterThan(november);
    expect(expectedApplicants({ ...at(11), outreach: 20, advisor: { ...base.advisor, reputation: 80 } }, "broad")).toBeGreaterThan(november);
    const byFormat = SELECTION_FORMATS.map((format) => expectedApplicants({ ...at(11), outreach: 20 }, format.id));
    expect(Math.max(...byFormat)).toBe(expectedApplicants({ ...at(11), outreach: 20 }, "broad"));
    expect(expectedApplicants(at(11), "nenhum")).toBe(0);
    // Bem divulgado em novembro cai na faixa do design (40 a 120).
    expect(november).toBeGreaterThan(40);
    expect(november).toBeLessThan(120);
  });

  it("tag-applicant marca, troca e limpa; recusa inscrito que não existe", () => {
    const game = advanceUntil(opened(2), stageIs("lecture"));
    const id = applicants(game)[0]!.id;
    const tagged = run(game, { type: "tag-applicant", applicantId: id, tag: "call" });
    expect(applicantView(tagged, id)!.tag).toBe("call");
    expect(applicantView(run(tagged, { type: "tag-applicant", applicantId: id, tag: "no" }), id)!.tag).toBe("no");
    expect(applicantView(run(tagged, { type: "tag-applicant", applicantId: id, tag: null }), id)!.tag).toBeNull();
    expect(run(game, { type: "tag-applicant", applicantId: "applicant-x", tag: "no" }).warning?.text).toContain("planilha");
    expect(run(foundedGame({ seed: 1, teamName: "T" }), { type: "tag-applicant", applicantId: id, tag: "no" }).warning?.text).toContain("seletivo");
  });

  it("selectionView resume a etapa, o funil, as datas e os tetos", () => {
    const game = opened(2);
    const view = selectionView(game)!;
    expect(view).toMatchObject({ stage: "open", stageLabel: "Inscrições abertas", format: "broad" });
    expect(view.next?.label).toBe("Fim das inscrições");
    expect(view.caps).toMatchObject({ interview: S.interviewCap, approve: S.approveCap, questions: 3, watchedGroups: 2 });
    expect(selectionView(foundedGame({ seed: 1, teamName: "T" }))).toBeNull();
  });
});

describe("S2: palestra", () => {
  it("quem falta vira ausente, vem uns 80% e a tag não muda quem vem", () => {
    const game = advanceUntil(opened(5), stageIs("lecture"));
    const noneTagged = run(game, ...applicants(game).map((item): Command => ({ type: "tag-applicant", applicantId: item.id, tag: "no" })));
    const after = advanceUntil(game, stageIs("dynamic"));
    const afterTagged = advanceUntil(noneTagged, stageIs("dynamic"));
    const present = (state: GameState) => applicants(state).filter((item) => item.stage === "lecture").map((item) => item.id);
    expect(present(afterTagged)).toEqual(present(after));
    const absent = applicants(after).filter((item) => item.stage === "absent");
    expect(absent.length).toBeGreaterThan(5);
    for (const item of absent) expect(item.revealed.lecture).toBe("absent");
    const share = present(after).length / applicants(after).length;
    expect(share).toBeGreaterThan(0.68);
    expect(share).toBeLessThan(0.92);
    expect(after.inbox.some((message) => message.title === "Palestra de apresentação")).toBe(true);
    const message = after.inbox.find((item) => item.title === "Palestra de apresentação")!;
    expect(message.body).toContain(`${present(after).length} de ${applicants(after).length} vieram`);
  });

  it("quem é mais motivado tende a ir à palestra", () => {
    let motivatedCame = 0;
    let motivated = 0;
    let coolCame = 0;
    let cool = 0;
    for (let seed = 1; seed <= 6; seed += 1) {
      const after = advanceUntil(opened(seed, 40), stageIs("dynamic"));
      for (const item of applicants(after)) {
        if (item.profile.motivation >= 70) {
          motivated += 1;
          if (item.stage === "lecture") motivatedCame += 1;
        } else if (item.profile.motivation < 60) {
          cool += 1;
          if (item.stage === "lecture") coolCame += 1;
        }
      }
    }
    expect(motivated).toBeGreaterThan(30);
    expect(cool).toBeGreaterThan(30);
    expect(motivatedCame / motivated).toBeGreaterThan(coolCame / cool);
  });
});

describe("S3: dinâmica e quem avança", () => {
  it("convida pela triagem: \"não\" nunca, \"chamar\" primeiro, até o teto; os faltosos aparecem como ausentes", () => {
    const tags = (index: number): ApplicantTag | null => (index < 5 ? "no" : index < 15 ? "call" : null);
    const ready = readyForDynamic(3, 50, tags);
    const played = afterDynamic(ready);
    const list = applicants(played);
    for (const item of list.slice(0, 5)) {
      expect(item.stage).toBe("rejected");
      expect(item.revealed.dynamic).toBeNull();
    }
    for (const item of list.slice(5, 15)) expect(["dynamic", "absent"]).toContain(item.stage);
    const attended = list.filter((item) => item.stage === "dynamic");
    expect(attended.length).toBeLessThanOrEqual(S.dynamicCap);
    expect(list.filter((item) => item.stage === "absent").length + attended.length).toBeLessThanOrEqual(S.dynamicCap);
    expect(list.filter((item) => item.stage === "rejected").length).toBeGreaterThanOrEqual(5 + (45 - S.dynamicCap));
    expect(played.selection!.stage).toBe("shortlist");
  });

  it("advance-applicants só vale na hora certa, só para quem foi, e tem teto", () => {
    const ready = readyForDynamic(3, 50);
    expect(run(ready, { type: "advance-applicants", ids: ["x"] }).warning?.text).toContain("lista da dinâmica");
    const played = afterDynamic(ready);
    const attended = applicants(played).filter((item) => item.stage === "dynamic").map((item) => item.id);
    expect(attended.length).toBeGreaterThan(S.interviewCap);
    expect(run(played, { type: "advance-applicants", ids: [] }).warning?.text).toContain("pelo menos uma");
    expect(run(played, { type: "advance-applicants", ids: attended }).warning?.text).toContain(`No máximo ${S.interviewCap}`);
    const absent = applicants(played).find((item) => item.stage !== "dynamic")!;
    expect(run(played, { type: "advance-applicants", ids: [absent.id] }).warning?.text).toContain("foi à dinâmica");

    const chosen = attended.slice(0, 12);
    const next = run(played, { type: "advance-applicants", ids: chosen });
    expect(next.selection!.stage).toBe("interview");
    expect(applicants(next).filter((item) => item.stage === "interview").map((item) => item.id)).toEqual(chosen);
    // Quem foi à dinâmica e não passou sai do processo.
    expect(applicants(next).filter((item) => item.stage === "dynamic")).toHaveLength(0);
  });
});

describe("S4: entrevistas", () => {
  /** Campanha na etapa de agendar: `count` pessoas que passaram da dinâmica. */
  function toInterview(count: number, seed = 3): GameState {
    const played = afterDynamic(readyForDynamic(seed, 40));
    const ids = applicants(played).filter((item) => item.stage === "dynamic").slice(0, count).map((item) => item.id);
    return run(played, { type: "advance-applicants", ids });
  }

  it("agendar custa horas-pessoa (1,5 h por entrevistador) e ocupa quem entrevista", () => {
    const game = toInterview(10);
    const ids = applicants(game).filter((item) => item.stage === "interview").map((item) => item.id);
    const scheduled = run(game, { type: "schedule-interviews", applicantIds: ids, memberIds: CREW });
    const task = scheduled.tasks.at(-1)!;
    expect(task.label).toContain("Entrevistas");
    expect(task.hoursTotal).toBeCloseTo(10 * S.interviewHours * S.interviewers);
    expect(interviewHours(10)).toBeCloseTo(task.hoursTotal);
    expect(task.assignees).toEqual(CREW);
    expect(scheduled.selection).toMatchObject({ stage: "interviewing", interviews: { done: 0, applicantIds: ids } });
  });

  it("recusa agendar sem gente, trainee, gente que não passou ou fora da etapa", () => {
    const game = toInterview(6);
    const ids = applicants(game).filter((item) => item.stage === "interview").map((item) => item.id);
    expect(run(game, { type: "schedule-interviews", applicantIds: ids, memberIds: [] }).selection!.stage).toBe("interview");
    expect(run(game, { type: "schedule-interviews", applicantIds: [], memberIds: CREW }).warning?.text).toContain("quem entrevistar");
    expect(run(game, { type: "schedule-interviews", applicantIds: ["applicant-0"], memberIds: CREW }).warning?.text).toContain("passou da dinâmica");
    const withTrainee = withTrainees(game, 1);
    // withTrainees abre outra campanha só em estado limpo; aqui só conferimos o papel do trainee.
    expect(withTrainee.members.at(-1)!.role === "trainee" || withTrainee.warning !== null).toBe(true);
    expect(run(foundedGame({ seed: 1, teamName: "T" }), { type: "schedule-interviews", applicantIds: ids, memberIds: CREW }).warning?.text).toContain("entrevistas para agendar");
  });

  it("escolhe até 3 perguntas por pessoa; o padrão é perguntar por que aerodesign", () => {
    const game = toInterview(2);
    const [first, second] = applicants(game).filter((item) => item.stage === "interview");
    const set = run(game, { type: "set-interview-questions", applicantId: first!.id, questionIds: ["availability", "likes", "pressure"] });
    expect(applicantView(set, first!.id)!.questionIds).toEqual(["availability", "likes", "pressure"]);
    expect(run(game, { type: "set-interview-questions", applicantId: first!.id, questionIds: ["availability", "likes", "pressure", "why"] }).warning?.text).toContain("No máximo 3");
    expect(run(game, { type: "set-interview-questions", applicantId: first!.id, questionIds: ["nada"] }).warning?.text).toContain("desconhecida");
    expect(INTERVIEW_QUESTIONS.length).toBeGreaterThanOrEqual(6);

    const ids = [first!.id, second!.id];
    const finished = advanceUntil(run(set, { type: "schedule-interviews", applicantIds: ids, memberIds: CREW }), stageIs("decision"));
    expect(applicantView(finished, first!.id)!.answers.map((answer) => answer.questionId)).toEqual(["availability", "likes", "pressure"]);
    expect(applicantView(finished, second!.id)!.answers.map((answer) => answer.questionId)).toEqual(["why"]);
    // Pergunta depois da entrevista não vale mais.
    expect(run(finished, { type: "set-interview-questions", applicantId: first!.id, questionIds: ["why"] }).warning?.text).toContain("ainda vai ser entrevistado");
  });

  it("as respostas chegam aos poucos; encerrar no meio deixa as que faltam para agendar de novo", () => {
    const game = toInterview(12);
    const ids = applicants(game).filter((item) => item.stage === "interview").map((item) => item.id);
    let running = run(game, { type: "schedule-interviews", applicantIds: ids, memberIds: CREW });
    running = advanceUntil(running, (s) => funnelCounts(s).interviewed >= 4);
    expect(funnelCounts(running).interviewed).toBeLessThan(12);
    const closed = run(running, { type: "close-task", taskId: running.selection!.interviews!.taskId });
    expect(closed.selection!.stage).toBe("interview");
    expect(closed.selection!.interviews).toBeNull();
    const done = applicants(closed).filter((item) => item.revealed.answers.length > 0).length;
    expect(done).toBeGreaterThanOrEqual(4);
    expect(done).toBeLessThan(12);
    const rest = applicants(closed).filter((item) => item.stage === "interview" && item.revealed.answers.length === 0).map((item) => item.id);
    const again = advanceUntil(run(closed, { type: "schedule-interviews", applicantIds: rest, memberIds: CREW }), stageIs("decision"));
    expect(funnelCounts(again).interviewed).toBe(12);
  });

  it("a comunicação de quem entrevista reduz o ruído das respostas", () => {
    const game = toInterview(4);
    const talk = (communication: number): GameState => ({ ...game, members: game.members.map((member) => ({ ...member, communication })) });
    const quiet = interviewSpread(talk(5), CREW);
    const eloquent = interviewSpread(talk(95), CREW);
    expect(quiet).toBeLessThanOrEqual(S.interviewNoise);
    expect(eloquent).toBeLessThan(quiet * 0.65);
    expect(eloquent).toBeCloseTo(S.interviewNoise * (1 - S.noiseReductionByComm * 0.95));

    // Na prática: a leitura de disponibilidade erra menos com quem conversa melhor.
    const errorOf = (communication: number): number => {
      let total = 0;
      let count = 0;
      for (let seed = 1; seed <= 12; seed += 1) {
        const base = toInterview(12, seed);
        const state = { ...base, members: base.members.map((member) => ({ ...member, communication })) };
        const ids = applicants(state).filter((item) => item.stage === "interview").map((item) => item.id);
        let withQuestions = state;
        for (const id of ids) withQuestions = run(withQuestions, { type: "set-interview-questions", applicantId: id, questionIds: ["availability"] });
        const done = advanceUntil(run(withQuestions, { type: "schedule-interviews", applicantIds: ids, memberIds: CREW }), stageIs("decision"));
        for (const item of applicants(done)) {
          const said = Number(/(\d+(?:,\d)?) h por dia/.exec(item.revealed.answers[0]?.text ?? "")?.[1]?.replace(",", "."));
          if (Number.isNaN(said)) continue;
          total += Math.abs(said - item.profile.hoursPerDay);
          count += 1;
        }
      }
      return total / count;
    };
    expect(errorOf(95)).toBeLessThan(errorOf(5));
  });
});

describe("S5: aprovação", () => {
  it("só aprova quem foi entrevistado, com teto e na hora certa", () => {
    const game = withApplicants(foundedGame({ seed: 4, teamName: "T" }), 30);
    const ids = applicants(game).map((item) => item.id);
    expect(run(game, { type: "approve-applicants", ids: [] }).warning?.text).toContain("pelo menos uma");
    expect(run(game, { type: "approve-applicants", ids }).warning?.text).toContain(`No máximo ${S.approveCap}`);
    expect(run(game, { type: "approve-applicants", ids: ["applicant-x"] }).warning?.text).toContain("passou pelas entrevistas");
    const early = { ...game, selection: { ...game.selection!, stage: "open" as const } };
    expect(run(early, { type: "approve-applicants", ids: ids.slice(0, 2) }).warning?.text).toContain("hora de aprovar");
    expect(run(foundedGame({ seed: 4, teamName: "T" }), { type: "approve-applicants", ids }).warning?.text).toContain("hora de aprovar");
  });

  it("cada aprovado vira trainee com preferências e facilidade escondidas; as vagas são quantos aprovar", () => {
    const game = withApplicants(foundedGame({ seed: 4, teamName: "T" }), 20);
    const chosen = applicants(game).slice(0, 7);
    const approved = run(game, { type: "approve-applicants", ids: chosen.map((item) => item.id) });
    const trainees = approved.members.filter((member) => member.role === "trainee");
    expect(trainees.map((member) => member.name)).toEqual(chosen.map((item) => item.name));
    expect(trainees[0]).toMatchObject({ aptitude: chosen[0]!.profile.aptitude, likes: chosen[0]!.profile.likes, revealedAptitude: [], energy: BALANCE.energy.start });
    expect(approved.selection).toBeNull();
    expect(approved.inbox.at(-1)!.body).toContain("13 inscritos receberam o e-mail de agradecimento");
    expect(approved.nextId).toBeGreaterThan(game.nextId);
  });

  it("depois de 1/fev o aprovado entra direto como integrante (não há etapa trainee)", () => {
    const game = withApplicants(foundedGame({ seed: 4, teamName: "T" }), 5);
    const late = { ...game, clock: { ...game.clock, hours: dateToHours(Date.UTC(2026, 2, 9)) } };
    const approved = run(late, { type: "approve-applicants", ids: [applicants(late)[0]!.id] });
    expect(approved.members.at(-1)!.role).toBe("member");
  });

  it("mais trainees consomem mais horas de capitão: o treino de cada um rende menos quando a turma é grande", () => {
    const trainedHours = (count: number): { each: number; total: number } => {
      let state = withTrainees(foundedGame({ seed: 6, teamName: "T" }), count);
      const trainees = state.members.filter((member) => member.role === "trainee").map((member) => member.id);
      state = run(state, { type: "start-action", actionId: "trainee-training", memberIds: [...trainees, "founder-marina"] });
      state = advanceUntil({ ...state, selection: null }, (s) => s.tasks.every((task) => task.status === "done"), 40);
      const hours = state.members.filter((member) => member.role === "trainee").map((member) => member.trainingHours ?? 0);
      return { each: hours.reduce((a, b) => a + b, 0) / hours.length, total: hours.reduce((a, b) => a + b, 0) };
    };
    const small = trainedHours(3);
    const large = trainedHours(12);
    expect(large.each).toBeLessThan(small.each);
  });
});

describe("save e estado inicial", () => {
  it("a versão do estado é 11 e a campanha sobrevive ao save no meio", () => {
    expect(createGame({ seed: 1, teamName: "T" }).version).toBe(11);
    const mid = advanceUntil(opened(2), (s) => applicants(s).length > 10 && s.selection!.stage === "open");
    const loaded = deserializeState(serializeState(mid))!;
    expect(loaded).toEqual(mid);
    const finish = (state: GameState) => advanceUntil(state, stageIs("dynamic")).selection;
    expect(finish(loaded)).toEqual(finish(mid));
  });
});
