// Sorteio de nome e sobrenome pelo rngState (Fase 6): todo aluno tem nome de pessoa.

import { FIRST_NAMES, LAST_NAMES } from "./content/names";
import { nextRandom } from "./rng";

/**
 * Sorteia um nome completo que não esteja em `taken` (e, se der, com primeiro nome ainda não usado).
 * Não altera `taken`: quem chama acrescenta o nome devolvido.
 */
export function drawPersonName(rngState: number, taken: ReadonlySet<string>): { name: string; rngState: number } {
  let rng = rngState;
  const roll = (count: number) => {
    const r = nextRandom(rng);
    rng = r.state;
    return Math.floor(r.value * count);
  };
  const firstTaken = new Set([...taken].map((full) => full.split(" ")[0]));
  let fallback: string | null = null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const first = FIRST_NAMES[roll(FIRST_NAMES.length)]!;
    const name = `${first} ${LAST_NAMES[roll(LAST_NAMES.length)]!}`;
    if (taken.has(name)) continue;
    if (!firstTaken.has(first)) return { name, rngState: rng };
    fallback ??= name;
  }
  return { name: fallback ?? `${FIRST_NAMES[0]} ${LAST_NAMES[0]}`, rngState: rng };
}
