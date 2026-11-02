// Modo evento (Fase 7, U1): tela cheia, fora do menu lateral. A EventStage (cena) fica ao fundo; por
// cima, a linha do tempo do dia, o cartão de decisão, o log e o botão "Seguir". Só lê `eventView` e
// manda comandos; nada de regra aqui. Voo do evento roda na janela da moldura (FRAME_WINDOW).

import { useEffect, useRef, useState } from "preact/hooks";
import { store } from "../app/store";
import { EventStage } from "../scenes/EventStage";
import { FlightScene } from "../scenes/FlightScene";
import { FRAME_WINDOW, framedSceneFor } from "../scenes/event/stage";
import { flightReplay } from "../scenes/flight/replayChannel";
import { eventView, type EventView, type SelectionDayContext } from "../sim";
import { CostTag } from "./components/CostTag";
import { useDerived } from "./hooks";
import { PhaserStage } from "./PhaserStage";

const hourText = (hour: number) => {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, "0")}h${m ? String(m).padStart(2, "0") : ""}`;
};

const KIND_LABEL = {
  "selection-day": "Dinâmica da seletiva",
  "flight-test": "Ensaio de voo",
  competition: "Competição"
} as const;

export function EventMode() {
  const view = useDerived((state) => eventView(state), []);
  if (!view) return null;
  return <EventScreen view={view} />;
}

function EventScreen({ view }: { view: EventView }) {
  const [watching, setWatching] = useState(view.lastPlayback !== null);
  const playKey = view.lastPlayback ? JSON.stringify(view.lastPlayback) : "";
  const seen = useRef("");

  const advance = () => {
    setWatching(false);
    store.dispatch({ type: "advance-event" });
  };

  // Um voo novo do evento: abre a janela e toca o replay assim que a FlightScene existir.
  useEffect(() => {
    if (!playKey || playKey === seen.current) return;
    seen.current = playKey;
    setWatching(true);
    const playback = view.lastPlayback!;
    const venue = view.kind === "flight-test" && view.venueId ? { id: view.venueId, name: view.title.replace(/^Ensaio de voo: /, "") } : undefined;
    const timer = window.setTimeout(() => flightReplay.play(playback, venue), 500);
    return () => window.clearTimeout(timer);
  }, [playKey]);

  // Enter segue o evento (sem decisão pendente).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Enter" || !view.canAdvance) return;
      if (event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      advance();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const block = view.currentBlock;
  const framed = view.stage === "running" && ((block && framedSceneFor(block.kind) !== null) || watching);
  const style = {
    left: `${FRAME_WINDOW.x * 100}%`,
    top: `${FRAME_WINDOW.y * 100}%`,
    width: `${FRAME_WINDOW.w * 100}%`,
    height: `${FRAME_WINDOW.h * 100}%`
  };

  return (
    <div class="event-mode" role="dialog" aria-label={view.title}>
      <div class="event-canvas">
        <PhaserStage scene={EventStage} sceneKey="event" />
      </div>
      {framed ? (
        <div class="event-flight" style={style}>
          <PhaserStage scene={FlightScene} sceneKey="flight" />
        </div>
      ) : null}

      <header class="event-top">
        <div class="event-title">
          <span class="event-kind">{KIND_LABEL[view.kind]}</span>
          <h1>{view.title}</h1>
          <span class="event-day">{view.dayLabel}</span>
        </div>
        {view.stage !== "call" ? (
          <ol class="event-timeline" aria-label="Programação do dia">
            {view.blocks.map((item) => (
              <li key={item.id} class={`event-block is-${item.status}`} title={item.label}>
                <span class="event-block-hour">{hourText(item.startsAt)}</span>
                <span class="event-block-label">{item.label}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </header>

      {view.stage === "running" ? (
        <>
          <aside class="event-side">
            <h2>Diário do dia</h2>
            <EventLog view={view} />
            {view.kind === "selection-day" ? <SelectionNotes /> : null}
          </aside>
          <footer class="event-bottom">
            <p class="event-headline">{view.headline}</p>
            {view.decision ? null : (
              <button type="button" class="btn-primary event-go" disabled={!view.canAdvance} onClick={advance}>
                Seguir
              </button>
            )}
          </footer>
          {view.decision ? <DecisionCard decision={view.decision} /> : null}
        </>
      ) : null}

      {view.stage === "call" ? <Call view={view} /> : null}
      {view.stage === "summary" && view.summary ? <Summary view={view} summary={view.summary} /> : null}
    </div>
  );
}

function EventLog({ view }: { view: EventView }) {
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [view.log.length]);
  if (view.log.length === 0) return <p class="muted small">Nada aconteceu ainda.</p>;
  return (
    <ul class="event-log">
      {view.log.map((entry, index) => (
        <li key={index} class={`is-${entry.tone}`}>
          {entry.text}
        </li>
      ))}
      <li ref={end} aria-hidden="true" />
    </ul>
  );
}

function DecisionCard({ decision }: { decision: NonNullable<EventView["decision"]> }) {
  return (
    <section class="event-decision" aria-label="Decisão">
      <span class="event-kind">Decisão</span>
      <h2>{decision.prompt}</h2>
      <div class="event-options">
        {decision.options.map((option) => (
          <button
            key={option.id}
            type="button"
            class="event-option"
            disabled={!!option.blocked}
            onClick={() => store.dispatch({ type: "decide-event", optionId: option.id })}
          >
            <span class="event-option-head">
              <strong>{option.label}</strong>
              <CostTag cost={option.cost} />
            </span>
            <span class={option.blocked ? "event-option-blocked" : "muted small"}>{option.blocked ?? option.hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Call({ view }: { view: EventView }) {
  return (
    <div class="event-modal">
      <section class="event-card">
        <span class="event-kind">Hoje</span>
        <h2>{view.title}</h2>
        <p>{view.headline}</p>
        <p class="muted">O relógio da gestão fica parado até o fim do evento. A equipe toda está nele.</p>
        <button type="button" class="btn-primary" autofocus onClick={() => store.dispatch({ type: "enter-event" })}>
          Entrar
        </button>
      </section>
    </div>
  );
}

function Summary({ view, summary }: { view: EventView; summary: NonNullable<EventView["summary"]> }) {
  const more = view.day < view.totalDays;
  return (
    <div class="event-modal">
      <section class="event-card event-summary">
        <span class="event-kind">{more ? `Fim do ${view.dayLabel.toLowerCase()}` : "Resumo"}</span>
        <h2>{summary.title}</h2>
        <div class="event-summary-lines">
          {summary.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <dl class="event-stats">
          {summary.points !== null ? (
            <div>
              <dt>Pontos</dt>
              <dd>{summary.points.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</dd>
            </div>
          ) : null}
          <div>
            <dt>Créditos gastos</dt>
            <dd>◆ {summary.creditsSpent.toLocaleString("pt-BR")}</dd>
          </div>
        </dl>
        {summary.damage.length > 0 ? (
          <div class="event-summary-block">
            <h3>Estado das peças</h3>
            <ul>
              {summary.damage.map((item) => (
                <li key={item} class={item.endsWith(": nova") ? undefined : "is-bad"}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {summary.knowledge.length > 0 ? (
          <div class="event-summary-block">
            <h3>Aprendizado</h3>
            <ul>
              {summary.knowledge.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <button type="button" class="btn-primary" autofocus onClick={() => store.dispatch({ type: "close-event" })}>
          Voltar à equipe
        </button>
      </section>
    </div>
  );
}

/** Anotações da dinâmica por candidato (as fichas dos observados). */
function SelectionNotes() {
  const rows = useDerived((state) => {
    const context = state.activeEvent?.context;
    if (!context || context.kind !== "selection-day") return [];
    const c: SelectionDayContext = context;
    // Só os grupos acompanhados têm anotações por pessoa; cada grupo solto tem uma anotação geral.
    return c.candidateIds.flatMap((id) => {
      const person = state.candidates.find((item) => item.id === id);
      const notes = c.notes[id] ?? [];
      if (!person || notes.length === 0) return [];
      const watched = c.watchedGroupIds.some((groupId) => c.groups.find((group) => group.id === groupId)?.candidateIds.includes(id));
      return [{ id, name: person.name, notes, verdict: watched ? "Acompanhado" : null }];
    });
  }, []);
  if (rows.length === 0) return null;
  return (
    <div class="event-notes">
      <h2>Anotações</h2>
      {rows.map((row) => (
        <article key={row.id}>
          <strong>
            {row.name}
            {row.verdict ? <span class="chip">{row.verdict}</span> : null}
          </strong>
          <ul>
            {row.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
