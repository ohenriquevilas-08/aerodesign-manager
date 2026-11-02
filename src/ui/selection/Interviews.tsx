// Entrevistas (Fase 9, U3): a lista dos chamados, a escolha de até 3 perguntas por pessoa e a ficha
// acumulando o que as respostas revelam, aos poucos, conforme a tarefa anda.

import { useState } from "preact/hooks";
import { store } from "../../app/store";
import { BALANCE, interviewQuestionList, type ApplicantView } from "../../sim";
import { useDerived } from "../hooks";
import { ApplicantSheet } from "./ApplicantSheet";
import { interviewCost } from "./model";

const QUESTIONS = interviewQuestionList();
const MAX = BALANCE.selection.maxQuestions;

export function Interviews({ rows, running }: { rows: ApplicantView[]; running: boolean }) {
  const called = rows.filter((row) => row.stage === "interview");
  const pending = called.filter((row) => row.answers.length === 0);
  const [focus, setFocus] = useState<string | null>(null);
  const [crew, setCrew] = useState<string[]>([]);
  const people = useDerived(
    (state) => state.members.filter((member) => member.role !== "trainee" && member.taskId === null).map((member) => ({ id: member.id, name: member.name })),
    []
  );
  const current = called.find((row) => row.id === focus) ?? pending[0] ?? called[0];
  const toggleCrew = (id: string) => setCrew(crew.includes(id) ? crew.filter((item) => item !== id) : [...crew, id]);
  const needed = BALANCE.selection.interviewers;

  const setQuestions = (applicantId: string, questionIds: string[]) => store.dispatch({ type: "set-interview-questions", applicantId, questionIds });
  const toggleQuestion = (row: ApplicantView, questionId: string) => {
    const has = row.questionIds.includes(questionId);
    if (!has && row.questionIds.length >= MAX) return;
    setQuestions(row.id, has ? row.questionIds.filter((id) => id !== questionId) : [...row.questionIds, questionId]);
  };
  const copyToAll = (row: ApplicantView) => pending.forEach((other) => setQuestions(other.id, row.questionIds));

  return (
    <section class="panel selection-stage">
      <h2 class="panel-title">
        Entrevistas{" "}
        <span class="panel-count">
          {called.length - pending.length}/{called.length} feitas
        </span>
      </h2>

      {running ? (
        <div class="selection-progress" role="status">
          <div class="meter meter-highlight">
            <div class="meter-fill" style={{ width: `${((called.length - pending.length) / Math.max(1, called.length)) * 100}%` }} />
          </div>
          <span class="muted small">Os capitães estão entrevistando. As respostas aparecem nas fichas conforme cada entrevista termina.</span>
        </div>
      ) : pending.length > 0 ? (
        <div class="selection-schedule">
          <div>
            <strong>Quem entrevista</strong>
            <span class="muted small"> (pelo menos {needed}; trainee não entrevista)</span>
            <div class="stat-row selection-crew">
              {people.map((person) => (
                <label key={person.id} class="check-chip">
                  <input type="checkbox" checked={crew.includes(person.id)} onChange={() => toggleCrew(person.id)} /> {person.name}
                </label>
              ))}
            </div>
          </div>
          <button
            type="button"
            class="btn-primary"
            disabled={crew.length < needed}
            onClick={() => store.dispatch({ type: "schedule-interviews", applicantIds: pending.map((row) => row.id), memberIds: crew })}
          >
            Agendar {pending.length} entrevistas
          </button>
          <span class="text-hours selection-cost" title="Cada entrevista ocupa dois entrevistadores">
            ⏱ {interviewCost(pending.length)} h-pessoa
          </span>
        </div>
      ) : null}

      <div class="selection-split">
        <ul class="pick-list" aria-label="Chamados para a entrevista">
          {called.map((row) => {
            const done = row.answers.length > 0;
            return (
              <li key={row.id} class={`pick-row${current?.id === row.id ? " is-focus" : ""}`}>
                <button type="button" class="pick-name" onClick={() => setFocus(row.id)}>
                  {row.name}
                  <small>{row.courseLabel}</small>
                </button>
                <span class={`chip${done ? " chip-done" : ""}`}>{done ? "respondeu" : running ? "aguardando" : `${row.questionIds.length}/${MAX} perguntas`}</span>
              </li>
            );
          })}
        </ul>

        {current ? (
          <div class="interview-side">
            {current.answers.length === 0 && !running ? (
              <section class="question-picker" aria-label={`Perguntas para ${current.name}`}>
                <h4>
                  Perguntas para {current.name.split(" ")[0]} <span class="panel-count">{current.questionIds.length}/{MAX}</span>
                </h4>
                <ul>
                  {QUESTIONS.map((question) => {
                    const checked = current.questionIds.includes(question.id);
                    return (
                      <li key={question.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!checked && current.questionIds.length >= MAX}
                            onChange={() => toggleQuestion(current, question.id)}
                          />
                          <span>
                            {question.label}
                            <small class="muted"> revela: {question.reveals}</small>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <div class="selection-actions">
                  {current.questionIds.length === 0 ? <span class="muted small">Sem perguntas, só faz a pergunta de abertura.</span> : null}
                  {current.questionIds.length > 0 && pending.length > 1 ? (
                    <button type="button" class="btn-ghost" onClick={() => copyToAll(current)}>
                      Usar estas perguntas em todos os {pending.length} que faltam
                    </button>
                  ) : null}
                </div>
              </section>
            ) : null}
            <ApplicantSheet view={current} showTags={false} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
