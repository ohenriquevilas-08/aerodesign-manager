import { useState } from "preact/hooks";
import { newGame } from "../app/session";
import { store } from "../app/store";
import { useGame } from "../app/useGame";
import { academicFactor, advisorView, clockToDate, formatDate, formatTime, SPEEDS, type ClockSpeed } from "../sim";
import { pauseReasonLabel } from "./format";

const SPEED_LABEL: Record<ClockSpeed, string> = { 0: "❚❚", 1: "▶", 2: "▶▶", 4: "▶▶▶" };

export function TopBar({ onNewGame }: { onNewGame: (seed: number) => void }) {
  const advisorTitle = useGame((state) => advisorView(state).title);
  const reputation = useGame((state) => advisorView(state).reputation);
  const hours = useGame((state) => Math.floor(state.clock.hours * 6) / 6); // atualiza a cada 10 min de jogo
  const speed = useGame((state) => state.clock.speed);
  const teamName = useGame((state) => state.teamName);
  const credits = useGame((state) => state.credits);
  const pauseReason = useGame((state) => state.pause?.reason ?? null);
  const date = clockToDate(hours);
  const academic = academicFactor(date);

  return (
    <header class="topbar">
      <div class="brand">
        Aerodesign Manager
        <small>{teamName} · Ano 1 · Classe Regular</small>
      </div>
      <div class="advisor" title="Você é o professor orientador. Reputação sobe com resultados (ainda sem efeito no Ano 1).">
        <strong>{advisorTitle}</strong>
        <small>Reputação {reputation}</small>
      </div>
      <div class="topbar-spacer" />
      <div class="clock">
        <div class="clock-date">{formatDate(date)}</div>
        <div class="clock-sub">
          {formatTime(date)} · <strong>{academic.label}</strong>
          {pauseReason ? <span class="clock-pause"> · {pauseReasonLabel(pauseReason)}</span> : null}
        </div>
      </div>
      <div class="speed" role="group" aria-label="Velocidade do tempo">
        {SPEEDS.map((value) => (
          <button
            key={value}
            type="button"
            class={value === 0 ? "is-paused" : undefined}
            aria-pressed={speed === value}
            title={value === 0 ? "Pausar (espaço)" : `${value}× (tecla ${SPEEDS.indexOf(value)})`}
            onClick={() => store.setSpeed(value)}
          >
            {SPEED_LABEL[value]}
          </button>
        ))}
      </div>
      <div class="credits" title="Créditos em caixa">◆ {credits.toLocaleString("pt-BR")}</div>
      <GameMenu onNewGame={onNewGame} />
    </header>
  );
}

/** Menu do jogo (U7): Novo jogo, com confirmação, porque apaga o save. */
function GameMenu({ onNewGame }: { onNewGame: (seed: number) => void }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const close = () => {
    setOpen(false);
    setConfirming(false);
  };
  return (
    <div class="game-menu">
      <button type="button" class="btn-ghost game-menu-btn" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
        Menu
      </button>
      {open ? (
        <div class="game-menu-pop panel" role="menu">
          {confirming ? (
            <>
              <p class="small">Começar de novo apaga o jogo salvo. Tem certeza?</p>
              <div class="confirm-row">
                <button type="button" class="btn-ghost" onClick={() => setConfirming(false)}>
                  Voltar
                </button>
                <button
                  type="button"
                  class="btn-primary"
                  onClick={() => {
                    close();
                    onNewGame(newGame());
                  }}
                >
                  Apagar e começar
                </button>
              </div>
            </>
          ) : (
            <button type="button" class="btn-ghost" role="menuitem" onClick={() => setConfirming(true)}>
              Novo jogo
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
