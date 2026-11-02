import { useEffect, useRef, useState } from "preact/hooks";
import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import { FlightScene } from "../../scenes/FlightScene";
import { HangarScene } from "../../scenes/HangarScene";
import { flightReplay } from "../../scenes/flight/replayChannel";
import { entryFromHistory } from "../../scenes/tests/fromHistory";
import { playTest, type TestEntry } from "../../scenes/tests/testEntry";
import {
  ACTIONS,
  clockToDate,
  findVenue,
  formatDate,
  formatTime,
  predictedPayload,
  testHistory,
  upcomingEvents,
  type FlightTest,
  type GameState,
  type PayloadLine,
  type TestHistory,
  type TestHistoryEntry
} from "../../sim";
import { ActionCard } from "../components/CostTag";
import { FlightTestPlanner } from "./FlightTestPlanner";
import { formatNumber } from "../format";
import { useDerived } from "../hooks";
import { navigate } from "../nav";
import { PhaserStage } from "../PhaserStage";

// Tela Ensaios (U5): escolher o ensaio (cada um é uma ação do catálogo), ver acontecer na cena (C2),
// o histórico (S6) e o gráfico Hρ × carga com os pontos medidos e a reta do rascunho.

const n = formatNumber;
const TEST_ACTIONS = ACTIONS.filter((action) => action.effect?.kind === "test");

type Stage = "bench" | "flight";

// O último ensaio agendado que já tocou na cena; sobrevive à troca de tela (como o replay da competição).
let watchedTestId: string | null = null;

/** Sessão da cena C3 a partir de um ensaio agendado já realizado: local, tripulação e uma decolagem por carga. */
function sessionOf(state: GameState, test: FlightTest) {
  const venue = findVenue(test.venueId);
  const ids = "hired" in test.pilot ? test.crew : [test.pilot.memberId, ...test.crew];
  return {
    venueId: test.venueId,
    venueName: venue?.name ?? test.venueId,
    crew: ids.flatMap((id) => state.members.find((member) => member.id === id)?.look ?? []),
    flights: test.takeoffs.map((takeoff) => takeoff.playback)
  };
}

export function Tests() {
  const history = useDerived((state) => testHistory(state), []);
  const events = useDerived((state) => upcomingEvents(state), []);
  const doneTests = useDerived(
    (state) =>
      state.flightTests
        .filter((test) => test.status === "done")
        .map((test) => ({ id: test.id, venueId: test.venueId, takeoffs: test.takeoffs.length })),
    []
  );
  const [planning, setPlanning] = useState(false);
  const teamName = useGame((state) => state.teamName);
  const line = useGame((state) => state.report.payloadLine);
  const [stage, setStage] = useState<Stage>("bench");
  const seen = useRef(history.entries.length);
  const timer = useRef<number | undefined>(undefined);

  const play = (entry: TestEntry) => {
    const wanted: Stage = entry.kind === "flight" ? "flight" : "bench";
    setStage(wanted);
    window.clearTimeout(timer.current);
    // Dá tempo da cena montar e assinar o canal antes de tocar.
    timer.current = window.setTimeout(() => playTest(entry), wanted === stage ? 120 : 900);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Toca a cena do ensaio agendado: vinheta de chegada e uma decolagem por carga (C3).
  const playFlightTest = (testId: string) => {
    const test = store.getState().flightTests.find((item) => item.id === testId);
    if (!test || test.takeoffs.length === 0) return;
    watchedTestId = testId;
    setStage("flight");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => flightReplay.playSession(sessionOf(store.getState(), test)), stage === "flight" ? 120 : 900);
  };
  // Dia de ensaio que passou com outra tela aberta (ou com esta aberta): toca ao entrar e quando acontece.
  const latestDone = doneTests[doneTests.length - 1]?.id ?? null;
  useEffect(() => {
    if (latestDone && latestDone !== watchedTestId) playFlightTest(latestDone);
  }, [latestDone]);

  // Ensaio que acaba com a tela aberta toca sozinho.
  useEffect(() => {
    // Voo de ensaio agendado toca como sessão inteira (acima), não por decolagem solta.
    if (history.entries.length > seen.current && !history.entries[0]!.flightTestId) {
      const entry = entryFromHistory(history.entries[0]!, teamName);
      if (entry) play(entry);
    }
    seen.current = history.entries.length;
  }, [history.entries.length]);

  return (
    <div class="screen">
      <header class="screen-head">
        <h1 class="screen-title">Ensaios</h1>
        <span class="muted">Ensaio gasta horas, caixa e peças. O resultado alimenta o relatório e a reta de previsão.</span>
      </header>
      <div class="tests-grid">
        <div class="stack scroll-col">
          {planning ? <FlightTestPlanner onClose={() => setPlanning(false)} /> : null}
          <section class="panel">
            <h2 class="panel-title">Próximos eventos</h2>
            <div class="panel-body stack-tight">
              {events.map((event) => (
                <article key={event.id} class={`event-row${event.kind === "competition" ? " is-competition" : ""}`}>
                  <div>
                    <strong>{event.title}</strong>
                    <span class="small muted">
                      {formatDate(clockToDate(event.at))} · {event.daysLeft === 0 ? "hoje" : `em ${event.daysLeft} ${event.daysLeft === 1 ? "dia" : "dias"}`}
                    </span>
                  </div>
                  {event.kind === "flight-test" ? (
                    <button type="button" class="btn-ghost" onClick={() => store.dispatch({ type: "cancel-flight-test", testId: event.id })}>
                      Cancelar
                    </button>
                  ) : null}
                </article>
              ))}
              {doneTests.map((test) => (
                <article key={test.id} class="event-row is-done">
                  <div>
                    <strong>Ensaio feito: {findVenue(test.venueId)?.name ?? test.venueId}</strong>
                    <span class="small muted">
                      {test.takeoffs} {test.takeoffs === 1 ? "decolagem" : "decolagens"}
                    </span>
                  </div>
                  <button type="button" class="btn-ghost" onClick={() => playFlightTest(test.id)}>
                    Rever voos
                  </button>
                </article>
              ))}
              <button type="button" class="btn-primary" disabled={planning} onClick={() => setPlanning(true)}>
                Agendar ensaio de voo
              </button>
              <p class="muted small">Local, piloto e equipe de campo são pagos adiantados. No dia o relógio pausa e a equipe voa.</p>
            </div>
          </section>
          <section class="panel">
            <h2 class="panel-title">Ensaio de bancada</h2>
            <div class="panel-body stack-tight">
              {TEST_ACTIONS.map((action) => (
                <ActionCard key={action.id} action={action} onSelect={() => navigate("actions", { actionId: action.id })} />
              ))}
              <p class="muted small">Abre a ação em Ações para escolher quem faz e a dedicação.</p>
            </div>
          </section>
          <section class="panel">
            <h2 class="panel-title">
              Histórico <span class="panel-count">{history.entries.length}</span>
            </h2>
            <div class="panel-body stack-tight">
              {history.entries.length === 0 ? <p class="muted">Nenhum ensaio ainda.</p> : null}
              {history.entries.map((entry) => (
                <HistoryRow key={entry.at + entry.test} entry={entry} onReplay={(item) => play(item)} teamName={teamName} />
              ))}
            </div>
          </section>
        </div>

        <section class="panel stage-panel">
          <h2 class="panel-title tests-stage-title">
            <span>Cena do ensaio</span>
            <span class="tabs" role="tablist" aria-label="Cena">
              <button type="button" role="tab" aria-selected={stage === "bench"} onClick={() => setStage("bench")}>
                Bancada
              </button>
              <button type="button" role="tab" aria-selected={stage === "flight"} onClick={() => setStage("flight")}>
                Voo
              </button>
            </span>
          </h2>
          {stage === "bench" ? (
            <PhaserStage key="bench" scene={HangarScene} sceneKey="hangar" />
          ) : (
            <PhaserStage key="flight" scene={FlightScene} sceneKey="flight" />
          )}
        </section>

        <section class="panel">
          <h2 class="panel-title">Hρ × carga</h2>
          <div class="panel-body stack-tight">
            <TestChart history={history} line={line} />
          </div>
        </section>
      </div>
    </div>
  );
}

function HistoryRow({
  entry,
  teamName,
  onReplay
}: {
  entry: TestHistoryEntry;
  teamName: string;
  onReplay: (entry: TestEntry) => void;
}) {
  const date = clockToDate(entry.at);
  const playable = entryFromHistory(entry, teamName);
  return (
    <article class={`test-row${entry.ok ? "" : " is-fail"}`}>
      <header class="check-head">
        <strong>{entry.label}</strong>
        <span class={`check-state ${entry.ok ? "state-ready" : "state-fail"}`}>{entry.ok ? "Sem incidente" : "Incidente"}</span>
      </header>
      <div class="check-meta">
        <span>
          {formatDate(date)} · {formatTime(date)}
        </span>
        <span>Hρ {n(entry.densityAltitudeM)} m</span>
        {entry.payloadKg !== null ? <span>carga {n(entry.payloadKg, 2)} kg</span> : null}
      </div>
      <p class="small muted">{entry.summary}</p>
      {entry.affectedParts.length > 0 ? <p class="check-missing-line">Peças afetadas: {entry.affectedParts.join(", ")}</p> : null}
      {playable ? (
        <button type="button" class="btn-ghost check-write" onClick={() => onReplay(playable)}>
          Rever
        </button>
      ) : null}
    </article>
  );
}

// Pontos medidos nos voos de ensaio sobre a reta do rascunho de previsão (linha 2 px, grade recessiva).
const CH = { width: 360, height: 220, left: 44, right: 12, top: 10, bottom: 28 };
const ALT_MAX = 1500;

function TestChart({ history, line }: { history: TestHistory; line: PayloadLine | null }) {
  const plotW = CH.width - CH.left - CH.right;
  const plotH = CH.height - CH.top - CH.bottom;
  const peak = Math.max(10, ...history.points.map((point) => point.payloadKg), line ? predictedPayload(line, 0) : 0);
  const yMax = Math.ceil(peak / 5) * 5;
  const x = (altitude: number) => CH.left + (Math.min(ALT_MAX, Math.max(0, altitude)) / ALT_MAX) * plotW;
  const y = (kg: number) => CH.top + (1 - Math.max(0, Math.min(yMax, kg)) / yMax) * plotH;
  const yTicks = Array.from({ length: yMax / 5 + 1 }, (_, i) => i * 5);

  return (
    <figure class="payload-chart">
      <div class="chart-legend">
        <span class="legend-item">
          <span class="legend-line legend-line-accent" /> Reta do rascunho
        </span>
        <span class="legend-item">
          <span class="legend-dot" /> Carga medida em voo de ensaio
        </span>
      </div>
      <svg class="chart chart-payload" viewBox={`0 0 ${CH.width} ${CH.height}`} role="img" aria-label="Pontos medidos de carga por altitude densidade">
        {yTicks.map((kg) => (
          <g key={kg}>
            <line class="chart-grid" x1={CH.left} x2={CH.width - CH.right} y1={y(kg)} y2={y(kg)} />
            <text class="chart-label" x={CH.left - 6} y={y(kg) + 4} text-anchor="end">
              {kg === yMax ? `${kg} kg` : kg}
            </text>
          </g>
        ))}
        {[0, 500, 1000, 1500].map((altitude) => (
          <text key={altitude} class="chart-label" x={x(altitude)} y={CH.height - 8} text-anchor="middle">
            {n(altitude)} m
          </text>
        ))}
        {line ? (
          <polyline
            class="chart-line is-active"
            points={[0, ALT_MAX].map((altitude) => `${x(altitude).toFixed(1)},${y(predictedPayload(line, altitude)).toFixed(1)}`).join(" ")}
          />
        ) : null}
        {history.points.map((point) => (
          <circle key={point.at} class="chart-dot" cx={x(point.densityAltitudeM)} cy={y(point.payloadKg)} r={5}>
            <title>{`Hρ ${n(point.densityAltitudeM)} m · ${n(point.payloadKg, 2)} kg`}</title>
          </circle>
        ))}
      </svg>
      {history.points.length === 0 ? (
        <figcaption class="muted small">Sem pontos ainda: faça um voo com carga incremental para medir.</figcaption>
      ) : null}
      {!line ? <figcaption class="muted small">A reta aparece quando você grava as previsões no Relatório.</figcaption> : null}
    </figure>
  );
}
