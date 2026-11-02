// Triagem com o presidente (fase-9.md, ajustes do playtest): "Enviar avaliação ao presidente" fecha a
// triagem de uma etapa (a palestra e a dinâmica só abrem depois dela). Quem está marcado "chamar" ou
// "talvez" segue. O presidente (NPC) devolve um parecer curto, pela agenda dele, e pode discordar de 1
// ou 2 nomes, com o motivo; o jogador aceita (a marca muda) ou mantém a sua.

import { BALANCE } from "./content/balance";
import { drawer } from "./eventCore";
import { addMessage, warn } from "./tasks";
import type { Applicant, ApplicantStage, ApplicantTag, GameState, Member, PresidentAgenda, SelectionCampaign, TriageDisagreement, TriageGate, TriageReview } from "./types";

const T = BALANCE.selection.triage;

/** Quem a etapa avalia: antes da palestra os inscritos; antes da dinâmica, quem veio. */
const GATE_POOL: Record<TriageGate, ApplicantStage> = { lecture: "applied", dynamic: "lecture" };

/** A triagem que a campanha pede agora (null = nenhuma). */
export function triageGateOf(campaign: Pick<SelectionCampaign, "stage"> | null): TriageGate | null {
  return campaign?.stage === "lecture" || campaign?.stage === "dynamic" ? campaign.stage : null;
}

export const triageSent = (campaign: SelectionCampaign, gate: TriageGate): boolean => campaign.triage.sent.includes(gate);

const president = (state: GameState): Member | undefined => state.members.find((member) => member.role === "president");

/** O palpite do presidente sobre o inscrito, 0–100, pelo que a agenda dele valoriza. */
function gutScore(agenda: PresidentAgenda, applicant: Applicant): number {
  const p = applicant.profile;
  const know = p.knowledge[p.focus];
  switch (agenda) {
    case "report":
      return know * 0.5 + p.motivation * 0.3 + p.communication * 0.2;
    case "flight":
      return p.fabrication * 0.4 + p.agility * 0.3 + p.motivation * 0.3;
    case "funding":
      return p.communication * 0.5 + p.motivation * 0.3 + know * 0.2;
    default:
      return (know + p.fabrication + p.agility + p.communication + p.motivation) / 5;
  }
}

const AGENDA_VOICE: Record<PresidentAgenda, { opinion: string; low: string; high: string }> = {
  report: {
    opinion: "Eu olhei o que cada um sabe e a vontade de escrever e estudar.",
    low: "Parece fraco no que precisamos para o relatório.",
    high: "Me pareceu ter base boa para o relatório."
  },
  flight: {
    opinion: "Eu olhei quem tem mão na oficina e jeito para pôr o avião no ar.",
    low: "Não tem a mão de oficina que eu esperava para o voo.",
    high: "Tem jeito de oficina e de campo, serve ao voo."
  },
  funding: {
    opinion: "Eu olhei quem conversa bem e vai ajudar a levantar caixa e gente.",
    low: "Fala pouco e não vai ajudar na captação.",
    high: "Conversa bem, vai ajudar com patrocínio e divulgação."
  },
  balanced: {
    opinion: "Eu olhei o conjunto: conhecimento, mão na oficina, conversa e vontade.",
    low: "No conjunto ficou abaixo do resto da turma.",
    high: "No conjunto ficou acima do resto da turma."
  }
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)]!;
};

/** Envia a triagem da etapa atual: o presidente avalia e devolve o parecer (mensagem + `triage.review`). */
export function sendTriage(state: GameState): GameState {
  const campaign = state.selection;
  const gate = triageGateOf(campaign);
  if (!campaign || !gate) return warn(state, "A triagem só se envia depois de fechadas as inscrições, antes da palestra e da dinâmica.");
  if (triageSent(campaign, gate)) return warn(state, "A triagem desta etapa já foi enviada.");

  const chief = president(state);
  const agenda: PresidentAgenda = chief?.agenda ?? "balanced";
  const voice = AGENDA_VOICE[agenda];
  const pool = campaign.applicants.filter((item) => item.stage === GATE_POOL[gate]);
  const rng = drawer(state);
  const scored = pool.map((item) => ({ item, score: gutScore(agenda, item) + (rng.roll() * 2 - 1) * T.noise }));
  const mid = median(scored.map((entry) => entry.score));

  const proposals: (TriageDisagreement & { gap: number })[] = [];
  for (const { item, score } of scored) {
    if (item.tag === "call" && score < mid - T.gapDown) {
      proposals.push({ applicantId: item.id, suggested: score < mid - 2 * T.gapDown ? "no" : "maybe", reason: voice.low, accepted: null, gap: mid - score });
    } else if (item.tag === "no" && score > mid + T.gapUp) {
      proposals.push({ applicantId: item.id, suggested: "maybe", reason: voice.high, accepted: null, gap: score - mid });
    }
  }
  const disagreements: TriageDisagreement[] = proposals
    .sort((a, b) => b.gap - a.gap)
    .slice(0, T.maxDisagreements)
    .map(({ gap: _gap, ...rest }) => rest);

  const goes = pool.filter((item) => item.tag !== "no").length;
  const out = pool.length - goes;
  const opinion = `${voice.opinion} Seguem ${goes} e ficam ${out} de fora. ${
    disagreements.length === 0 ? "Concordo com as suas marcas." : `Discordo de ${disagreements.length === 1 ? "1 nome" : `${disagreements.length} nomes`}; os motivos estão na planilha.`
  }`;
  const review: TriageReview = { gate, opinion, disagreements };

  let next = rng.commit(state);
  next = { ...next, selection: { ...campaign, triage: { ...campaign.triage, sent: [...campaign.triage.sent, gate], review } } };
  return addMessage(next, { from: chief?.name ?? "Presidente", title: "Parecer da triagem", body: opinion }).state;
}

/** Aceita ou mantém a discordância do presidente sobre um nome. */
export function answerTriage(state: GameState, applicantId: string, accept: boolean): GameState {
  const campaign = state.selection;
  const review = campaign?.triage.review;
  const item = review?.disagreements.find((entry) => entry.applicantId === applicantId);
  if (!campaign || !review || !item) return warn(state, "O presidente não discordou desse nome.");
  if (item.accepted !== null) return state;
  const tag: ApplicantTag = item.suggested;
  const applicants = campaign.applicants.map((applicant) => (accept && applicant.id === applicantId ? { ...applicant, tag } : applicant));
  const disagreements = review.disagreements.map((entry) => (entry.applicantId === applicantId ? { ...entry, accepted: accept } : entry));
  return { ...state, selection: { ...campaign, applicants, triage: { ...campaign.triage, review: { ...review, disagreements } } } };
}

/** Avisa uma vez por etapa que falta enviar a triagem; devolve a mensagem para pausar (ou null). */
export function nagTriage(state: GameState, gate: TriageGate): { state: GameState; messageId: string | null } {
  const campaign = state.selection!;
  if (campaign.triage.nagged.includes(gate)) return { state, messageId: null };
  const next: GameState = { ...state, selection: { ...campaign, triage: { ...campaign.triage, nagged: [...campaign.triage.nagged, gate] } } };
  const added = addMessage(next, {
    from: "Equipe",
    title: gate === "lecture" ? "A palestra espera a triagem" : "A dinâmica espera a triagem",
    body: "Marque a planilha e envie a avaliação ao presidente. Enquanto isso, a próxima etapa não abre."
  });
  return { state: added.state, messageId: added.id };
}
