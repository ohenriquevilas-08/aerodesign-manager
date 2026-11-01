// Cabeça vista de frente-direita: orelha na coluna 0, rosto deslocado para a direita.
// Tons: # pele, + luz, - sombra. Rosto: e olho, b sobrancelha (cor do cabelo), n nariz (sombra da pele),
// m boca, p lábio, r bochecha, w branco. Grades do rosto têm a mesma origem da cabeça.

import type { SpriteExpression, SpriteGender } from "../types";

export const HEAD: readonly string[] = [
  "....########...",
  "..############.",
  ".##############",
  ".+#############",
  ".+#############",
  ".##############",
  ".##############",
  "#-#############",
  "#-#############",
  "#-#############",
  ".-#############",
  "..-############",
  "....--########.",
  "......-#####..."
];

/** Linha e coluna dos olhos (olho de 1 × 2 px); úteis para óculos e testes. */
export const EYES = { row: 8, cols: [7, 11] } as const;

const FACE_TOP = 6;

const FACES: Record<SpriteGender, Record<SpriteExpression, readonly string[]>> = {
  m: {
    neutral: [
      "...............",
      "......bb..bbb..",
      "......we..we...",
      "......we..we...",
      "............n..",
      ".........mm....",
      "..............."
    ],
    smile: [
      "...............",
      "......bb..bbb..",
      "......we..we...",
      "......we..we...",
      "............n..",
      "........m..m...",
      ".........mm...."
    ],
    focus: [
      "...............",
      ".....bbb.bbb...",
      "......we..we...",
      "......we..we...",
      "............n..",
      ".........mmm...",
      "..............."
    ],
    sleep: [
      "...............",
      "...............",
      "...............",
      "......ee..ee...",
      "............n..",
      "..........m....",
      "..............."
    ],
    surprise: [
      "......bb..bbb..",
      "...............",
      "......we..we...",
      "......we..we...",
      "............n..",
      ".........mm....",
      ".........mm...."
    ]
  },
  f: {
    neutral: [
      "...............",
      "......bb...bb..",
      "......ee...ee..",
      "......we..we...",
      ".....r......nr.",
      ".........pp....",
      "..............."
    ],
    smile: [
      "...............",
      "......bb...bb..",
      "......ee...ee..",
      "......we..we...",
      ".....r......nr.",
      "........p..p...",
      ".........pp...."
    ],
    focus: [
      "...............",
      ".....bbb..bbb..",
      "......ee...ee..",
      "......we..we...",
      ".....r......nr.",
      ".........pp....",
      "..............."
    ],
    sleep: [
      "...............",
      "...............",
      "...............",
      "......ee..ee...",
      ".....r......nr.",
      "..........p....",
      "..............."
    ],
    surprise: [
      "......bb...bb..",
      "...............",
      "......ee...ee..",
      "......we..we...",
      ".....r......nr.",
      ".........mm....",
      ".........mm...."
    ]
  }
};

export function faceRows(gender: SpriteGender, expression: SpriteExpression): { y: number; rows: readonly string[] } {
  return { y: FACE_TOP, rows: FACES[gender][expression] };
}

/** Barba rente: tons do cabelo, sem contorno. */
export const BEARD = {
  x: 0,
  y: 9,
  rows: [
    ".--............",
    ".---.....###...",
    "..---#.....#-..",
    "....-######-...",
    "......-####...."
  ]
} as const;

/** Óculos de aro só em cima e dos lados (x); o vão das lentes fica livre para os olhos. */
export const GLASSES = {
  x: 0,
  y: 7,
  rows: [".....xxxxxxxx..", "..xx.x..xx..x..", ".....x..xx..x.."]
} as const;

export const FACES_FOR_TEST = FACES;
