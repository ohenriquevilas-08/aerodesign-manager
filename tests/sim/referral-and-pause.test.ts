// Seletiva por indicação (design §5.2, fase-9.md) e leitura pura da pausa automática (aviso central).

import { describe, expect, it } from "vitest";
import {
  applicantViews,
  applyCommand,
  BALANCE,
  expectedApplicants,
  isReferralCampaign,
  pauseNotices,
  referralAskYield,
  referralBase,
  type Command,
  type GameState
} from "../../src/sim";
import { driveEvent, foundedGame } from "./helpers";

const run = (state: GameState, ...commands: Command[]): GameState => commands.reduce(applyCommand, state);
const CREW = ["founder-marina", "founder-caio"];
const R = BALANCE.selection.referral;

function day(state: GameState): GameState {
  return run(state, { type: "set-speed", speed: 1 }, { type: "tick", realSeconds: 10 });
}

function advanceUntil(state: GameState, done: (state: GameState) => boolean, maxDays = 90): GameState {
  let game = state;
  for (let i = 0; i < maxDays && !done(game); i += 1) game = day(game);
  if (!done(game)) throw new Error("não chegou lá");
  return game;
}

const referralOpen = (seed = 3): GameState =>
  advanceUntil(run(foundedGame({ seed, teamName: "T" }), { type: "open-selection", format: "referral", memberIds: CREW }), (s) => s.selection?.stage === "open");

describe("seletiva por indicação", () => {
  it("o total esperado vem da rede: cresce com integrantes e com a comunicação, não com o alcance", () => {
    const game = foundedGame({ seed: 1, teamName: "T" });
    const base = referralBase(game.members);
    expect(base).toBeGreaterThan(0);
    const talkative = game.members.map((m) => ({ ...m, communication: 100 }));
    const mute = game.members.map((m) => ({ ...m, communication: 0 }));
    expect(referralBase(talkative)).toBeCloseTo(game.members.length * (R.perMember + R.perCommunication));
    expect(referralBase(mute)).toBeCloseTo(game.members.length * R.perMember);
    expect(referralBase([...game.members, ...game.members])).toBeCloseTo(base * 2);
    // Alcance de divulgação não muda nada.
    const loud = expectedApplicants({ ...game, outreach: 500 }, "referral");
    const quiet = expectedApplicants({ ...game, outreach: 0 }, "referral");
    expect(loud).toBeCloseTo(quiet);
    expect(expectedApplicants({ ...game, members: talkative }, "referral")).toBeGreaterThan(expectedApplicants({ ...game, members: mute }, "referral"));
  });

  it("a divulgação geral é recusada e não soma durante a campanha por indicação", () => {
    let game = run(foundedGame({ seed: 2, teamName: "T" }), { type: "open-selection", format: "referral", memberIds: CREW });
    expect(isReferralCampaign(game)).toBe(true);
    for (const actionId of ["outreach-posters", "outreach-social", "outreach-classroom", "outreach-freshers"]) {
      const tried = run(game, { type: "start-action", actionId, memberIds: ["founder-rafa"] });
      expect(tried.tasks).toHaveLength(game.tasks.length);
      expect(tried.warning?.text).toContain("indicação");
    }
    // A própria tarefa de abertura não soma alcance.
    game = advanceUntil(game, (s) => s.selection?.stage === "open");
    expect(game.outreach).toBe(0);
  });

  it("fora de uma campanha por indicação, a divulgação geral continua valendo e 'Pedir indicações' não", () => {
    const base = foundedGame({ seed: 2, teamName: "T" });
    const poster = run(base, { type: "start-action", actionId: "outreach-posters", memberIds: ["founder-rafa"] });
    expect(poster.tasks).toHaveLength(1);
    const ask = run(base, { type: "start-action", actionId: "referral-ask", memberIds: ["founder-rafa"] });
    expect(ask.tasks).toHaveLength(0);
    expect(ask.warning?.text).toContain("indicação");
  });

  it("'Pedir indicações' só vale com as inscrições abertas, cobra horas por integrante e rende aos poucos", () => {
    const early = run(foundedGame({ seed: 4, teamName: "T" }), { type: "open-selection", format: "referral", memberIds: CREW });
    expect(run(early, { type: "start-action", actionId: "referral-ask", memberIds: ["founder-rafa"] }).warning?.text).toContain("inscrições");

    const open = referralOpen(4);
    const one = run(open, { type: "start-action", actionId: "referral-ask", memberIds: ["founder-rafa"] });
    const two = run(open, { type: "start-action", actionId: "referral-ask", memberIds: ["founder-rafa", "founder-bia"] });
    const taskOne = one.tasks.at(-1)!;
    const taskTwo = two.tasks.at(-1)!;
    expect(taskOne.hoursTotal).toBeCloseTo(R.askHoursPerMember);
    expect(taskTwo.hoursTotal).toBeCloseTo(R.askHoursPerMember * 2);
    expect(taskTwo.yieldTotal!).toBeGreaterThan(taskOne.yieldTotal!);
    expect(taskOne.yieldTotal!).toBeGreaterThan(0);

    // Resultado contínuo: a metade das horas entrega parte dos indicados, e o total soma no fim.
    const before = open.selection!.arrival.extra;
    let game = run(two, { type: "set-speed", speed: 1 });
    for (let i = 0; i < 400 && game.tasks.at(-1)!.status !== "done" && game.tasks.at(-1)!.hoursDone < taskTwo.hoursTotal / 2; i += 1) game = run(game, { type: "tick", realSeconds: 0.5 });
    expect(game.tasks.at(-1)!.hoursDone).toBeGreaterThan(0);
    expect(game.selection!.arrival.extra).toBeGreaterThan(before);
    expect(game.selection!.arrival.extra - before).toBeLessThan(taskTwo.yieldTotal! - 1e-6);
    game = advanceUntil(game, (s) => s.tasks.at(-1)!.status === "done", 30);
    expect(game.selection!.arrival.extra - before).toBeCloseTo(taskTwo.yieldTotal!, 5);
  });

  it("quem se comunica mais rende mais indicados", () => {
    const { members } = foundedGame({ seed: 1, teamName: "T" });
    const a = { ...members[0]!, communication: 10 };
    const b = { ...members[0]!, communication: 90 };
    expect(referralAskYield([b])).toBeGreaterThan(referralAskYield([a]));
  });

  it("os indicados vêm mais motivados e muitos compartilham a área de quem indicou", () => {
    const game = advanceUntil(referralOpen(7), (s) => s.selection!.stage !== "open");
    const rows = game.selection!.applicants;
    expect(rows.length).toBeGreaterThan(5);
    const motivation = rows.reduce((sum, row) => sum + row.profile.motivation, 0) / rows.length;
    expect(Math.min(...rows.map((row) => row.profile.motivation))).toBeGreaterThanOrEqual(75);
    expect(motivation).toBeGreaterThan(75);
    const withReferrer = rows.filter((row) => row.referredBy !== undefined);
    expect(withReferrer).toHaveLength(rows.length);
    const alike = withReferrer.filter((row) => {
      const referrer = game.members.find((m) => m.id === row.referredBy)!;
      const focus = referrer.statedLikes[0] ?? referrer.area;
      return focus !== null && row.profile.statedLikes[0] === focus;
    });
    // Sem a semelhança, o acaso daria bem menos que isto.
    expect(alike.length / withReferrer.length).toBeGreaterThan(R.similarity * 0.6);
    expect(applicantViews(game)[0]!.referredBy).toBe(rows[0]!.referredBy);
  });

  it("formatos que não são por indicação não ganham indicador", () => {
    let game = run(foundedGame({ seed: 5, teamName: "T" }), { type: "open-selection", format: "broad", memberIds: CREW });
    game = advanceUntil(game, (s) => s.selection?.stage === "open");
    game = day(day(game));
    expect(game.selection!.applicants.some((row) => row.referredBy !== undefined)).toBe(false);
  });
});

describe("leitura da pausa automática", () => {
  it("o aviso de tarefa concluída traz o resultado e leva à tela certa", () => {
    let game = run(foundedGame({ seed: 8, teamName: "T" }), { type: "start-action", actionId: "outreach-posters", memberIds: ["founder-rafa"] });
    game = advanceUntil(game, (s) => s.pause?.reason === "task-done", 10);
    const [notice] = pauseNotices(game);
    expect(notice!.title).toBe("Concluído: Cartazes no campus");
    expect(notice!.result).toContain("Alcance da divulgação +");
    expect(notice!.target).toBe("actions");
    expect(notice!.canResume).toBe(true);
  });

  it("vários motivos no mesmo instante ficam em fila, na ordem", () => {
    let game = run(foundedGame({ seed: 9, teamName: "T" }), { type: "set-speed", speed: 0 });
    game = run(game, { type: "start-action", actionId: "outreach-social", memberIds: ["founder-rafa"] }, { type: "start-action", actionId: "outreach-posters", memberIds: ["founder-bia"] });
    // As duas tarefas terminam no mesmo passo.
    game = {
      ...game,
      tasks: game.tasks.map((task) => ({ ...task, hoursDone: task.hoursTotal - 0.0001 })),
      clock: { ...game.clock, speed: 1 }
    };
    game = run(game, { type: "tick", realSeconds: 10 });
    expect(game.pause?.reason).toBe("task-done");
    expect(game.pause?.also).toHaveLength(1);
    const notices = pauseNotices(game);
    expect(notices.map((n) => n.title).sort()).toEqual(["Concluído: Cartazes no campus", "Concluído: Post nas redes"]);
    expect(new Set(notices.map((n) => n.messageId)).size).toBe(2);
  });

  it("início, pausa manual e evento aberto não geram aviso; seguir o tempo limpa a pausa", () => {
    const game = foundedGame({ seed: 1, teamName: "T" });
    expect(pauseNotices({ ...game, pause: { reason: "start", at: 0, messageId: null } })).toEqual([]);
    expect(pauseNotices(run(game, { type: "set-speed", speed: 0 }))).toEqual([]);
    expect(pauseNotices(run(game, { type: "set-speed", speed: 1 }))).toEqual([]);
  });

  it("sem pausa por tarefa, outros motivos apontam para a tela deles", () => {
    const game = foundedGame({ seed: 1, teamName: "T" });
    const withMessage = {
      ...game,
      inbox: [...game.inbox, { id: "m-x", at: 1, from: "Comissão Técnica", title: "Faltam 14 dias: Relatório", body: "O prazo está chegando.", read: false }],
      pause: { reason: "deadline-soon" as const, at: 1, messageId: "m-x" }
    };
    const [notice] = pauseNotices(withMessage);
    expect(notice!.target).toBe("calendar");
    expect(notice!.result).toBe("O prazo está chegando.");
  });
});

describe("palestra como evento e triagem com o presidente", () => {
  const closedInscriptions = (seed = 12): GameState => {
    let game = run(foundedGame({ seed, teamName: "T" }), { type: "open-selection", format: "broad", memberIds: CREW });
    return advanceUntil({ ...game, outreach: 40 }, (s) => s.selection?.stage === "lecture");
  };
  const tagAll = (game: GameState): GameState =>
    run(game, ...game.selection!.applicants.map((item, index): Command => ({ type: "tag-applicant", applicantId: item.id, tag: index % 3 === 0 ? "call" : index % 3 === 1 ? "maybe" : "no" })));

  it("ao fechar as inscrições a simulação pausa e lembra da triagem; sem enviar, a palestra não abre", () => {
    const game = closedInscriptions();
    expect(game.pause?.reason).toBe("triage");
    expect(pauseNotices(game)[0]!.title).toContain("falta a triagem");
    const waited = advanceUntil({ ...game, pause: null }, (s) => s.clock.hours > game.selection!.lectureAt! + 48, 10);
    expect(waited.activeEvent).toBeNull();
    expect(waited.selection!.stage).toBe("lecture");
    expect(run(waited, { type: "send-triage" }).selection!.triage.sent).toEqual(["lecture"]);
  });

  it("com a triagem enviada a palestra vira evento com decisões e fecha com o resumo", () => {
    let game = run(tagAll(closedInscriptions()), { type: "send-triage" });
    expect(run(game, { type: "send-triage" }).warning?.text).toContain("já foi enviada");
    game = advanceUntil({ ...game, pause: null }, (s) => !!s.activeEvent);
    expect(game.activeEvent!.kind).toBe("selection-lecture");
    expect(game.pause?.reason).toBe("selection-lecture");
    expect(game.selection!.stage).toBe("dynamic");
    const before = game.selection!.applicants.filter((a) => a.stage === "lecture").reduce((sum, a) => sum + a.profile.motivation, 0);
    const picks: string[] = [];
    const played = driveEvent(game, { pick: (decision) => (picks.push(decision.id), decision.options[0]!.id) }).state;
    expect(picks).toEqual(["highlight", "answer"]);
    expect(played.activeEvent!.summary!.lines.join(" ")).toContain("Clima da plateia");
    const after = played.selection!.applicants.filter((a) => a.stage === "lecture").reduce((sum, a) => sum + a.profile.motivation, 0);
    expect(after).not.toBe(before);
    const closed = run(played, { type: "close-event" });
    expect(closed.activeEvent).toBeNull();
    expect(closed.inbox.some((m) => m.title === "Palestra de apresentação")).toBe(true);
  });

  it("o presidente discorda de até 2 nomes e o jogador aceita ou mantém", () => {
    let game = run(tagAll(closedInscriptions(14)), { type: "send-triage" });
    const review = game.selection!.triage.review!;
    expect(review.gate).toBe("lecture");
    expect(review.opinion.length).toBeGreaterThan(20);
    expect(review.disagreements.length).toBeLessThanOrEqual(2);
    expect(game.inbox.some((m) => m.title === "Parecer da triagem")).toBe(true);
    for (const [index, item] of review.disagreements.entries()) {
      const tag = game.selection!.applicants.find((a) => a.id === item.applicantId)!.tag;
      game = run(game, { type: "answer-triage", applicantId: item.applicantId, accept: index === 0 });
      const now = game.selection!.applicants.find((a) => a.id === item.applicantId)!.tag;
      expect(now).toBe(index === 0 ? item.suggested : tag);
      expect(game.selection!.triage.review!.disagreements[index]!.accepted).toBe(index === 0);
      expect(item.reason.length).toBeGreaterThan(5);
    }
  });

  it("a dinâmica também espera a triagem", () => {
    let game = run(tagAll(closedInscriptions(15)), { type: "send-triage" });
    game = advanceUntil({ ...game, pause: null }, (s) => !!s.activeEvent);
    game = run(driveEvent(game).state, { type: "close-event" });
    expect(game.selection!.stage).toBe("dynamic");
    const waited = advanceUntil({ ...game, pause: null }, (s) => s.clock.hours > game.selection!.dynamicDayAt! + 24, 20);
    expect(waited.activeEvent).toBeNull();
    expect(waited.inbox.some((m) => m.title === "A dinâmica espera a triagem")).toBe(true);
    const sent = advanceUntil(run(waited, { type: "send-triage" }), (s) => !!s.activeEvent, 3);
    expect(sent.activeEvent!.kind).toBe("selection-day");
  });
});
