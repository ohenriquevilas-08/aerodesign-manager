// Animação curta de ensaio de bancada no hangar (Fase 4, C2). Pura: o tempo entra, o quadro sai.
// A cena desenha o instrumento da bancada com este quadro; o resultado já veio pronto da simulação.

import type { BenchTestEntry, BenchTestKind } from "../tests/testEntry";
import type { BenchId } from "./benchView";

/** Onde cada ensaio acontece: estrutural na asa, tração na eletrônica, balança na fuselagem. */
export const TEST_BENCH: Record<BenchTestKind, BenchId> = {
  structural: "wing",
  thrust: "electronics",
  scale: "fuselage"
};

/** Segundos em que o instrumento trabalha antes de mostrar o resultado. */
export const RESULT_AT = 2.6;
/** Duração total, com o resultado na tela. */
export const BENCH_TEST_SECONDS = 5;

export interface BenchTestFrame {
  /** Posição do ponteiro, 0 a 1. */
  gauge: number;
  /** Tremor da bancada, -1 a 1. */
  shake: number;
  /** Fase da hélice, radianos (só tração). */
  spin: number;
  /** A asa rompeu neste quadro (só estrutural reprovado). */
  broken: boolean;
  showResult: boolean;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function benchTestFrame(entry: BenchTestEntry, t: number): BenchTestFrame {
  const time = Math.max(0, t);
  const target = clamp01(entry.gauge);
  const base = { shake: 0, spin: 0, broken: false, showResult: time >= RESULT_AT };

  if (entry.kind === "structural") {
    // Carga sobe até o fim; se reprovou, o ponteiro vai ao fundo de escala e a asa rompe.
    const ramp = clamp01(time / 2.2);
    const load = ramp * ramp;
    if (entry.outcome === "fail") {
      if (time < 2.2) return { ...base, gauge: load, shake: load * Math.sin(time * 40) * 0.5 };
      const since = time - 2.2;
      return { ...base, gauge: 0.12 + 0.88 * Math.exp(-since * 6), shake: Math.exp(-since * 5) * Math.sin(time * 55), broken: true };
    }
    return { ...base, gauge: load * target };
  }
  if (entry.kind === "thrust") {
    const settle = 1 - Math.exp(-time * 1.8);
    return {
      ...base,
      gauge: clamp01(target * settle + Math.sin(time * 17) * 0.015 * settle),
      spin: time * 55 * Math.min(1, time),
      shake: settle * 0.25 * Math.sin(time * 50)
    };
  }
  // Balança: o ponteiro balança e assenta.
  return { ...base, gauge: clamp01(target * (1 - Math.exp(-time * 2.6) * Math.cos(time * 9))) };
}
