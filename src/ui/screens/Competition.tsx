// Tela Competição (design §11), versão mínima da frente de cenas: só monta a FlightScene.
// Fila, escolha de carga e placar ficam com a frente de interface.
// Em dev, um painel de depuração toca cada desfecho com dados simulados.

import { useState } from "preact/hooks";
import { FlightScene } from "../../scenes/FlightScene";
import { MOCK_PLAYBACKS } from "../../scenes/flight/mockPlaybacks";
import { OUTCOME_LABEL, type FlightOutcome } from "../../scenes/flight/playback";
import { flightReplay, type ReplaySpeed } from "../../scenes/flight/replayChannel";
import { PhaserStage } from "../PhaserStage";

export function Competition() {
  return (
    <section class="panel" style={{ height: "100%" }}>
      <h2 class="panel-title">Competição · Baterias de voo</h2>
      <PhaserStage scene={FlightScene} sceneKey="flight" />
      {import.meta.env.DEV && <FlightDebugPanel />}
    </section>
  );
}

const SPEEDS: ReplaySpeed[] = [0.5, 1, 2, 4];

function FlightDebugPanel() {
  const [speed, setSpeed] = useState<ReplaySpeed>(flightReplay.speed);
  const outcomes = Object.keys(MOCK_PLAYBACKS) as FlightOutcome[];

  const button = {
    padding: "6px 10px",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    background: "var(--panel-raised)",
    color: "var(--text)",
    fontFamily: "var(--font-display)",
    fontSize: "14px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    cursor: "pointer"
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-2) var(--space-4)",
        borderTop: "1px solid var(--border)"
      }}
    >
      <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>DEV · voo simulado</span>
      {outcomes.map((outcome) => (
        <button key={outcome} type="button" style={button} onClick={() => flightReplay.play(MOCK_PLAYBACKS[outcome])}>
          {OUTCOME_LABEL[outcome]}
        </button>
      ))}
      <span style={{ marginLeft: "auto", display: "flex", gap: "var(--space-1)" }}>
        {SPEEDS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={speed === value}
            style={{ ...button, background: speed === value ? "var(--accent)" : "var(--panel-raised)", color: speed === value ? "var(--bg)" : "var(--text)" }}
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
