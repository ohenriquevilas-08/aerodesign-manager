// Tela Competição (design §9.4 e §11): a prova em si acontece no modo evento (EventMode, Fase 7).
// Aqui fica o histórico: o placar, os seus voos (com replay), o estado das peças e o regulamento da
// prova. Em dev, um painel toca cada desfecho com dados simulados.

import { useState } from "preact/hooks";
import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import { FlightScene } from "../../scenes/FlightScene";
import { MOCK_PLAYBACKS } from "../../scenes/flight/mockPlaybacks";
import { OUTCOME_LABEL, type FlightOutcome } from "../../scenes/flight/playback";
import { flightReplay, type ReplaySpeed } from "../../scenes/flight/replayChannel";
import { playResult } from "../../scenes/flight/results";
import {
  clockToDate,
  formatCountdown,
  formatDate,
  formatTime,
  OFFICIAL_CALENDAR,
  partState,
  PART_STATE_LABELS,
  PLAYER_TEAM_ID,
  standings,
  type CompetitionPhase,
  type PartState
} from "../../sim";
import { formatNumber, isCounterfeit } from "../format";
import { useDerived } from "../hooks";
import { PhaserStage } from "../PhaserStage";

const n = formatNumber;
const COMPETITION_DAY = OFFICIAL_CALENDAR.find((item) => item.id === "competition")!;

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

export function Competition() {
  const phase = useGame((state) => state.competition?.phase ?? null);
  const hours = useGame((state) => Math.floor(state.clock.hours));
  const minute = useGame((state) => Math.floor(state.clock.hours * 6));

  return (
    <div class="screen">
      <header class="screen-head">
        <h1 class="screen-title">Competição</h1>
        <span class="muted">
          {phase
            ? `${PHASE_LABEL[phase]} · ${formatTime(clockToDate(minute / 6))}`
            : `Competição de voo em ${formatDate(COMPETITION_DAY.date)} · faltam ${formatCountdown(hours, COMPETITION_DAY.date)}`}
        </span>
        {import.meta.env.DEV && !phase ? (
          <button type="button" class="btn-dev" onClick={() => store.dispatch({ type: "dev-start-competition" })}>
            DEV · pular para a competição
          </button>
        ) : null}
      </header>
      <div class="competition-grid">
        <div class="competition-main">
          <section class="panel competition-stage">
            <h2 class="panel-title">Replay dos seus voos</h2>
            <PhaserStage scene={FlightScene} sceneKey="flight" />
            {import.meta.env.DEV && <FlightDebugPanel />}
          </section>
          <StandingsPanel />
        </div>
        <div class="stack scroll-col">
          <p class="alert alert-info">A competição é jogada no modo evento, no dia da prova: chegada, inspeção e as baterias de voo. Esta tela guarda o histórico.</p>
          <HistoryPanel />
          <PartsPanel />
        </div>
      </div>
    </div>
  );
}

const OUTCOME_TONE: Record<FlightOutcome, string> = {
  valid: "ok",
  "no-takeoff": "danger",
  "tape-break": "danger",
  "landing-out": "warn",
  damage: "warn",
  crash: "danger"
};

/** Os seus voos da competição, com replay das baterias que guardam a animação. */
function HistoryPanel() {
  const all = useGame((state) => state.competition?.results);
  const mine = (all ?? []).filter((result) => result.teamId === PLAYER_TEAM_ID);
  return (
    <section class="panel">
      <h2 class="panel-title">Seus voos</h2>
      <div class="panel-body stack-tight">
        {mine.length === 0 ? <p class="muted">Nenhum voo ainda. A prova abre no dia da competição.</p> : null}
        {mine.map((result) => (
          <div key={`${result.battery}-${result.at}`} class="part-row">
            <span>
              Bateria {result.battery} · {n(result.payloadKg, 1)} kg
            </span>
            <span class={`part-state tone-${OUTCOME_TONE[result.outcome]}`}>
              {OUTCOME_LABEL[result.outcome]}
              {result.points ? ` · ${n(result.points.total, 1)} pts` : ""}
            </span>
            {result.playback ? (
              <button type="button" class="btn-ghost small" onClick={() => playResult(result)}>
                Rever
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function PartsPanel() {
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
