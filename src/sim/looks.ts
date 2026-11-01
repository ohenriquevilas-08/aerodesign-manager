// Aparência dos integrantes (Fase 5, S3). Sorteada pelo rngState ao criar o integrante ou o
// candidato; as cenas desenham o boneco isométrico a partir dela (scenes/people/avatar.ts).
// Pele, cabelo e cor do cabelo são índices nas paletas das cenas; a camiseta é a cor da equipe.

import { nextRandom } from "./rng";
import type { Accessory, MemberLook } from "./types";

/** Cor da equipe na camiseta: espelha palette.highlight (--highlight), o laranja da sua equipe. */
export const TEAM_SHIRT_COLOR = 0xff9f2e;

export const LOOK_OPTIONS = {
  skins: 6,
  hairs: 5,
  hairColors: 6,
  accessories: ["glasses", "cap", "headband"] as readonly Accessory[]
} as const;

/** Chance de ter um acessório. */
const ACCESSORY_CHANCE = 0.4;

/** `female` (Fase 7): o gênero sorteado com o nome; a arte usa para escolher o corte de cabelo e o corpo. */
export function drawLook(rngState: number, female = false): { look: MemberLook; rngState: number } {
  let rng = rngState;
  const roll = () => {
    const r = nextRandom(rng);
    rng = r.state;
    return r.value;
  };
  const index = (count: number) => Math.floor(roll() * count);
  const look: MemberLook = {
    skin: index(LOOK_OPTIONS.skins),
    hair: index(LOOK_OPTIONS.hairs),
    hairColor: index(LOOK_OPTIONS.hairColors),
    shirt: TEAM_SHIRT_COLOR,
    ...(female ? { female: true } : {})
  };
  if (roll() < ACCESSORY_CHANCE) look.accessory = LOOK_OPTIONS.accessories[index(LOOK_OPTIONS.accessories.length)]!;
  return { look, rngState: rng };
}
