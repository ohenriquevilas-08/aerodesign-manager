// Aba "Seletiva" da Equipe (Fase 9, U2): o funil desenhado com as contagens por etapa, a próxima
// data e o botão da ação de cada etapa (abrir, rever a palestra, avançar para a entrevista, agendar
// entrevistas, aprovar). Entrevistas e aprovação ficam em src/ui/selection/.

import { useMemo, useState } from "preact/hooks";
import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import { applicantViews, expectedApplicants, selectionView, selectionWindow, SELECTION_FORMATS, type SelectionFormat, type SelectionView } from "../../sim";
import { useDerived } from "../hooks";
import { navigate } from "../nav";
import { Approval } from "../selection/Approval";
import { Funnel } from "../selection/Funnel";
import { Interviews } from "../selection/Interviews";
import { openLecture } from "../selection/LectureOverlay";
import { CAMPAIGN_STEPS, campaignStepIndex, dateLabel, funnelSteps, inDays } from "../selection/model";
import { Shortlist } from "../selection/Shortlist";
import { openSite } from "../screens/Browser";
import { FORMS_SITE } from "../browser/sites";

export function Selection() {
  const campaign = useGame((state) => state.selection);
  const now = useGame((state) => Math.floor(state.clock.hours));
  const view = useMemo(() => selectionView({ selection: campaign }), [campaign]);
  const rows = useMemo(() => applicantViews({ selection: campaign }), [campaign]);
  if (!view) return <OpenCampaign />;

  const steps = funnelSteps(view.counts, rows, view.stage);
  const current = campaignStepIndex(view.stage);
  const openSheet = () => {
    openSite(FORMS_SITE);
    navigate("browser");
  };

  return (
    <div class="selection-tab">
      <section class="panel selection-overview">
        <h2 class="panel-title">
          Processo seletivo <span class="panel-count">{view.stageLabel}</span>
        </h2>
        <div class="panel-body selection-overview-body">
          <div>
            <ol class="campaign-steps" aria-label="Etapas da seletiva">
              {CAMPAIGN_STEPS.map((step, index) => (
                <li key={step.label} class={index < current ? "is-done" : index === current ? "is-current" : ""} aria-current={index === current ? "step" : undefined}>
                  {step.label}
                </li>
              ))}
            </ol>
            <NextStep view={view} now={now} />
            <div class="selection-buttons">
              {view.stage !== "promotion" ? (
                <button type="button" class="btn-primary" onClick={openSheet}>
                  Abrir a planilha no Navegador
                </button>
              ) : (
                <button type="button" class="btn-ghost" onClick={() => navigate("actions")}>
                  Ver a tarefa de divulgação
                </button>
              )}
              {rows.some((row) => row.lecture !== null) ? (
                <button type="button" class="btn-ghost" onClick={openLecture}>
                  Rever a palestra
                </button>
              ) : null}
              {view.stage === "open" ? (
                <button type="button" class="btn-ghost" onClick={() => navigate("actions")}>
                  Divulgar mais (Ações)
                </button>
              ) : null}
            </div>
          </div>
          <Funnel steps={steps} />
        </div>
      </section>

      {view.stage === "shortlist" ? <Shortlist rows={rows} cap={view.caps.interview} /> : null}
      {view.stage === "interview" || view.stage === "interviewing" ? <Interviews rows={rows} running={view.stage === "interviewing"} /> : null}
      {view.stage === "decision" ? <Approval rows={rows} cap={view.caps.approve} /> : null}
    </div>
  );
}

/** O que a campanha espera agora e quando, em uma frase. */
function NextStep({ view, now }: { view: SelectionView; now: number }) {
  const text: Record<SelectionView["stage"], string> = {
    promotion: "A equipe está divulgando. As inscrições abrem quando a tarefa termina (cerca de uma semana).",
    open: "Inscrições abertas: os inscritos chegam aos poucos, mais no começo. Triar já na planilha economiza trabalho depois.",
    lecture: "Inscrições encerradas. Use o tempo para triar a planilha. Na palestra, parte dos inscritos falta.",
    dynamic: `A palestra aconteceu (${view.counts.present} de ${view.counts.applicants} vieram). Marque "Chamar" em quem quer ver na dinâmica: até ${view.caps.dynamic} convidados, "Não" fica de fora.`,
    shortlist: "A dinâmica acabou. Escolha quem vai para a entrevista.",
    interview: "Escolha as perguntas de cada um e agende as entrevistas.",
    interviewing: "Entrevistas em andamento.",
    decision: "Entrevistas feitas. Decida quem vira trainee."
  };
  return (
    <div class="selection-next">
      <p>{text[view.stage]}</p>
      {view.next ? (
        <p class="selection-date">
          <strong>{view.next.label}</strong> · {dateLabel(view.next.at)} <span class="muted">({inDays(view.next.at, now)})</span>
        </p>
      ) : null}
    </div>
  );
}

/** Sem campanha: escolher formato e quem conduz a divulgação. */
function OpenCampaign() {
  const [format, setFormat] = useState<SelectionFormat>("broad");
  const [picked, setPicked] = useState<string[]>([]);
  const people = useDerived(
    (state) => state.members.filter((member) => member.role !== "trainee" && member.taskId === null).map((member) => ({ id: member.id, name: member.name })),
    []
  );
  const info = useDerived(
    (state) => {
      const expected = expectedApplicants(state, format);
      return { low: Math.round(expected * 0.85), high: Math.round(expected * 1.15), window: selectionWindow(state.clock.hours) };
    },
    [format]
  );
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((item) => item !== id) : [...picked, id]);
  const chosen = SELECTION_FORMATS.find((item) => item.id === format)!;

  return (
    <section class="panel selection-open">
      <h2 class="panel-title">Abrir processo seletivo</h2>
      <div class="panel-body">
        <p class="muted">
          Um processo dura cerca de seis semanas: uma semana de divulgação, três de inscrições, palestra, dinâmica, entrevistas e a aprovação. Inscrito
          não é membro: a equipe só conhece o que cada etapa revela.
        </p>
        <div class="format-cards" role="radiogroup" aria-label="Formato">
          {SELECTION_FORMATS.map((item) => (
            <button key={item.id} type="button" role="radio" aria-checked={item.id === format} class="format-card" onClick={() => setFormat(item.id)}>
              <strong>{item.label}</strong>
              <span class="muted small">{item.description}</span>
            </button>
          ))}
        </div>
        <p class="selection-estimate">
          Estimativa com este formato ({info.window.label}): <strong>{info.low} a {info.high} inscritos</strong>. A divulgação durante as inscrições ainda soma.
        </p>
        <p>
          <strong>Quem conduz a divulgação</strong> <span class="muted small">(pelo menos 1)</span>
        </p>
        <div class="stat-row selection-crew">
          {people.map((person) => (
            <label key={person.id} class="check-chip">
              <input type="checkbox" checked={picked.includes(person.id)} onChange={() => toggle(person.id)} /> {person.name}
            </label>
          ))}
        </div>
        <button type="button" class="btn-primary" disabled={picked.length === 0} onClick={() => store.dispatch({ type: "open-selection", format, memberIds: picked })}>
          Abrir seletiva {chosen.label.toLowerCase()}
        </button>
      </div>
    </section>
  );
}
