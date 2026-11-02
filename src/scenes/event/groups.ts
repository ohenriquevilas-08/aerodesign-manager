// Grupos da dinâmica da seletiva (Fase 9, C1): tamanhos de 5 a 6 e o destaque dos grupos acompanhados.
// Quem monta os grupos de verdade é a simulação (S3); `splitIntoGroups` é a mesma regra, para as
// montagens de dev e para a cena saber o que esperar. Puro, testado em tests/scenes/eventGroups.test.ts.

import type { SelectionView } from "./contract";

export const GROUP_MIN = 5;
export const GROUP_MAX = 6;

/**
 * Tamanhos dos grupos para `total` pessoas: o menor número de grupos que respeita o máximo, com os
 * tamanhos o mais parecidos possível (30 → 5×6, 31 → 6,5,5,5,5,5). Com menos de 5 pessoas, um grupo só;
 * de 7 a 9 também é um grupo só; 13, 14 e 19 não fecham em 5–6 e ganham um grupo de 7 (melhor que sobrar um de 4).
 */
export function groupSizes(total: number): number[] {
  const n = Math.max(0, Math.floor(total));
  if (n === 0) return [];
  const count = Math.max(1, Math.min(Math.ceil(n / GROUP_MAX), Math.floor(n / GROUP_MIN)));
  const base = Math.floor(n / count);
  const extra = n - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Reparte os ids em grupos de `groupSizes`, na ordem recebida. */
export function splitIntoGroups<T>(items: T[]): T[][] {
  const out: T[][] = [];
  let at = 0;
  for (const size of groupSizes(items.length)) {
    out.push(items.slice(at, at + size));
    at += size;
  }
  return out;
}

/** Grupos acompanhados de perto: `observedGroupIds` (vários) e, por compatibilidade, `observedGroupId`. */
export function observedSet(selection: Pick<SelectionView, "observedGroupId" | "observedGroupIds"> | null | undefined): Set<string> {
  const set = new Set<string>(selection?.observedGroupIds ?? []);
  if (selection?.observedGroupId) set.add(selection.observedGroupId);
  return set;
}

export interface GroupEmphasis {
  /** O jogador acompanha este grupo. */
  observed: boolean;
  /** Opacidade do grupo (mesa, candidatos): os não acompanhados esmaecem quando há algum acompanhado. */
  alpha: number;
}

export const DIMMED_ALPHA = 0.6;

/** Destaque do grupo: acompanhado em cheio; os outros esmaecidos se houver acompanhados; sem nenhum, tudo igual. */
export function groupEmphasis(observed: Set<string>, groupId: string): GroupEmphasis {
  if (observed.size === 0) return { observed: false, alpha: 1 };
  const isObserved = observed.has(groupId);
  return { observed: isObserved, alpha: isObserved ? 1 : DIMMED_ALPHA };
}

/** Rótulo do contador de grupos acompanhados ("2 grupos acompanhados"); vazio se nenhum. */
export function observedLabel(observed: Set<string>): string {
  if (observed.size === 0) return "";
  return `${observed.size} ${observed.size === 1 ? "grupo acompanhado" : "grupos acompanhados"}`;
}
