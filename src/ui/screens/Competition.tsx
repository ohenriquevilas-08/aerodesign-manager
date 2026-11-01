// Tela Competição (design §9.4 e §11): o voo (FlightScene) e, ao lado, a decisão de cada bateria:
// fila com a regra dos 3, altitude densidade ao vivo, carga estimada com margem, a sua reta nesse
// ponto, o estado das peças e o placar. Em dev, um painel toca cada desfecho com dados simulados.

import { useEffect, useState } from "preact/hooks";
import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import { FlightScene } from "../../scenes/FlightScene";
import { MOCK_PLAYBACKS } from "../../scenes/flight/mockPlaybacks";
import { OUTCOME_LABEL, type FlightOutcome } from "../../scenes/flight/playback";
import { flightReplay, type ReplaySpeed } from "../../scenes/flight/replayChannel";
import {
  clockToDate,
  currentDensityAltitude,
  estimatePerformance,
  formatCountdown,
  formatDate,
  formatTime,
  MIN_TEAMS_AHEAD_TO_REVISE,
  OFFICIAL_CALENDAR,
  partState,
  PART_STATE_LABELS,
  payloadAccuracyPoints,
  PLAYER_TEAM_ID,
  predictedPayload,
  REGULAR_2026,
  standings,
  teamsAhead,
  type CompetitionPhase,
  type Estimate,
  type PartState
} from "../../sim";
import { EstimateRow } from "../components/EstimateRow";
import { Slider } from "../components/Controls";
import { formatNumber, isCounterfeit } from "../format";
import { useDerived } from "../hooks";
import { PhaserStage } from "../PhaserStage";

const R = REGULAR_2026;
const n = formatNumber;
const COMPETITION_DAY = OFFICIAL_CALENDAR.find((item) => item.id === "competition")!;
/** Fila mostrada: quantas equipes a partir da próxima a voar. */
const QUEUE_VISIBLE = 8;

const PHASE_LABEL: Record<CompetitionPhase, string> = {
  inspection: "Inspeção de segurança",
  flights: "Baterias de voo",
  finished: "Encerrada"
};

const PART_TONE: Record<PartState, string> = {
  new: "ok",
  worn: "warn",
  damaged: "highlight",
  broken: "danger"
};

/** O que a tela precisa da competição, arredondado para o relógio não re-renderizar a cada quadro. */
interface FieldView {
  phase: CompetitionPhase;
  battery: number;
  plannedPayloadKg: number | null;
  /** Próximas equipes da fila (ids), a partir de quem voa agora. */
  upcoming: string[];
  playerInQueue: boolean;
  densityAltitudeM: number;
  temperatureC: number;
  pressureHpa: number;
  headwindMs: number;
  inspectionIssues: string[];
}

export function Competition() {
  const field = useDerived((state): FieldView | null => {
    const comp = state.competition;
    if (!comp) return null;
    return {
      phase: comp.phase,
      battery: comp.battery,
      plannedPayloadKg: comp.plannedPayloadKg,
      upcoming: comp.queue.slice(comp.queueIndex, comp.queueIndex + QUEUE_VISIBLE),
      playerInQueue: comp.queue.slice(comp.queueIndex).includes(PLAYER_TEAM_ID),
      densityAltitudeM: Math.round(currentDensityAltitude(state) ?? 0),
      temperatureC: Math.round((comp.weather.temperatureK - 273.15) * 10) / 10,
      pressureHpa: Math.round(comp.weather.pressureHpa * 10) / 10,
      headwindMs: Math.round(comp.weather.headwindMs * 10) / 10,
      inspectionIssues: comp.inspectionIssues
    };
  }, []);
  const hours = useGame((state) => Math.floor(state.clock.hours));
  const minute = useGame((state) => Math.floor(state.clock.hours * 6));

  return (
    <div class="screen">
      <header class="screen-head">
        <h1 class="screen-title">Competição</h1>
        <span class="muted">
          {field
            ? `${PHASE_LABEL[field.phase]} · Bateria ${field.battery} · ${formatTime(clockToDate(minute / 6))}`
            : `Competição de voo em ${formatDate(COMPETITION_DAY.date)} · faltam ${formatCountdown(hours, COMPETITION_DAY.date)}`}
        </span>
        {import.meta.env.DEV && !field ? (
          <button type="button" class="btn-dev" onClick={() => store.dispatch({ type: "dev-start-competition" })}>
            DEV · pular para a competição
          </button>
        ) : null}
      </header>
      <div class="competition-grid">
        <div class="competition-main">
          <section class="panel competition-stage">
            <h2 class="panel-title">Pista · Baterias de voo</h2>
            <PhaserStage scene={FlightScene} sceneKey="flight" />
            {import.meta.env.DEV && <FlightDebugPanel />}
          </section>
          <StandingsPanel />
        </div>
        <div class="stack scroll-col">
          <QueuePanel field={field} />
          <WeatherPanel field={field} />
          <PayloadPanel field={field} />
          <PartsPanel issues={field?.inspectionIssues ?? []} />
        </div>
      </div>
    </div>
  );
}

function QueuePanel({ field }: { field: FieldView | null }) {
  const ahead = useGame(teamsAhead);
  const teamName = useGame((state) => state.teamName);
  const rivals = useGame((state) => state.rivals);
  const nameOf = (id: string) => (id === PLAYER_TEAM_ID ? teamName : rivals.find((team) => team.id === id)?.name ?? id);
  const locked = ahead !== null && ahead < MIN_TEAMS_AHEAD_TO_REVISE;

  return (
    <section class="panel">
      <h2 class="panel-title">Fila</h2>
      <div class="panel-body stack-tight">
        <div class={`queue-ahead${locked ? " is-locked" : ""}`}>
          <strong>{ahead === null ? "—" : ahead}</strong>
          <span>
            {ahead === null
              ? field
                ? "Sua equipe não está na fila desta bateria."
                : "Fila abre no dia da competição."
              : ahead === 0
                ? "Sua vez: o avião está na pista."
                : `${ahead === 1 ? "equipe" : "equipes"} à sua frente`}
          </span>
        </div>
        {ahead !== null ? (
          <p class={`alert ${locked ? "alert-danger" : "alert-info"}`}>
            {locked
              ? `Carga travada: com menos de ${MIN_TEAMS_AHEAD_TO_REVISE} equipes à frente não dá mais para revisar (R[10.1.5.3]).`
              : `Ainda dá para revisar a carga até restarem ${MIN_TEAMS_AHEAD_TO_REVISE} equipes à frente (R[10.1.5.3]).`}
          </p>
        ) : null}
        {field && field.upcoming.length > 0 ? (
          <ol class="queue-list">
            {field.upcoming.map((id, i) => (
              <li key={`${id}-${i}`} class={id === PLAYER_TEAM_ID ? "is-player" : undefined}>
                <span class="queue-pos">{i === 0 ? "voando" : `+${i}`}</span>
                <span class="queue-name">{nameOf(id)}</span>
              </li>
            ))}
            {!field.upcoming.includes(PLAYER_TEAM_ID) && field.playerInQueue ? <li class="queue-more">…</li> : null}
          </ol>
        ) : null}
      </div>
    </section>
  );
}

function WeatherPanel({ field }: { field: FieldView | null }) {
  return (
    <section class="panel">
      <h2 class="panel-title">Condições da pista</h2>
      <div class="panel-body stack-tight">
        <div class="density-live">
          <span class="stat-label">Altitude densidade agora</span>
          <strong>{field ? `${n(field.densityAltitudeM)} m` : "—"}</strong>
          <span class="muted small">Manhã fria = ar denso = mais carga. Ao longo do dia o ar afina.</span>
        </div>
        <div class="weather-row">
          <span>
            <span class="stat-label">Temperatura</span>
            {field ? `${n(field.temperatureC, 1)} °C` : "—"}
          </span>
          <span>
            <span class="stat-label">Pressão</span>
            {field ? `${n(field.pressureHpa, 1)} hPa` : "—"}
          </span>
          <span>
            <span class="stat-label">Vento</span>
            {field ? `${n(Math.abs(field.headwindMs), 1)} m/s ${field.headwindMs >= 0 ? "de proa" : "de cauda"}` : "—"}
          </span>
        </div>
      </div>
    </section>
  );
}

function PayloadPanel({ field }: { field: FieldView | null }) {
  const altitude = field?.densityAltitudeM ?? null;
  // Hρ em passos de 10 m: a margem não muda de verdade entre um quadro e outro.
  const estimate = useDerived((state) => {
    const h = currentDensityAltitude(state);
    return h === null ? null : estimatePerformance(state, Math.round(h / 10) * 10);
  }, []);
  const line = useGame((state) => state.report.payloadLine);
  const ahead = useGame(teamsAhead);
  const locked = ahead === null || ahead < MIN_TEAMS_AHEAD_TO_REVISE;
  const lineValue = line && altitude !== null ? predictedPayload(line, altitude) : null;
  const planned = field?.plannedPayloadKg ?? null;

  const [choice, setChoice] = useState<number>(planned ?? roundTenth(lineValue ?? 8));
  // Acompanha a carga gravada quando ela muda pela simulação (ex.: nova bateria).
  useEffect(() => {
    if (planned !== null) setChoice(planned);
  }, [planned]);

  const pac = lineValue !== null && lineValue > 0 ? payloadAccuracyPoints(lineValue, choice) : null;

  return (
    <section class="panel">
      <h2 class="panel-title">Carga da próxima decolagem</h2>
      <div class="panel-body stack-tight">
        <EstimateRow label="Carga máxima estimada" value={estimate?.maxPayloadKg} unit="kg" digits={1} />
        <EstimateRow label="Corrida de decolagem" value={estimate?.takeoffDistanceM} unit="m" digits={0} />
        <div class="estimate">
          <span class="muted">Sua reta nesta Hρ</span>
          <strong>{lineValue === null ? "—" : `${n(lineValue, 1)} kg`}</strong>
        </div>
        <PayloadGauge estimate={estimate?.maxPayloadKg ?? null} lineValue={lineValue} choice={choice} />
        <Slider
          label="Carga escolhida"
          value={choice}
          min={0}
          max={R.maxTakeoffWeight}
          step={0.1}
          display={`${n(choice, 1)} kg`}
          alert={choice < R.minValidPayload}
          disabled={locked}
          onChange={(value) => setChoice(roundTenth(value))}
        />
        <p class="muted small">
          {pac === null
            ? "Sem reta de previsão: o PAC não pode ser calculado."
            : `Se voar com ${n(choice, 1)} kg, o PAC fica em ${n(pac, 1)} de 30 pontos.`}
          {choice < R.minValidPayload ? ` Abaixo de ${n(R.minValidPayload, 1)} kg o voo não vale.` : ""}
        </p>
        <button
          type="button"
          class="btn-primary"
          disabled={locked || choice === planned}
          onClick={() => store.dispatch({ type: "set-battery-payload", payloadKg: choice })}
        >
          {planned === null ? "Confirmar carga" : `Trocar carga (atual ${n(planned, 1)} kg)`}
        </button>
      </div>
    </section>
  );
}

/** Régua de 0 a 20 kg: faixa estimada, valor da reta e carga escolhida. */
function PayloadGauge({ estimate, lineValue, choice }: { estimate: Estimate | null; lineValue: number | null; choice: number }) {
  const max = R.maxTakeoffWeight;
  const pct = (kg: number) => `${(Math.max(0, Math.min(max, kg)) / max) * 100}%`;
  const over = estimate !== null && choice > estimate.value + estimate.margin;
  return (
    <div class="payload-gauge" aria-hidden="true">
      <div class="payload-gauge-track">
        {estimate ? (
          <span
            class="payload-gauge-band"
            style={{ left: pct(estimate.value - estimate.margin), right: `calc(100% - ${pct(estimate.value + estimate.margin)})` }}
          />
        ) : null}
        {lineValue !== null ? <span class="payload-gauge-line" style={{ left: pct(lineValue) }} title="Sua reta" /> : null}
        <span class={`payload-gauge-choice${over ? " is-over" : ""}`} style={{ left: pct(choice) }} />
      </div>
      <div class="payload-gauge-scale">
        <span>0</span>
        <span>{max / 2} kg</span>
        <span>{max} kg</span>
      </div>
      <div class="chart-legend">
        <span class="legend-item">
          <span class="legend-swatch legend-swatch-highlight" /> estimada
        </span>
        <span class="legend-item">
          <span class="legend-line" /> sua reta
        </span>
        <span class="legend-item">
          <span class="legend-dot" /> escolhida
        </span>
      </div>
    </div>
  );
}

function PartsPanel({ issues }: { issues: string[] }) {
  const parts = useGame((state) => state.parts);
  return (
    <section class="panel">
      <h2 class="panel-title">Peças</h2>
      <div class="panel-body stack-tight">
        {parts.length === 0 ? <p class="muted">Nenhuma peça no hangar.</p> : null}
        {parts.map((part) => {
          const stateId = partState(part.condition);
          return (
            <div key={part.id} class="part-row">
              <span>
                {part.label}
                {isCounterfeit(part) ? <span class="seal-counterfeit">fora da especificação</span> : null}
              </span>
              <span class={`part-state tone-${PART_TONE[stateId]}`}>
                {PART_STATE_LABELS[stateId]} · {n(part.condition)}%
              </span>
            </div>
          );
        })}
        {issues.map((issue) => (
          <p key={issue} class="alert alert-danger">
            Inspeção: {issue}
          </p>
        ))}
      </div>
    </section>
  );
}

function StandingsPanel() {
  const rows = useDerived((state) => standings(state), []);
  const top = rows.slice(0, 10);
  const player = rows.find((row) => row.teamId === PLAYER_TEAM_ID);
  const shown = player && !top.includes(player) ? [...top, player] : top;
  return (
    <section class="panel competition-standings">
      <h2 class="panel-title">Placar</h2>
      <div class="panel-body">
        {rows.length === 0 ? (
          <p class="muted">Placar aparece depois das primeiras baterias: melhor bateria + BCF + projeto − penalidades.</p>
        ) : (
          <table class="data-table">
            <thead>
              <tr>
                <th class="num">#</th>
                <th>Equipe</th>
                <th class="num">Melhor bateria</th>
                <th class="num">BCF</th>
                <th class="num">Projeto</th>
                <th class="num">Penalidades</th>
                <th class="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.teamId} class={row.teamId === PLAYER_TEAM_ID ? "row-player" : undefined}>
                  <td class="num">{row.position}</td>
                  <td>{row.teamName}</td>
                  <td class="num">{n(row.bestBattery, 1)}</td>
                  <td class="num">{n(row.bcf, 1)}</td>
                  <td class="num">{n(row.project, 1)}</td>
                  <td class="num">{row.penalties > 0 ? `−${n(row.penalties, 1)}` : "—"}</td>
                  <td class="num">{n(row.total, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

const REPLAY_SPEEDS: ReplaySpeed[] = [0.5, 1, 2, 4];

function FlightDebugPanel() {
  const [speed, setSpeed] = useState<ReplaySpeed>(flightReplay.speed);
  const outcomes = Object.keys(MOCK_PLAYBACKS) as FlightOutcome[];

  return (
    <div class="flight-debug">
      <span class="flight-debug-label">DEV · voo simulado</span>
      {outcomes.map((outcome) => (
        <button key={outcome} type="button" class="flight-debug-btn" onClick={() => flightReplay.play(MOCK_PLAYBACKS[outcome])}>
          {OUTCOME_LABEL[outcome]}
        </button>
      ))}
      <span class="flight-debug-speeds">
        {REPLAY_SPEEDS.map((value) => (
          <button
            key={value}
            type="button"
            class="flight-debug-btn"
            aria-pressed={speed === value}
            onClick={() => {
              flightReplay.setSpeed(value);
              setSpeed(value);
            }}
          >
            {String(value).replace(".", ",")}×
          </button>
        ))}
      </span>
    </div>
  );
}
