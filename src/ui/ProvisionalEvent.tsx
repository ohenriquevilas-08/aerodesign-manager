// PROVISÓRIO (Fase 7, frente Simulação): painel simples para jogar os eventos (dinâmica da
// seletiva, ensaio de voo, competição) enquanto a UI definitiva (U1: tela cheia com a cena de
// fundo) não chega. Só lê `eventView` e manda comandos; nada de regra aqui.

import { store } from "../app/store";
import { useDerived } from "./hooks";
import { eventView, type Cost } from "../sim";

const costText = (cost: Cost) => {
  const parts: string[] = [];
  if (cost.hours > 0) parts.push(`⏱ ${cost.hours} h`);
  if (cost.credits > 0) parts.push(`◆ ${cost.credits}`);
  if (cost.risk !== "none") parts.push(`⚠ ${cost.risk}`);
  return parts.join(" · ");
};

const hourText = (hour: number) => {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, "0")}h${m ? String(m).padStart(2, "0") : ""}`;
};

export function ProvisionalEvent() {
  const view = useDerived((state) => eventView(state), []);
  if (!view) return null;
  return (
    <div class="event-overlay" role="dialog" aria-label={view.title}>
      <div class="event-panel">
        <p class="small muted">Painel provisório do evento (a tela definitiva vem na UI da Fase 7)</p>
        <h2>{view.title}</h2>
        <p class="muted">
          {view.dayLabel} · {view.headline}
        </p>
        {view.stage === "call" ? (
          <div>
            <p>Hoje é dia de evento. O relógio da gestão fica parado até o fim.</p>
            <button type="button" class="primary" onClick={() => store.dispatch({ type: "enter-event" })}>
              Entrar
            </button>
          </div>
        ) : (
          <>
            <ol class="event-timeline">
              {view.blocks.map((block) => (
                <li key={block.id} class={`event-block is-${block.status}`}>
                  <span class="small">{hourText(block.startsAt)}</span> {block.label}
                </li>
              ))}
            </ol>
            {view.decision ? (
              <div class="event-decision">
                <p>
                  <strong>{view.decision.prompt}</strong>
                </p>
                {view.decision.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={!!option.blocked}
                    title={option.blocked ?? option.hint}
                    onClick={() => store.dispatch({ type: "decide-event", optionId: option.id })}
                  >
                    {option.label}
                    <span class="small muted"> {costText(option.cost)}</span>
                    <span class="small muted event-hint">{option.blocked ?? option.hint}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <ul class="event-log">
              {view.log.slice(-12).map((entry, index) => (
                <li key={index} class={`is-${entry.tone}`}>
                  {entry.text}
                </li>
              ))}
            </ul>
            {view.summary ? (
              <div class="event-summary">
                <h3>{view.summary.title}</h3>
                {view.summary.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                {view.summary.damage.length ? <p class="small">Danos: {view.summary.damage.join("; ")}</p> : null}
                {view.summary.creditsSpent > 0 ? <p class="small">◆ {view.summary.creditsSpent} gastos nas decisões.</p> : null}
                <button type="button" class="primary" onClick={() => store.dispatch({ type: "close-event" })}>
                  Voltar à equipe
                </button>
              </div>
            ) : (
              <button type="button" class="primary" disabled={!view.canAdvance} onClick={() => store.dispatch({ type: "advance-event" })}>
                Seguir
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
