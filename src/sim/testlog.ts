// Histórico de ensaios (Fase 4, S6): cada ensaio concluído guarda data, Hρ do dia, resultado e as
// peças que perderam condição. Os pontos (Hρ, carga) dos voos de ensaio alimentam a reta de previsão.

import { weatherAt } from "./competition";
import { densityAltitude } from "./scoring";
import type { GameState, TestKind, TestRecord } from "./types";

/**
 * Compara o estado antes e depois de applyTest (bancada) e anota o ensaio. Voos de ensaio são
 * anotados pelo evento agendado (flightTests.ts). `after` é o estado que
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
  const payloadKg: number | null = null;
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
