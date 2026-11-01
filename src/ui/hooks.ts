// Leituras derivadas do estado para as telas. useGame guarda o seletor da primeira renderização;
// aqui o seletor depende de parâmetros da tela (ex.: Hρ escolhida) e o resultado é comparado
// por conteúdo, para o relógio (que muda a cada quadro) não re-renderizar à toa.

import { useEffect, useMemo, useState } from "preact/hooks";
import { store } from "../app/store";
import { estimatePerformance, type GameState, type PerformanceEstimate } from "../sim";

/**
 * Valor derivado do estado, recalculado a cada mudança mas só re-renderiza quando o
 * conteúdo (JSON) muda. Para objetos pequenos: estimativas, listas curtas.
 */
export function useDerived<T>(select: (state: GameState) => T, deps: readonly unknown[]): T {
  const key = (state: GameState) => JSON.stringify(select(state) ?? null);
  const [json, setJson] = useState(() => key(store.getState()));
  useEffect(() => {
    setJson(key(store.getState()));
    return store.subscribe((state) => setJson(key(state)));
  }, deps);
  return useMemo(() => JSON.parse(json) as T, [json]);
}

/** estimatePerformance para uma Hρ; null enquanto a simulação não estima. */
export function usePerformance(densityAltitudeM: number | null): PerformanceEstimate | null {
  return useDerived(
    (state) => (densityAltitudeM === null ? null : estimatePerformance(state, densityAltitudeM)),
    [densityAltitudeM]
  );
}
