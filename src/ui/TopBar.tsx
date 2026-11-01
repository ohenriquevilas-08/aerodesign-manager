import { store } from "../app/store";
import { useGame } from "../app/useGame";
import { academicFactor, clockToDate, formatDate, formatTime, SPEEDS, type ClockSpeed } from "../sim";
import { pauseReasonLabel } from "./format";

const SPEED_LABEL: Record<ClockSpeed, string> = { 0: "❚❚", 1: "▶", 2: "▶▶", 4: "▶▶▶" };

export function TopBar() {
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
    </header>
  );
}
