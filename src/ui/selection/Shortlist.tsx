// Depois da dinâmica (Fase 9, U2): escolher quem vai para a entrevista, com teto. Quem não for
// escolhido sai do processo.

import { useState } from "preact/hooks";
import { store } from "../../app/store";
import type { ApplicantView } from "../../sim";
import { ApplicantSheet, TagButtons } from "./ApplicantSheet";

export function Shortlist({ rows, cap }: { rows: ApplicantView[]; cap: number }) {
  const attended = rows.filter((row) => row.stage === "dynamic");
  const [picked, setPicked] = useState<string[] | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  // Começa com quem foi marcado "Chamar" (até o teto); o jogador ajusta.
  const chosen = picked ?? attended.filter((row) => row.tag === "call").slice(0, cap).map((row) => row.id);
  const toggle = (id: string) => setPicked(chosen.includes(id) ? chosen.filter((item) => item !== id) : chosen.length < cap ? [...chosen, id] : chosen);
  const current = attended.find((row) => row.id === (focus ?? chosen[0])) ?? attended[0];

  return (
    <section class="panel selection-stage">
      <h2 class="panel-title">
        Quem vai para a entrevista <span class="panel-count">{chosen.length}/{cap}</span>
      </h2>
      <p class="muted small selection-hint">
        {attended.length} pessoas foram à dinâmica. Leia as anotações e escolha até {cap}; quem ficar de fora sai do processo.
      </p>
      <div class="selection-split">
        <ul class="pick-list" aria-label="Quem foi à dinâmica">
          {attended.map((row) => (
            <li key={row.id} class={`pick-row${current?.id === row.id ? " is-focus" : ""}`}>
              <label>
                <input type="checkbox" checked={chosen.includes(row.id)} onChange={() => toggle(row.id)} />
                <button type="button" class="pick-name" onClick={() => setFocus(row.id)}>
                  {row.name}
                  <small>
                    {row.courseLabel} · {row.notes.length} {row.notes.length === 1 ? "anotação" : "anotações"}
                  </small>
                </button>
              </label>
              <TagButtons row={row} />
            </li>
          ))}
        </ul>
        {current ? <ApplicantSheet view={current} showTags={false} /> : null}
      </div>
      <footer class="selection-actions">
        <button
          type="button"
          class="btn-primary"
          disabled={chosen.length === 0}
          onClick={() => store.dispatch({ type: "advance-applicants", ids: chosen })}
        >
          Passar {chosen.length} para a entrevista
        </button>
        <span class="muted small">Entrevistar custa horas de capitão; cada entrevista ocupa dois entrevistadores.</span>
      </footer>
    </section>
  );
}
