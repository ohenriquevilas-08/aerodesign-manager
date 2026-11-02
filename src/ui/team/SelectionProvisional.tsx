// PROVISÓRIO (Fase 9, S1–S5): painel mínimo para abrir a campanha da seletiva, triar a planilha e
// avançar as etapas. A planilha no Navegador, o funil na Equipe, as entrevistas e a aprovação de
// verdade são as telas U1–U4 (docs/phases/fase-9.md); isto só mantém a seletiva jogável até lá.

import { useState } from "preact/hooks";
import { store } from "../../app/store";
import { applicantViews, selectionView, SELECTION_FORMATS, type ApplicantTag, type SelectionFormat } from "../../sim";
import { useDerived } from "../hooks";

const TAG_LABEL: Record<ApplicantTag, string> = { call: "Chamar", maybe: "Talvez", no: "Não" };
const STAGE_LABEL = {
  applied: "Inscrito",
  lecture: "Na palestra",
  dynamic: "Na dinâmica",
  interview: "Entrevista",
  approved: "Aprovado",
  rejected: "Fora",
  absent: "Faltou"
} as const;

export function SelectionProvisional() {
  const view = useDerived((state) => selectionView(state), []);
  const rows = useDerived((state) => applicantViews(state), []);
  const clock = useDerived((state) => Math.floor(state.clock.hours), []);
  const people = useDerived(
    (state) => state.members.filter((member) => member.role !== "trainee" && member.taskId === null).map((member) => ({ id: member.id, name: member.name })),
    []
  );
  const [format, setFormat] = useState<SelectionFormat>("broad");
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));
  const send = store.dispatch;

  if (!view) {
    return (
      <section class="panel">
        <h2>Seletiva (provisório)</h2>
        <p>Nenhum processo seletivo em andamento. Abrir leva cerca de uma semana de divulgação; depois as inscrições ficam abertas por 3 semanas.</p>
        <label>
          Formato{" "}
          <select value={format} onChange={(event) => setFormat((event.currentTarget as HTMLSelectElement).value as SelectionFormat)}>
            {SELECTION_FORMATS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <p>Quem conduz a divulgação (pelo menos 1):</p>
        <div class="stat-row">
          {people.map((person) => (
            <label key={person.id}>
              <input type="checkbox" checked={picked.includes(person.id)} onChange={() => toggle(person.id)} /> {person.name}
            </label>
          ))}
        </div>
        <button type="button" onClick={() => send({ type: "open-selection", format, memberIds: picked })}>
          Abrir processo seletivo
        </button>
      </section>
    );
  }

  const attended = rows.filter((row) => row.stage === "dynamic");
  const interviewing = rows.filter((row) => row.stage === "interview");
  const pendingInterview = interviewing.filter((row) => row.answers.length === 0);
  return (
    <section class="panel">
      <h2>Seletiva (provisório)</h2>
      <p>
        <strong>{view.stageLabel}</strong>
        {view.next ? ` · ${view.next.label} em ${Math.max(0, Math.ceil((view.next.at - clock) / 24))} dias` : ""}
      </p>
      <div class="stat-row">
        <span class="stat">Inscritos <strong>{view.counts.applicants}</strong></span>
        <span class="stat">Presentes <strong>{view.counts.present}</strong></span>
        <span class="stat">Dinâmica <strong>{view.counts.dynamic}</strong></span>
        <span class="stat">Entrevistados <strong>{view.counts.interviewed}</strong></span>
      </div>
      {view.stage === "shortlist" ? (
        <button
          type="button"
          onClick={() =>
            send({
              type: "advance-applicants",
              ids: attended
                .filter((row) => row.tag !== "no")
                .sort((a, b) => Number(b.tag === "call") - Number(a.tag === "call"))
                .slice(0, 16)
                .map((row) => row.id)
            })
          }
        >
          Passar até 16 para a entrevista (marcados "Chamar" primeiro)
        </button>
      ) : null}
      {view.stage === "interview" && pendingInterview.length > 0 ? (
        <>
          <p>Quem entrevista (pelo menos 2):</p>
          <div class="stat-row">
            {people.map((person) => (
              <label key={person.id}>
                <input type="checkbox" checked={picked.includes(person.id)} onChange={() => toggle(person.id)} /> {person.name}
              </label>
            ))}
          </div>
          <button type="button" onClick={() => send({ type: "schedule-interviews", applicantIds: pendingInterview.map((row) => row.id), memberIds: picked })}>
            Agendar {pendingInterview.length} entrevistas
          </button>
        </>
      ) : null}
      {view.stage === "decision" || (view.stage === "interview" && pendingInterview.length === 0) ? (
        <button type="button" onClick={() => send({ type: "approve-applicants", ids: interviewing.slice(0, 10).map((row) => row.id) })}>
          Aprovar até 10 entrevistados como trainees
        </button>
      ) : null}
      <div style={{ maxHeight: "50vh", overflow: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Curso</th>
              <th>Per.</th>
              <th>Por que quer entrar</th>
              <th>Etapa</th>
              <th>Triagem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.courseLabel}</td>
                <td>{row.semester}º</td>
                <td>
                  {row.motivationText}
                  {row.answers.map((answer) => (
                    <div key={answer.questionId}>
                      <em>{answer.text}</em>
                    </div>
                  ))}
                </td>
                <td>{STAGE_LABEL[row.stage]}</td>
                <td>
                  {(["call", "maybe", "no"] as const).map((tag) => (
                    <button key={tag} type="button" aria-pressed={row.tag === tag} onClick={() => send({ type: "tag-applicant", applicantId: row.id, tag: row.tag === tag ? null : tag })}>
                      {TAG_LABEL[tag]}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
