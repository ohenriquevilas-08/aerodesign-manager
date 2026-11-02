// Aprovação (Fase 9, U4): as vagas são quantos você aprova. Mostra o custo em horas de treinamento e
// pede confirmação antes de enviar os e-mails.

import { useState } from "preact/hooks";
import { store } from "../../app/store";
import type { ApplicantView } from "../../sim";
import { useGame } from "../../app/useGame";
import { ApplicantSheet } from "./ApplicantSheet";
import { trainingCost } from "./model";

export function Approval({ rows, cap }: { rows: ApplicantView[]; cap: number }) {
  const interviewed = rows.filter((row) => row.stage === "interview");
  const now = useGame((state) => state.clock.hours);
  const [chosen, setChosen] = useState<string[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const current = interviewed.find((row) => row.id === focus) ?? interviewed[0];
  const cost = trainingCost(chosen.length, now);
  const toggle = (id: string) => {
    setConfirming(false);
    setChosen(chosen.includes(id) ? chosen.filter((item) => item !== id) : chosen.length < cap ? [...chosen, id] : chosen);
  };

  return (
    <section class="panel selection-stage">
      <h2 class="panel-title">
        Aprovação <span class="panel-count">{chosen.length}/{cap} vagas</span>
      </h2>
      <p class="muted small selection-hint">
        {interviewed.length} entrevistados. As vagas de trainee são quantas você aprovar; cada trainee a mais divide as horas dos capitães.
      </p>
      <div class="selection-split">
        <ul class="pick-list" aria-label="Entrevistados">
          {interviewed.map((row) => (
            <li key={row.id} class={`pick-row${current?.id === row.id ? " is-focus" : ""}`}>
              <label>
                <input type="checkbox" checked={chosen.includes(row.id)} onChange={() => toggle(row.id)} />
                <button type="button" class="pick-name" onClick={() => setFocus(row.id)}>
                  {row.name}
                  <small>
                    {row.courseLabel} · {row.answers.length} {row.answers.length === 1 ? "resposta" : "respostas"}
                  </small>
                </button>
              </label>
              {row.tag ? <span class={`tag-dot tag-${row.tag}`} title="Sua marca na planilha" /> : null}
            </li>
          ))}
        </ul>
        {current ? <ApplicantSheet view={current} showTags={false} /> : null}
      </div>

      <footer class="approval-cost">
        <div class="approval-cost-numbers" aria-live="polite">
          <span class="stat">
            <span class="stat-label">Trainees</span>
            <strong>{cost.trainees}</strong>
          </span>
          <span class="stat">
            <span class="stat-label">Treino de cada um</span>
            <strong class="text-hours">⏱ {cost.hoursEach} h</strong>
          </span>
          <span class="stat">
            <span class="stat-label">Total de treinamento</span>
            <strong class="text-hours">⏱ {cost.totalHours} h-pessoa</strong>
          </span>
          <span class="stat">
            <span class="stat-label">Sessões de 8 h</span>
            <strong>{cost.sessions}</strong>
          </span>
        </div>
        <p class="muted small">
          {cost.daysLeft > 0
            ? `A etapa trainee acaba em 1/fev (${cost.daysLeft} dias). Sem capitão no treino, só metade das horas rende, e 30% a 50% costumam desistir.`
            : "A etapa trainee já acabou: os aprovados entram direto como integrantes."}
        </p>
        {confirming ? (
          <div class="confirm-row" role="alertdialog" aria-label="Confirmar aprovação">
            <span>
              Aprovar {chosen.length} e dispensar os outros {Math.max(0, rows.length - chosen.length)} inscritos? Os e-mails saem agora.
            </span>
            <button type="button" class="btn-primary" onClick={() => store.dispatch({ type: "approve-applicants", ids: chosen })}>
              Confirmar e enviar
            </button>
            <button type="button" class="btn-ghost" onClick={() => setConfirming(false)}>
              Voltar
            </button>
          </div>
        ) : (
          <button type="button" class="btn-primary" disabled={chosen.length === 0} onClick={() => setConfirming(true)}>
            Revisar aprovação de {chosen.length}
          </button>
        )}
      </footer>
    </section>
  );
}
