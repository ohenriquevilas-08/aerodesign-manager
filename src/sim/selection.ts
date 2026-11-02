// Seletiva imersiva (design §5.2; Fase 9, docs/phases/fase-9.md): a campanha de ~6 semanas.
// Divulgação e abertura (tarefa) → inscrições (chegam aos poucos) → palestra (com faltas) → dinâmica
// (evento, eventSelection.ts) → entrevistas (tarefa) → aprovação. Inscrito não é membro: o perfil
// completo fica escondido em `Applicant.profile` e a UI só lê `applicantView`.

import { findCourse, COURSES, SELECTION_FORMATS, SEMESTER_WEIGHTS, CANDIDATE_AGILITY, CANDIDATE_COMMUNICATION, CANDIDATE_GRADUATIONS, CANDIDATE_HOURS_PER_DAY, type SelectionFormat, type SelectionFormatDef } from "./content/selection";
import { hasHistory, PHRASES, phrasesFor, type PhraseKind } from "./content/applicantPhrases";
import { findQuestion, INTERVIEW_QUESTIONS } from "./content/interviewQuestions";
import { TRAINEE_END } from "./content/season2026";
import { BALANCE } from "./content/balance";
import { drawBaseKnowledge, drawPreferences } from "./aptitude";
import { drawLook } from "./looks";
import { drawPersonName } from "./naming";
import { academicFactor, clockToDate, dateToHours } from "./time";
import { nextRandom } from "./rng";
import { DISCIPLINES, zeroKnowledge } from "./state";
import { addMessage, startAction, warn } from "./tasks";
import { clamp } from "./team";
import { drawClassSlots } from "./workshop";
import type {
  Applicant,
  ApplicantProfile,
  ApplicantStage,
  ApplicantTag,
  CourseId,
  GameState,
  InterviewAnswer,
  Member,
  MemberLook,
  SelectionCampaign,
  SelectionStage
} from "./types";

const S = BALANCE.selection;

export function findSelectionFormat(id: string | null): SelectionFormatDef | undefined {
  return SELECTION_FORMATS.find((format) => format.id === id);
}

/** Sorteio sequencial a partir do rngState: `roll()` gasta um número, `state()` devolve o estado atual. */
function stream(rngState: number) {
  let rng = rngState;
  return {
    roll: () => {
      const r = nextRandom(rng);
      rng = r.state;
      return r.value;
    },
    state: () => rng,
    set: (value: number) => {
      rng = value;
    }
  };
}

// ---------------------------------------------------------------------------
// Época e número esperado de inscritos
// ---------------------------------------------------------------------------

/** Janela da temporada na data: novembro (fundação) e março (calouros) rendem; o resto, menos. */
export function selectionWindow(hours: number): { factor: number; label: string; freshers: boolean } {
  const month = new Date(clockToDate(hours)).getUTCMonth() + 1;
  const factor = S.windowFactor[month];
  if (factor === undefined) return { factor: S.offWindowFactor, label: "fora das janelas", freshers: false };
  return month === 3
    ? { factor, label: "março, com calouros", freshers: true }
    : { factor, label: "novembro, fundação", freshers: false };
}

/**
 * Inscritos esperados (antes do sorteio): base do formato × época × alcance de divulgação × reputação
 * do orientador. Fora da janela de novembro ou março rende bem menos.
 */
export function expectedApplicants(state: Pick<GameState, "clock" | "outreach" | "advisor"> & Partial<Pick<GameState, "members">>, formatId: string | null, extraOutreach = 0): number {
  const format = findSelectionFormat(formatId);
  if (!format) return 0;
  const standing = 1 + state.advisor.reputation * S.reputationScale;
  const window = selectionWindow(state.clock.hours).factor;
  // Por indicação: a rede da equipe, não o alcance de divulgação (design §5.2).
  if (format.id === "referral") return referralBase(state.members ?? []) * window * standing;
  const reach = 1 + (state.outreach + extraOutreach) * S.reachScale;
  return format.baseTotal * window * reach * standing;
}

/** Quem indica: os integrantes (trainee ainda não tem rede na universidade). */
const referrers = (members: readonly Member[]): Member[] => members.filter((member) => member.role !== "trainee");

/** Inscritos da rede da equipe: por integrante, um tanto fixo mais o que a comunicação dele traz. */
export function referralBase(members: readonly Member[]): number {
  const R = S.referral;
  return referrers(members).reduce((sum, member) => sum + R.perMember + (clamp(member.communication) / 100) * R.perCommunication, 0);
}

/** Inscritos a mais que "Pedir indicações" rende para esse grupo (antes do sorteio de qualidade). */
export function referralAskYield(members: readonly Member[]): number {
  const R = S.referral;
  return members.reduce((sum, member) => sum + R.askPerMember + (clamp(member.communication) / 100) * R.askPerCommunication, 0);
}

/** A seletiva em andamento é por indicação? (a divulgação geral não vale nela) */
export const isReferralCampaign = (state: Pick<GameState, "selection">): boolean => state.selection?.format === "referral";

// ---------------------------------------------------------------------------
// Sorteio de inscritos
// ---------------------------------------------------------------------------

function weighted<T>(items: readonly T[], weight: (item: T) => number, roll: number): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let left = roll * total;
  for (const item of items) {
    left -= weight(item);
    if (left < 0) return item;
  }
  return items[items.length - 1]!;
}

const PHRASE_KINDS = Object.keys(PHRASES) as PhraseKind[];

/** A frase tem um tipo pelo perfil escondido; 25% das vezes erra (a pista às vezes engana). */
function drawPhrase(format: SelectionFormatDef, motivation: number, history: boolean, roll: () => number): string {
  const pickOf = <T>(items: readonly T[]): T => items[Math.floor(roll() * items.length)]!;
  let kind: PhraseKind;
  if (roll() < format.referralPhrase) kind = "referral";
  else if (motivation >= 75) kind = pickOf<PhraseKind>(["eager", "eager", "builder", "flyer"]);
  else if (motivation >= 58) kind = pickOf<PhraseKind>(["curious", "builder", "flyer", "curious"]);
  else kind = pickOf<PhraseKind>(["cv", "vague", "curious", "cv"]);
  if (roll() < 0.25) kind = pickOf(PHRASE_KINDS);
  return pickOf(phrasesFor(kind, history, format.id));
}

/** Sorteia `count` inscritos novos (perfil escondido incluído); nomes não repetem ninguém. */
export function drawApplicants(state: GameState, format: SelectionFormatDef, count: number): GameState {
  if (count <= 0 || !state.selection) return state;
  const rng = stream(state.rngState);
  const { roll } = rng;
  const between = ([min, max]: readonly [number, number]) => Math.round(min + roll() * (max - min));
  const pick = <T>(items: readonly T[]): T => items[Math.floor(roll() * items.length)]!;
  const fresh = selectionWindow(state.clock.hours).freshers;
  const history = hasHistory(state);
  const weights: readonly number[] = fresh ? SEMESTER_WEIGHTS.freshers : SEMESTER_WEIGHTS.regular;
  const semesters = weights.map((_, index) => index + 1);

  const taken = new Set([...state.members.map((member) => member.name), ...state.selection.applicants.map((item) => item.name)]);
  let nextId = state.nextId;
  const drawn: Applicant[] = [];
  for (let i = 0; i < count; i += 1) {
    const course = weighted(COURSES, (item) => item.share, roll());
    const female = roll() < course.femaleShare;
    const named = drawPersonName(rng.state(), taken, female);
    rng.set(named.rngState);
    taken.add(named.name);
    const semester = weighted(semesters, (value) => weights[value - 1]!, roll());

    const base = drawBaseKnowledge(rng.state());
    rng.set(base.rngState);
    const prefs = drawPreferences(rng.state());
    rng.set(prefs.rngState);
    // Indicado: vem de um integrante e, com chance `similarity`, gosta da mesma área que ele.
    const network = format.id === "referral" ? referrers(state.members) : [];
    const referrer = network.length > 0 ? pick(network) : undefined;
    const alike = referrer !== undefined && roll() < S.referral.similarity;
    const kinFocus = alike ? (referrer.statedLikes[0] ?? referrer.area ?? undefined) : undefined;
    if (kinFocus) prefs.prefs.statedLikes = [kinFocus, ...prefs.prefs.statedLikes.filter((item) => item !== kinFocus)].slice(0, 2);
    const focus = prefs.prefs.statedLikes[0] ?? pick(DISCIPLINES);
    const knowledge = base.knowledge;
    knowledge[focus] += between(format.focusKnowledge);
    for (const discipline of DISCIPLINES) knowledge[discipline] += course.knowledge[discipline] ?? 0;
    const fabrication = clamp(between(format.fabrication) + course.fabrication);
    const classes = drawClassSlots(rng.state());
    rng.set(classes.rngState);
    const looks = drawLook(rng.state(), female);
    rng.set(looks.rngState);
    const motivation = between(format.motivation);

    const profile: ApplicantProfile = {
      focus,
      knowledge,
      fabrication,
      agility: between(CANDIDATE_AGILITY),
      communication: between(CANDIDATE_COMMUNICATION),
      motivation,
      hoursPerDay: between(CANDIDATE_HOURS_PER_DAY),
      graduation: pick(CANDIDATE_GRADUATIONS),
      statedLikes: prefs.prefs.statedLikes,
      likes: prefs.prefs.likes,
      dislikes: prefs.prefs.dislikes,
      aptitude: prefs.prefs.aptitude,
      classSlots: classes.slots,
      look: looks.look
    };
    drawn.push({
      id: `applicant-${nextId}`,
      name: named.name,
      course: course.id,
      semester,
      motivationText: drawPhrase(format, motivation, history, roll),
      stage: "applied",
      tag: null,
      notes: [],
      revealed: { lecture: null, dynamic: null, answers: [] },
      questionIds: [],
      ...(referrer ? { referredBy: referrer.id } : {}),
      profile
    });
    nextId += 1;
  }
  return {
    ...state,
    rngState: rng.state(),
    nextId,
    selection: { ...state.selection, applicants: [...state.selection.applicants, ...drawn] }
  };
}

// ---------------------------------------------------------------------------
// Etapa 1: divulgação e abertura (tarefa com gente)
// ---------------------------------------------------------------------------

const patchCampaign = (state: GameState, patch: Partial<SelectionCampaign>): GameState =>
  state.selection ? { ...state, selection: { ...state.selection, ...patch } } : state;

/** Chamado por startAction ao criar a tarefa de divulgação: nasce a campanha (uma por vez). */
export function beginCampaign(state: GameState, formatId: string | null): GameState {
  const campaign: SelectionCampaign = {
    id: `selection-${state.nextId}`,
    format: formatId ?? "broad",
    stage: "promotion",
    openedAt: null,
    closesAt: null,
    lectureAt: null,
    dynamicDayAt: null,
    applicants: [],
    vacancies: null,
    arrival: { total: 0, extra: 0, arrived: 0, outreachSeen: 0 },
    interviews: null
  };
  return { ...state, selection: campaign, nextId: state.nextId + 1 };
}

/**
 * Fim da divulgação (tarefa concluída ou encerrada): as inscrições abrem. O total é sorteado aqui a
 * partir do alcance, da época, do formato e da reputação; as datas da palestra e da dinâmica já ficam marcadas.
 */
export function openApplications(state: GameState): GameState {
  const campaign = state.selection;
  if (!campaign || campaign.stage !== "promotion") return state;
  const now = state.clock.hours;
  const rng = stream(state.rngState);
  const expected = expectedApplicants(state, campaign.format);
  const total = Math.round(clamp(expected * (1 - S.totalSpread + 2 * S.totalSpread * rng.roll()), S.minTotal, S.maxTotal));
  const openDay = Math.floor(now / 24);
  const closesAt = (openDay + S.inscriptionDays + 1) * 24;
  const lectureDay = Math.floor(closesAt / 24) + S.lectureGapDays;
  const dynamicDay = lectureDay + S.dynamicGapDays;
  const opened = patchCampaign(
    { ...state, rngState: rng.state() },
    {
      stage: "open",
      openedAt: now,
      closesAt,
      lectureAt: lectureDay * 24 + S.lectureHour,
      dynamicDayAt: dynamicDay * 24 + BALANCE.selectionDay.startHour,
      arrival: { total, extra: 0, arrived: 0, outreachSeen: state.outreach }
    }
  );
  return addMessage(opened, {
    from: "Equipe",
    title: "Inscrições abertas",
    body: `O formulário está no ar até ${dayLabel(closesAt - 1)}. Os inscritos chegam aos poucos: divulgar durante as inscrições ainda traz gente. A palestra de apresentação é ${dayLabel(lectureDay * 24)} às ${S.lectureHour}h.`
  }).state;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function dayLabel(hours: number): string {
  const date = new Date(clockToDate(hours));
  return `${date.getUTCDate()}/${MONTHS[date.getUTCMonth()]}`;
}

// ---------------------------------------------------------------------------
// Passos diários: chegada, fim das inscrições e palestra
// ---------------------------------------------------------------------------

/** Fração acumulada de inscritos no dia `elapsed` de `days` (mais gente no começo). */
export function arrivalFraction(elapsedDays: number, days: number): number {
  if (elapsedDays >= days) return 1;
  return 1 - Math.pow(1 - Math.max(0, elapsedDays) / days, S.arrivalCurve);
}

export interface SelectionStep {
  state: GameState;
  /** Mensagem que pausa o relógio (palestra); null = nada a avisar. */
  pause: { messageId: string } | null;
}

/** Roda a campanha dentro de um passo do relógio (chamado por loop.step depois de t1 já aplicado). */
export function advanceSelection(state: GameState): SelectionStep {
  let next = state;
  let pause: SelectionStep["pause"] = null;
  const campaign = next.selection;
  if (!campaign) return { state, pause };
  const now = next.clock.hours;

  if (campaign.stage === "open" && campaign.openedAt !== null && campaign.closesAt !== null) {
    // Divulgação durante as inscrições ainda soma.
    // Por indicação a divulgação geral não soma; os inscritos extras vêm de "Pedir indicações".
    const gained = campaign.format === "referral" ? 0 : Math.max(0, next.outreach - campaign.arrival.outreachSeen);
    let arrival = { ...campaign.arrival, outreachSeen: next.outreach, extra: campaign.arrival.extra + gained * S.extraPerReach };
    const days = (campaign.closesAt - campaign.openedAt) / 24;
    const elapsed = Math.floor((Math.min(now, campaign.closesAt) - campaign.openedAt) / 24);
    const closed = now >= campaign.closesAt;
    const target = closed ? arrival.total + Math.round(arrival.extra) : Math.round(arrival.total * arrivalFraction(elapsed, days) + arrival.extra);
    const fresh = Math.max(0, target - arrival.arrived);
    arrival = { ...arrival, arrived: arrival.arrived + fresh };
    next = patchCampaign(next, { arrival });
    if (fresh > 0) next = drawApplicants(next, findSelectionFormat(campaign.format)!, fresh);
    if (closed) {
      const count = next.selection!.applicants.length;
      next = patchCampaign(next, { stage: "lecture" });
      next = addMessage(next, {
        from: "Equipe",
        title: "Inscrições encerradas",
        body: `${count} ${count === 1 ? "inscrito" : "inscritos"}. A palestra de apresentação é ${dayLabel(campaign.lectureAt!)} às ${S.lectureHour}h; use o tempo para triar a planilha.`
      }).state;
    }
  }

  const current = next.selection!;
  if (current.stage === "lecture" && current.lectureAt !== null && now >= current.lectureAt) {
    const ran = runLecture(next);
    next = ran.state;
    pause = { messageId: ran.messageId };
  }
  return { state: next, pause };
}

/** Palestra de apresentação: sorteia quem veio (pela motivação escondida; a tag não importa). */
function runLecture(state: GameState): { state: GameState; messageId: string } {
  const campaign = state.selection!;
  const rng = stream(state.rngState);
  // Perto de provas (calendário acadêmico) cai um pouco.
  const exams = academicFactor(clockToDate(state.clock.hours)).label === "Provas" ? S.lectureExamPenalty : 0;
  let present = 0;
  const applicants = campaign.applicants.map((applicant): Applicant => {
    if (applicant.stage !== "applied") return applicant;
    const chance = S.lectureAttendMin + (S.lectureAttendMax - S.lectureAttendMin) * (clamp(applicant.profile.motivation) / 100) - exams;
    const came = rng.roll() < chance;
    if (came) present += 1;
    return {
      ...applicant,
      stage: came ? "lecture" : "absent",
      revealed: { ...applicant.revealed, lecture: came ? "present" : "absent" }
    };
  });
  const total = campaign.applicants.length;
  const next = patchCampaign({ ...state, rngState: rng.state() }, { applicants, stage: "dynamic" });
  const added = addMessage(next, {
    from: "Equipe",
    title: "Palestra de apresentação",
    body: `${present} de ${total} vieram. A dinâmica é ${dayLabel(campaign.dynamicDayAt!)} às ${BALANCE.selectionDay.startHour}h: marque na planilha quem você quer ver lá.`
  });
  return { state: added.state, messageId: added.id };
}

// ---------------------------------------------------------------------------
// Triagem, dinâmica e entrevistas
// ---------------------------------------------------------------------------

export function tagApplicant(state: GameState, applicantId: string, tag: ApplicantTag | null): GameState {
  const campaign = state.selection;
  if (!campaign) return warn(state, "Não há processo seletivo em andamento.");
  if (!campaign.applicants.some((item) => item.id === applicantId)) return warn(state, "Esse inscrito não está na planilha.");
  const applicants = campaign.applicants.map((item) => (item.id === applicantId ? { ...item, tag } : item));
  return patchCampaign(state, { applicants });
}

/**
 * Quem a dinâmica vai receber: tag "chamar" primeiro, depois quem não tem tag ou está em "talvez",
 * nunca "não", até BALANCE.selection.dynamicCap; alguns faltam (dynamicNoShow). Quem fica de fora
 * (tag "não" ou sem vaga) sai do processo.
 */
export function inviteToDynamic(state: GameState): { state: GameState; attendees: string[] } {
  const campaign = state.selection!;
  const rng = stream(state.rngState);
  const pool = campaign.applicants.filter((item) => item.stage === "lecture");
  const keyed = pool.map((item) => ({ item, key: rng.roll() }));
  const tier = (item: Applicant) => (item.tag === "call" ? 0 : item.tag === "no" ? 2 : 1);
  const invited = keyed
    .filter(({ item }) => tier(item) < 2)
    .sort((a, b) => tier(a.item) - tier(b.item) || a.key - b.key)
    .slice(0, S.dynamicCap)
    .map(({ item }) => item.id);
  const invitedSet = new Set(invited);
  const attendees: string[] = [];
  const result = new Map<string, ApplicantStage>();
  for (const item of pool) {
    if (!invitedSet.has(item.id)) result.set(item.id, "rejected");
    else if (rng.roll() < S.dynamicNoShow) result.set(item.id, "absent");
    else {
      result.set(item.id, "dynamic");
      attendees.push(item.id);
    }
  }
  const applicants = campaign.applicants.map((item): Applicant => {
    const stage = result.get(item.id);
    if (!stage) return item;
    const note = stage === "rejected" ? "Não foi chamado para a dinâmica." : stage === "absent" ? "Foi chamado para a dinâmica e não apareceu." : null;
    return {
      ...item,
      stage,
      revealed: { ...item.revealed, dynamic: stage === "dynamic" ? true : stage === "absent" ? false : item.revealed.dynamic },
      notes: note ? [...item.notes, note] : item.notes
    };
  });
  return { state: patchCampaign({ ...state, rngState: rng.state() }, { applicants }), attendees };
}

/** Depois da dinâmica: o jogador escolhe quem vai para a entrevista (tem teto). */
export function advanceApplicants(state: GameState, ids: readonly string[]): GameState {
  const campaign = state.selection;
  if (!campaign || campaign.stage !== "shortlist") return warn(state, "Não há lista da dinâmica para fechar agora.");
  const unique = [...new Set(ids)];
  if (unique.length === 0) return warn(state, "Escolha pelo menos uma pessoa para a entrevista.");
  if (unique.length > S.interviewCap) return warn(state, `No máximo ${S.interviewCap} pessoas passam para a entrevista.`);
  const eligible = new Set(campaign.applicants.filter((item) => item.stage === "dynamic").map((item) => item.id));
  if (unique.some((id) => !eligible.has(id))) return warn(state, "Só quem foi à dinâmica pode ir para a entrevista.");
  const chosen = new Set(unique);
  const applicants = campaign.applicants.map((item): Applicant =>
    item.stage !== "dynamic" ? item : chosen.has(item.id) ? { ...item, stage: "interview" } : { ...item, stage: "rejected" }
  );
  return patchCampaign(state, { applicants, stage: "interview" });
}

export function setInterviewQuestions(state: GameState, applicantId: string, questionIds: readonly string[]): GameState {
  const campaign = state.selection;
  const applicant = campaign?.applicants.find((item) => item.id === applicantId);
  if (!campaign || !applicant) return warn(state, "Esse inscrito não está na planilha.");
  if (applicant.stage !== "interview" || applicant.revealed.answers.length > 0) return warn(state, "Só dá para escolher as perguntas de quem ainda vai ser entrevistado.");
  const unique = [...new Set(questionIds)];
  if (unique.length > S.maxQuestions) return warn(state, `No máximo ${S.maxQuestions} perguntas por pessoa.`);
  if (unique.some((id) => !findQuestion(id))) return warn(state, "Pergunta desconhecida.");
  return patchCampaign(state, { applicants: campaign.applicants.map((item) => (item.id === applicantId ? { ...item, questionIds: unique } : item)) });
}

/** Horas-pessoa totais das entrevistas: cada uma ocupa `interviewers` pessoas por `interviewHours`. */
export const interviewHours = (count: number): number => count * S.interviewHours * S.interviewers;

export function scheduleInterviews(state: GameState, applicantIds: readonly string[], memberIds: readonly string[]): GameState {
  const campaign = state.selection;
  if (!campaign || campaign.stage !== "interview") return warn(state, "Não há entrevistas para agendar agora.");
  const ids = [...new Set(applicantIds)];
  if (ids.length === 0) return warn(state, "Escolha quem entrevistar.");
  const waiting = new Set(campaign.applicants.filter((item) => item.stage === "interview" && item.revealed.answers.length === 0).map((item) => item.id));
  if (ids.some((id) => !waiting.has(id))) return warn(state, "Só dá para agendar quem passou da dinâmica e ainda não foi entrevistado.");
  if (memberIds.some((id) => state.members.find((member) => member.id === id)?.role === "trainee")) return warn(state, "Trainee não entrevista.");

  const started = startAction(state, "selection-interviews", null, "normal", memberIds, { hours: interviewHours(ids.length), yieldTotal: ids.length });
  if (started.tasks.length === state.tasks.length) return started;
  const task = started.tasks[started.tasks.length - 1]!;
  return patchCampaign(started, {
    stage: "interviewing",
    interviews: { applicantIds: ids, memberIds: [...memberIds], taskId: task.id, done: 0 }
  });
}

/** Ruído (pontos) das respostas: cai com a comunicação média de quem entrevista. */
export function interviewSpread(state: GameState, memberIds: readonly string[]): number {
  const people = memberIds.map((id) => state.members.find((member) => member.id === id)).filter((m): m is Member => !!m);
  const communication = people.length === 0 ? 0 : people.reduce((sum, member) => sum + member.communication, 0) / people.length;
  return S.interviewNoise * (1 - S.noiseReductionByComm * (communication / 100));
}

/** A tarefa de entrevistas entregou `count` entrevistas: as respostas dessas pessoas aparecem. */
export function revealInterviews(state: GameState, count: number): GameState {
  const campaign = state.selection;
  const plan = campaign?.interviews;
  if (!campaign || !plan || count <= 0) return state;
  const rng = stream(state.rngState);
  const spread = interviewSpread(state, plan.memberIds);
  const batch = plan.applicantIds.slice(plan.done, plan.done + count);
  const byId = new Map(campaign.applicants.map((item) => [item.id, item]));
  const updated = new Map<string, Applicant>();
  for (const id of batch) {
    const applicant = byId.get(id)!;
    const questions = applicant.questionIds.length > 0 ? applicant.questionIds : ["why"];
    const answers: InterviewAnswer[] = questions.map((questionId) => ({
      questionId,
      text: findQuestion(questionId)!.answer(applicant.profile, rng.roll() * 2 - 1, spread)
    }));
    updated.set(id, { ...applicant, revealed: { ...applicant.revealed, answers } });
  }
  const applicants = campaign.applicants.map((item) => updated.get(item.id) ?? item);
  return patchCampaign({ ...state, rngState: rng.state() }, { applicants, interviews: { ...plan, done: plan.done + batch.length } });
}

/** Fim da tarefa de entrevistas (concluída ou encerrada antes): volta a escolher o que fazer a seguir. */
export function finishInterviews(state: GameState): GameState {
  const campaign = state.selection;
  if (!campaign || campaign.stage !== "interviewing") return state;
  const pending = campaign.applicants.some((item) => item.stage === "interview" && item.revealed.answers.length === 0);
  return patchCampaign(state, { stage: pending ? "interview" : "decision", interviews: null });
}

// ---------------------------------------------------------------------------
// Aprovação
// ---------------------------------------------------------------------------

function memberFrom(applicant: Applicant, id: string, now: number): Member {
  const profile = applicant.profile;
  const training = now < dateToHours(TRAINEE_END);
  return {
    id,
    name: applicant.name,
    // Quem entra pela seletiva chega como trainee e passa pela etapa (design §5.2).
    role: training ? "trainee" : "member",
    knowledge: { ...profile.knowledge },
    fabrication: profile.fabrication,
    piloting: 0,
    agility: profile.agility,
    communication: profile.communication,
    motivation: profile.motivation,
    hoursPerDay: profile.hoursPerDay,
    graduation: profile.graduation,
    taskId: null,
    energy: BALANCE.energy.start,
    statedLikes: [...profile.statedLikes],
    likes: [...profile.likes],
    dislikes: [...profile.dislikes],
    aptitude: { ...profile.aptitude },
    revealedAptitude: [],
    studyHours: zeroKnowledge(),
    classSlots: [...profile.classSlots],
    area: null,
    look: { ...profile.look },
    ...(training ? { trainingHours: 0 } : {})
  };
}

/**
 * Aprova inscritos: cada um vira trainee (o perfil escondido vira o Member; preferências reais e
 * facilidade continuam escondidas). A campanha some e os demais recebem um e-mail (só mensagem).
 */
export function approveApplicants(state: GameState, ids: readonly string[]): GameState {
  const campaign = state.selection;
  if (!campaign || (campaign.stage !== "decision" && campaign.stage !== "interview")) return warn(state, "Ainda não é hora de aprovar.");
  const unique = [...new Set(ids)];
  if (unique.length === 0) return warn(state, "Aprove pelo menos uma pessoa.");
  if (unique.length > S.approveCap) return warn(state, `No máximo ${S.approveCap} vagas de trainee.`);
  const eligible = new Set(campaign.applicants.filter((item) => item.stage === "interview").map((item) => item.id));
  if (unique.some((id) => !eligible.has(id))) return warn(state, "Só quem passou pelas entrevistas pode ser aprovado.");

  let nextId = state.nextId;
  const created: Member[] = [];
  for (const id of unique) {
    const applicant = campaign.applicants.find((item) => item.id === id)!;
    created.push(memberFrom(applicant, `member-${nextId}`, state.clock.hours));
    nextId += 1;
  }
  const rejected = campaign.applicants.length - unique.length;
  const next: GameState = { ...state, members: [...state.members, ...created], nextId, selection: null, outreach: 0 };
  const training = created[0]?.role === "trainee";
  const approved = addMessage(next, {
    from: "Equipe",
    title: `Processo seletivo encerrado: ${created.length} ${created.length === 1 ? "aprovado" : "aprovados"}`,
    body: `${created.map((member) => member.name).join(", ")} ${created.length === 1 ? "recebeu" : "receberam"} o e-mail de aprovação${training ? " e entram como trainees" : ""}. Os outros ${rejected} inscritos receberam o e-mail de agradecimento.`
  });
  return approved.state;
}

// ---------------------------------------------------------------------------
// Leituras para a UI (só o que foi revelado)
// ---------------------------------------------------------------------------

export interface ApplicantView {
  id: string;
  name: string;
  course: CourseId;
  courseLabel: string;
  semester: number;
  motivationText: string;
  stage: ApplicantStage;
  tag: ApplicantTag | null;
  notes: string[];
  lecture: "present" | "absent" | null;
  dynamic: boolean | null;
  questionIds: string[];
  answers: InterviewAnswer[];
  /** Aparência (o que qualquer um vê na palestra); não revela nada do perfil. */
  look: MemberLook;
  /** Seletiva por indicação: id de quem indicou (a equipe sabe quem trouxe). */
  referredBy?: string | null;
}

const viewOf = (applicant: Applicant): ApplicantView => ({
  referredBy: applicant.referredBy ?? null,
  id: applicant.id,
  name: applicant.name,
  course: applicant.course,
  courseLabel: findCourse(applicant.course).label,
  semester: applicant.semester,
  motivationText: applicant.motivationText,
  stage: applicant.stage,
  tag: applicant.tag,
  notes: [...applicant.notes],
  lecture: applicant.revealed.lecture,
  dynamic: applicant.revealed.dynamic,
  questionIds: [...applicant.questionIds],
  answers: applicant.revealed.answers.map((answer) => ({ ...answer })),
  look: { ...applicant.profile.look }
});

/** A ficha do inscrito: formulário, presença, anotações e respostas já reveladas; nada do perfil escondido. */
export function applicantView(state: Pick<GameState, "selection">, applicantId: string): ApplicantView | null {
  const applicant = state.selection?.applicants.find((item) => item.id === applicantId);
  return applicant ? viewOf(applicant) : null;
}

/** A planilha: todos os inscritos, na ordem de chegada. */
export function applicantViews(state: Pick<GameState, "selection">): ApplicantView[] {
  return (state.selection?.applicants ?? []).map(viewOf);
}

export interface FunnelCounts {
  applicants: number;
  present: number;
  dynamic: number;
  interviewed: number;
  /** Aprovados só existem no fim (a campanha some ao aprovar). */
  approved: number;
}

export function funnelCounts(state: Pick<GameState, "selection">): FunnelCounts {
  const list = state.selection?.applicants ?? [];
  return {
    applicants: list.length,
    present: list.filter((item) => item.revealed.lecture === "present").length,
    dynamic: list.filter((item) => item.revealed.dynamic === true).length,
    interviewed: list.filter((item) => item.revealed.answers.length > 0).length,
    approved: list.filter((item) => item.stage === "approved").length
  };
}

export const SELECTION_STAGE_LABELS: Record<SelectionStage, string> = {
  promotion: "Divulgação e abertura",
  open: "Inscrições abertas",
  lecture: "Esperando a palestra",
  dynamic: "Esperando a dinâmica",
  shortlist: "Escolher quem vai para a entrevista",
  interview: "Agendar as entrevistas",
  interviewing: "Entrevistas em andamento",
  decision: "Aprovar os trainees"
};

export interface SelectionView {
  id: string;
  format: SelectionFormat;
  stage: SelectionStage;
  stageLabel: string;
  counts: FunnelCounts;
  openedAt: number | null;
  closesAt: number | null;
  lectureAt: number | null;
  dynamicDayAt: number | null;
  /** Próxima data marcada (horas de jogo) e o que acontece nela; null quando a vez é do jogador. */
  next: { at: number; label: string } | null;
  caps: { dynamic: number; interview: number; approve: number; questions: number; watchedGroups: number };
}

export function selectionView(state: Pick<GameState, "selection">): SelectionView | null {
  const campaign = state.selection;
  if (!campaign) return null;
  let next: SelectionView["next"] = null;
  if (campaign.stage === "open" && campaign.closesAt !== null) next = { at: campaign.closesAt, label: "Fim das inscrições" };
  else if (campaign.stage === "lecture" && campaign.lectureAt !== null) next = { at: campaign.lectureAt, label: "Palestra de apresentação" };
  else if (campaign.stage === "dynamic" && campaign.dynamicDayAt !== null) next = { at: campaign.dynamicDayAt, label: "Dia da dinâmica" };
  return {
    id: campaign.id,
    format: campaign.format as SelectionFormat,
    stage: campaign.stage,
    stageLabel: SELECTION_STAGE_LABELS[campaign.stage],
    counts: funnelCounts(state),
    openedAt: campaign.openedAt,
    closesAt: campaign.closesAt,
    lectureAt: campaign.lectureAt,
    dynamicDayAt: campaign.dynamicDayAt,
    next,
    caps: { dynamic: S.dynamicCap, interview: S.interviewCap, approve: S.approveCap, questions: S.maxQuestions, watchedGroups: S.watchedGroups }
  };
}

/** As perguntas que o jogador pode escolher (id, texto e o que revelam). */
export const interviewQuestionList = () => INTERVIEW_QUESTIONS.map(({ id, label, reveals }) => ({ id, label, reveals }));

/**
 * Elenco mínimo para o projeto (design §5.2): Aerodinâmica, Estruturas e uma terceira pessoa
 * além do presidente e dos capitães. Devolve o que falta (vazio = completo).
 */
export function missingCast(state: GameState): ("aerodynamics" | "structures" | "third")[] {
  const missing: ("aerodynamics" | "structures" | "third")[] = [];
  if (!state.members.some((member) => member.knowledge.aerodynamics > 0)) missing.push("aerodynamics");
  if (!state.members.some((member) => member.knowledge.structures > 0)) missing.push("structures");
  if (!state.members.some((member) => member.role === "member" || member.role === "trainee")) missing.push("third");
  return missing;
}
