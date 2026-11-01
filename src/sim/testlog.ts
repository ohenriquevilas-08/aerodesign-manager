// Histórico de ensaios (Fase 4, S6): cada ensaio concluído guarda data, Hρ do dia, resultado e as
// peças que perderam condição. Os pontos (Hρ, carga) dos voos de ensaio alimentam a reta de previsão.

import { maxPayloadKg, playerFlightModel } from "./aircraft";
import { noise, weatherAt } from "./competition";
import { BALANCE } from "./content/balance";
import { densityAltitude } from "./scoring";
import type { GameState, TestKind, TestRecord } from "./types";

const KIND_INDEX: Record<TestKind, number> = { structural: 1, thrust: 2, flight: 3, video: 4 };

/**
 * Compara o estado antes e depois de applyTest e anota o ensaio. `after` é o estado que
 * applyTest devolveu (`ok` = sem incidente); o retorno é `after` com o registro no fim de `testLog`.
 */
export function recordTest(before: GameState, after: GameState, test: TestKind, summary: string, ok: boolean): GameState {
  const at = before.clock.hours;
  const weather = weatherAt(before.seed, at);
  const densityAltitudeM = densityAltitude(weather.temperatureK, weather.pressureHpa);
  const affectedParts = after.parts
    .filter((part) => {
      const old = before.parts.find((item) => item.id === part.id);
      return !!old && part.condition < old.condition;
    })
    .map((part) => part.label);
  const T = BALANCE.tests;
  let payloadKg: number | null = null;
  if (test === "flight") {
    const model = playerFlightModel(before);
    if (model) {
      // Carga medida: a real naquele Hρ com ruído de medição (determinístico, sem mexer no rngState).
      const jitter = 2 * noise(before.seed, Math.floor(at), KIND_INDEX[test]) - 1;
      payloadKg = Math.max(0, maxPayloadKg(model, densityAltitudeM) * (1 + T.flight.measureSpread * jitter));
    }
  }
  const record: TestRecord = { at, test, densityAltitudeM, ok, summary, affectedParts, payloadKg };
  return { ...after, testLog: [...after.testLog, record] };
}

export const TEST_LABELS: Record<TestKind, string> = {
  structural: "Ensaio estrutural",
  thrust: "Ensaio de motor e hélice",
  flight: "Voo com carga incremental",
  video: "Voo filmado"
};

export interface TestHistoryEntry extends TestRecord {
  label: string;
}

export interface TestHistory {
  /** Do mais recente para o mais antigo. */
  entries: TestHistoryEntry[];
  /** Pontos medidos (Hρ m, carga kg) dos voos de ensaio, para o gráfico da reta de previsão. */
  points: { densityAltitudeM: number; payloadKg: number; at: number }[];
}

export function testHistory(state: GameState): TestHistory {
  const entries = [...state.testLog].reverse().map((record) => ({ ...record, label: TEST_LABELS[record.test] }));
  const points = state.testLog
    .filter((record) => record.payloadKg !== null)
    .map((record) => ({ densityAltitudeM: record.densityAltitudeM, payloadKg: record.payloadKg!, at: record.at }));
  return { entries, points };
}
