import { useEffect, useRef, useState } from "preact/hooks";
import { useGame } from "../../app/useGame";
import { FlightScene } from "../../scenes/FlightScene";
import { HangarScene } from "../../scenes/HangarScene";
import { entryFromHistory } from "../../scenes/tests/fromHistory";
import { playTest, type TestEntry } from "../../scenes/tests/testEntry";
import {
  ACTIONS,
  clockToDate,
  formatDate,
  formatTime,
  predictedPayload,
  testHistory,
  type PayloadLine,
  type TestHistory,
  type TestHistoryEntry
} from "../../sim";
import { ActionCard } from "../components/CostTag";
import { formatNumber } from "../format";
import { useDerived } from "../hooks";
import { navigate } from "../nav";
import { PhaserStage } from "../PhaserStage";

// Tela Ensaios (U5): escolher o ensaio (cada um é uma ação do catálogo), ver acontecer na cena (C2),
// o histórico (S6) e o gráfico Hρ × carga com os pontos medidos e a reta do rascunho.

const n = formatNumber;
const TEST_ACTIONS = ACTIONS.filter((action) => action.effect?.kind === "test");

type Stage = "bench" | "flight";

export function Tests() {
  const history = useDerived((state) => testHistory(state), []);
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

  // Ensaio que acaba com a tela aberta toca sozinho.
  useEffect(() => {
    if (history.entries.length > seen.current) {
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
          <section class="panel">
            <h2 class="panel-title">Fazer um ensaio</h2>
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
