// Detalhes de roupa e acessórios. As peças do tronco usam a origem de TORSO (body.ts); chapéus e fone,
// a origem da cabeça. Tons: # base, + luz, - sombra, = vinco, W branco, * cor de destaque.

import type { HatKind, Part } from "../types";

/** Faixa branca no peito da camiseta da equipe, sem contorno (W branco, - branco na sombra). */
export const TEAM_STRIPE: Part = { x: 0, y: 6, rows: ["WWWWWWWWWW-"] };

/** Frente aberta da jaqueta, com lapela; o vão do meio mostra a camiseta de baixo. */
export const JACKET_PANELS: Part = {
  x: 0,
  y: 2,
  rows: [
    ".#+.....+#.",
    "##+.....+##",
    "###.....###",
    "###.....###",
    "###.....###",
    "###.....###",
    "###.....###",
    "###.....###",
    "###.....###",
    "###.....###",
    "###.....###",
    "-=-.....-=-"
  ]
};

/** Capuz caído nas costas, em volta do pescoço (desenhado antes da cabeça). */
export const HOODIE_HOOD: Part = { x: 1, y: 0, rows: ["-#.....#-", "##-...-##", ".##---##."] };
/** Cordões e bolso canguru do moletom, sem contorno. */
export const HOODIE_DETAILS: Part = {
  x: 2,
  y: 3,
  rows: ["..W.W..", "..W.W..", ".......", ".......", ".......", ".......", "=======", "-.....-", "-.....-"]
};

export interface HatDef {
  part: Part;
  /** Cabelo da frente acima desta linha da cabeça some debaixo do chapéu. */
  clipAbove: number;
}

export const HATS: Record<HatKind, HatDef> = {
  cap: {
    clipAbove: 4,
    part: {
      x: -1,
      y: -3,
      rows: [
        ".....#######........",
        "...###+++#####......",
        "..##++#########.....",
        ".##+############....",
        ".###############....",
        "################....",
        "###############++++.",
        ".-------------=-----"
      ]
    }
  },
  beanie: {
    clipAbove: 4,
    part: {
      x: -1,
      y: -3,
      rows: [
        ".....#######.....",
        "...##+########...",
        "..#++##########..",
        ".#++###########-.",
        ".#+############-.",
        ".##############-.",
        "+-+-+-+-+-+-+-+-+",
        "-+-+-+-+-+-+-+-+-"
      ]
    }
  }
};

/** Fone de ouvido (origem da cabeça): arco por cima do cabelo, conchas na cor de destaque. */
export const HEADPHONES: Part = {
  x: -1,
  y: 0,
  rows: [
    "....#########....",
    "..##.........##..",
    ".#.............#.",
    ".#.............#.",
    ".#.............#.",
    ".#.............#.",
    "***...........**.",
    "*+*...........**.",
    "***...........**.",
    "***............*.",
    ".*..............."
  ]
};
