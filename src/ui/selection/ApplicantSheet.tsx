// Ficha do inscrito (Fase 9, U3): acumula tudo o que já foi revelado (formulário, presença, anotações
// da dinâmica e respostas da entrevista). Só lê `ApplicantView`; o perfil escondido nunca chega aqui.

import { store } from "../../app/store";
import { findQuestion, type ApplicantTag, type ApplicantView } from "../../sim";
import { PixelAvatar } from "../components/PixelAvatar";
import { STAGE_LABEL, TAG_LABEL } from "./model";

const TAGS = ["call", "maybe", "no"] as const;

export function TagButtons({ row }: { row: Pick<ApplicantView, "id" | "tag" | "name"> }) {
  const set = (tag: ApplicantTag) => store.dispatch({ type: "tag-applicant", applicantId: row.id, tag: row.tag === tag ? null : tag });
  return (
    <span class="tag-buttons" role="group" aria-label={`Marcar ${row.name}`}>
      {TAGS.map((tag) => (
        <button key={tag} type="button" class={`tag-btn tag-${tag}`} aria-pressed={row.tag === tag} onClick={() => set(tag)}>
          {TAG_LABEL[tag]}
        </button>
      ))}
    </span>
  );
}

export function ApplicantSheet({ view, showTags = true }: { view: ApplicantView; showTags?: boolean }) {
  return (
    <article class="applicant-sheet" aria-label={`Ficha de ${view.name}`}>
      <header class="applicant-sheet-head">
        <PixelAvatar member={{ id: view.id, look: view.look }} scale={3} />
        <div>
          <h3>{view.name}</h3>
          <p class="muted small">
            {view.courseLabel} · {view.semester}º período
          </p>
          <span class="chip">{STAGE_LABEL[view.stage]}</span>
        </div>
      </header>

      <section>
        <h4>Formulário</h4>
        <p class="applicant-quote">“{view.motivationText}”</p>
      </section>

      <section>
        <h4>Presença</h4>
        <ul class="applicant-facts">
          <li>{view.lecture === "present" ? "Veio à palestra." : view.lecture === "absent" ? "Faltou à palestra." : "A palestra ainda não aconteceu."}</li>
          {view.dynamic === true ? <li>Foi à dinâmica.</li> : null}
          {view.dynamic === false ? <li>Não foi à dinâmica.</li> : null}
        </ul>
      </section>

      {view.notes.length > 0 ? (
        <section>
          <h4>Anotações</h4>
          <ul class="applicant-facts">
            {view.notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {view.answers.length > 0 ? (
        <section>
          <h4>Entrevista</h4>
          <ul class="applicant-answers">
            {view.answers.map((answer) => (
              <li key={answer.questionId}>
                <span class="muted small">{findQuestion(answer.questionId)?.label ?? answer.questionId}</span>
                <p>{answer.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showTags ? (
        <footer>
          <TagButtons row={view} />
        </footer>
      ) : null}
    </article>
  );
}
