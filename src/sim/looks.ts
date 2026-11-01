// Aparência dos integrantes (Fase 5, S3). Sorteada pelo rngState ao criar o integrante ou o
// candidato; as cenas desenham o boneco isométrico a partir dela (scenes/people/avatar.ts).
// A camiseta só tem modelo: a cor é sempre a da equipe.

import { nextRandom } from "./rng";
import type { Accessory, HairColor, HairStyle, MemberLook, ShirtStyle, SkinTone } from "./types";

export const LOOK_OPTIONS = {
  skin: ["light", "tan", "brown", "dark"] as readonly SkinTone[],
  hair: ["short", "buzz", "curly", "long", "ponytail", "bald"] as readonly HairStyle[],
  hairColor: ["black", "brown", "blonde", "red"] as readonly HairColor[],
  shirt: ["tee", "polo", "hoodie"] as readonly ShirtStyle[],
  accessory: ["glasses", "cap", "headphones"] as readonly Accessory[]
} as const;

/** Chance de ter um acessório. */
const ACCESSORY_CHANCE = 0.4;

export function drawLook(rngState: number): { look: MemberLook; rngState: number } {
  let rng = rngState;
  const roll = () => {
    const r = nextRandom(rng);
    rng = r.state;
    return r.value;
  };
  const pick = <T>(options: readonly T[]): T => options[Math.floor(roll() * options.length)]!;
  const look: MemberLook = {
    skin: pick(LOOK_OPTIONS.skin),
    hair: pick(LOOK_OPTIONS.hair),
    hairColor: pick(LOOK_OPTIONS.hairColor),
    shirt: pick(LOOK_OPTIONS.shirt)
  };
  if (roll() < ACCESSORY_CHANCE) look.accessory = pick(LOOK_OPTIONS.accessory);
  return { look, rngState: rng };
}
