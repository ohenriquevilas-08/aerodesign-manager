// Corpo por pose, desenhado olhando para a frente-direita (a vista frente-esquerda é o espelho).
// Cada grade marca regiões, não cores: a roupa decide se a região vira pano ou pele (compose.ts).
// Minúscula = tom base, maiúscula = sombra:
//   k pescoço · q ombro · v gola · c tronco · u braço · f antebraço · h mão · t coxa · n canela
// Calçado e caixote usam os tons comuns: # base, + luz, - sombra, = vinco, w sola.
// Coordenadas na grade de 30 × 46 antes da margem de cima (SPRITE_TOP em compose.ts).

import type { Part } from "../types";

export interface PoseParts {
  /** Origem da grade da cabeça (coluna 0 = orelha). */
  head: { x: number; y: number };
  /** Origem do tronco (TORSO); as sobreposições da roupa usam a mesma origem. */
  torso: { x: number; y: number };
  farArm: Part;
  nearArm: Part;
  legs: Part;
  farShoe: Part;
  nearShoe: Part;
  /** Saia sobre as pernas. */
  skirt: Part;
  /** Assento do cochilo (caixote), atrás das pernas. */
  seat?: Part;
}

/** Tronco com o pescoço (linhas 0–1) e os ombros na linha 2. Igual em todas as poses. */
export const TORSO: readonly string[] = [
  "....kkK....",
  "....kkK....",
  ".qqqvvvqqq.",
  "qqqqcccqqqQ",
  "qqcccccccqQ",
  "qcccccccccC",
  "ccccccccccC",
  "ccccccccccC",
  "ccccccccccC",
  "ccccccccccC",
  ".cccccccccC",
  ".cccccccccC",
  ".cccccccccC",
  ".CCCCCCCCCC"
];

const SHOE = ["####.", "#####", "wwwww"];

const STAND_FAR_ARM = ["uUU", "uUU", "uUU", "uUU", "UUU", "fFF", "fFF", "fFF", "fFF", "hHH", "hHH", ".HH"];
const STAND_NEAR_ARM = [".uuu", "uuuu", "uuuu", "uuuu", "UUUU", "fff.", "fff.", "ffF.", "ffF.", "hhh.", "hhH.", ".hH."];

const STAND_LEGS = [
  "tttttttTT",
  "tttttttTT",
  "tttT.ttTT",
  "tttT.ttTT",
  "tttT.ttTT",
  "tttT.ttTT",
  "tttT.ttTT",
  "nnnN.nnNN",
  "nnnN.nnNN",
  "nnnN.nnNN",
  "nnnN.nnNN",
  "nnnN.nnNN",
  "nnnN....."
];

const STAND_SKIRT = [
  "..#########...",
  "..#########...",
  ".###########..",
  ".####-###-#-#.",
  "##-###-###-#-#",
  "-=--=--=--=--="
];

export const STAND: PoseParts = {
  head: { x: 7, y: 3 },
  torso: { x: 9, y: 17 },
  farArm: { x: 19, y: 20, rows: STAND_FAR_ARM },
  nearArm: { x: 7, y: 20, rows: STAND_NEAR_ARM },
  legs: { x: 10, y: 30, rows: STAND_LEGS },
  farShoe: { x: 15, y: 42, rows: SHOE },
  nearShoe: { x: 10, y: 43, rows: SHOE },
  skirt: { x: 8, y: 30, rows: STAND_SKIRT }
};

/** Na bancada: os dois antebraços para a frente, mãos na altura do tampo; cabeça um pouco baixa. */
export const WORK: PoseParts = {
  ...STAND,
  head: { x: 7, y: 4 },
  farArm: {
    x: 19,
    y: 20,
    rows: ["uUU.....", "uUU.....", "uUU.....", "uUU.....", "UUUf....", ".fFFFF..", "..FFFFhh", "......hH"]
  },
  nearArm: {
    x: 7,
    y: 20,
    rows: [
      ".uuu.........",
      "uuuu.........",
      "uuuu.........",
      "uuuu.........",
      "UUUU.........",
      ".ffff........",
      "..fffffff....",
      "....FFFFFFhhh",
      "..........hhH"
    ]
  }
};

const NAP_DY = 4;

/** Cochilo: sentado no caixote, coxas para a frente, braços largados, cabeça caída para a frente. */
export const NAP: PoseParts = {
  head: { x: 8, y: 8 },
  torso: { x: 9, y: 17 + NAP_DY },
  farArm: { x: 19, y: 20 + NAP_DY, rows: STAND_FAR_ARM },
  nearArm: { x: 7, y: 20 + NAP_DY, rows: STAND_NEAR_ARM },
  legs: {
    x: 10,
    y: 33,
    rows: [
      "tttttttttTT....",
      "ttttttttTTTT...",
      "tttttttttttttT.",
      ".TTTTTTTTTTTTTT",
      "........nNN.nnN",
      "........nNN.nnN",
      "........nNN.nnN",
      "........nNN.nnN",
      "........nNN.nnN",
      "............nnN"
    ]
  },
  farShoe: { x: 18, y: 42, rows: SHOE },
  nearShoe: { x: 22, y: 43, rows: SHOE },
  skirt: {
    x: 9,
    y: 32,
    rows: [".###########...", "##############.", "###-###-###-###", "-=--=--=--=--=-"]
  },
  seat: {
    x: 5,
    y: 34,
    rows: [
      "+++++++++++++++",
      "##############-",
      "==============-",
      "##############-",
      "##############-",
      "==============-",
      "##############-",
      "##############-",
      "==============-",
      "##############-",
      "##############-",
      "--------------."
    ]
  }
};

export const POSES = { stand: STAND, work: WORK, nap: NAP } as const;
