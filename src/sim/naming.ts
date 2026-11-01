// Sorteio de nome e sobrenome pelo rngState (Fase 6): todo aluno tem nome de pessoa.
// Fase 7: o gênero do sorteio segue BALANCE.people.femaleShare (proporção da engenharia aeronáutica).

import { BALANCE } from "./content/balance";
import { FEMALE_FIRST_NAMES, LAST_NAMES, MALE_FIRST_NAMES } from "./content/names";
import { nextRandom } from "./rng";

/**
 * Sorteia um nome completo que não esteja em `taken` (e, se der, com primeiro nome ainda não usado).
 * Não altera `taken`: quem chama acrescenta o nome devolvido.
 */
export function drawPersonName(rngState: number, taken: ReadonlySet<string>, female = false): { name: string; rngState: number } {
  let rng = rngState;
  const roll = (count: number) => {
    const r = nextRandom(rng);
    rng = r.state;
    return Math.floor(r.value * count);
  };
  const firsts = female ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES;
  const firstTaken = new Set([...taken].map((full) => full.split(" ")[0]));
  let fallback: string | null = null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const first = firsts[roll(firsts.length)]!;
    const name = `${first} ${LAST_NAMES[roll(LAST_NAMES.length)]!}`;
    if (taken.has(name)) continue;
    if (!firstTaken.has(first)) return { name, rngState: rng };
    fallback ??= name;
  }
  return { name: fallback ?? `${firsts[0]} ${LAST_NAMES[0]}`, rngState: rng };
}

/** Sorteia o gênero (BALANCE.people.femaleShare) e um nome dele: usado por fundadores, candidatos e trainees. */
export function drawPerson(rngState: number, taken: ReadonlySet<string>): { name: string; female: boolean; rngState: number } {
  const roll = nextRandom(rngState);
  const female = roll.value < BALANCE.people.femaleShare;
  const drawn = drawPersonName(roll.state, taken, female);
  return { name: drawn.name, female, rngState: drawn.rngState };
}
