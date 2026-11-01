// Ponte entre o histórico de ensaios da simulação (testHistory, S6) e a cena de Ensaios (C2).
// O histórico guarda o resultado, não a animação: aqui ele vira um TestEntry para rever o ensaio.
// A cena só anima; nada aqui decide resultado.

import type { FlightPlayback, TestHistoryEntry } from "../../sim";
import type { TestEntry } from "./testEntry";

/** Vento de bancada dos voos de ensaio: calmo, só para a biruta não ficar parada. */
const TEST_HEADWIND_MS = 1.5;

/**
 * Entrada animável de um ensaio do histórico; null se o ensaio não tem animação (voo filmado).
 * `teamName` vai no cabeçalho do voo.
 */
export function entryFromHistory(entry: TestHistoryEntry, teamName: string): TestEntry | null {
  if (entry.test === "structural" || entry.test === "thrust") {
    return {
      kind: entry.test,
      label: entry.label,
      outcome: entry.ok ? "pass" : "fail",
      gauge: entry.ok ? 0.85 : 0.4,
      result: entry.summary
    };
  }
  if (entry.test === "flight") {
    const base = { battery: 1, teamName, payloadKg: entry.payloadKg ?? 0, densityAltitudeM: entry.densityAltitudeM, headwindMs: TEST_HEADWIND_MS };
    const playback: FlightPlayback = entry.ok
      ? { ...base, rotationDistanceM: 42, obstacleClearanceM: 0.9, outcome: "valid", stopDistanceM: 32, unloadTimeS: 18 }
      : {
          ...base,
          rotationDistanceM: 42,
          obstacleClearanceM: 0.6,
          outcome: "damage",
          stopDistanceM: 38,
          unloadTimeS: null,
          damagedParts: entry.affectedParts
        };
    return { kind: "flight", playback };
  }
  return null;
}
