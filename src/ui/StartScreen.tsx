import { continueGame, initialSave, newGame } from "../app/session";
import { clockToDate, formatDate } from "../sim";

/** Tela de abertura (U7): Continuar, se há save, ou Novo jogo. */
export function StartScreen({ onStart }: { onStart: () => void }) {
  const saved = initialSave.state;
  return (
    <div class="start">
      <div class="start-card panel">
        <h1 class="start-title">Aerodesign Manager</h1>
        <p class="muted">Gestão de uma equipe universitária de aerodesign. Ano 1 · Classe Regular.</p>
        {initialSave.discarded ? (
          <p class="alert alert-warn">
            Havia um save de uma versão antiga do jogo. Ele não é compatível e foi descartado.
          </p>
        ) : null}
        <div class="start-actions">
          {saved ? (
            <button
              type="button"
              class="btn-primary"
              onClick={() => {
                continueGame();
                onStart();
              }}
            >
              Continuar
              <small>
                {saved.teamName} · {formatDate(clockToDate(saved.clock.hours))}
              </small>
            </button>
          ) : null}
          <button
            type="button"
            class={saved ? "btn-ghost start-new" : "btn-primary"}
            onClick={() => {
              newGame();
              onStart();
            }}
          >
            Novo jogo
          </button>
        </div>
      </div>
    </div>
  );
}
