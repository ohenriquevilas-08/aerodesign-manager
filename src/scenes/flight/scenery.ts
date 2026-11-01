// Cenário do local do voo (C3): céu, chão e fundo. Dados puros em cores da paleta; a FlightScene desenha.
// A competição mantém o visual de sempre (`COMPETITION_SCENERY`); os locais de ensaio (S2: testVenues)
// mapeiam para um destes três por `sceneryForVenue`.

import { palette } from "../palette";

export type Backdrop = "hills" | "hangars" | "trees" | "barn";

export interface Scenery {
  id: "competition" | "aeroclub" | "airstrip" | "farm";
  /** Gradiente do céu, de cima para o horizonte. */
  skyTop: number;
  skyBottom: number;
  /** Chão fora da pista. */
  ground: number;
  /** Cor do tracejado do capim. */
  grassTuft: number;
  /** Faixa de pista. */
  runway: number;
  backdrop: Backdrop;
  /** Morros ao fundo. */
  hills: number;
  /** Quantidade de nuvens (0 a 1). */
  clouds: number;
}

export const COMPETITION_SCENERY: Scenery = {
  id: "competition",
  skyTop: palette.bg,
  skyBottom: palette.panelRaised,
  ground: palette.floor,
  grassTuft: palette.inkDim,
  runway: palette.panelRaised,
  backdrop: "hills",
  hills: palette.bgGrid,
  clouds: 1
};

const SCENERY: Record<string, Scenery> = {
  aeroclub: {
    id: "aeroclub",
    skyTop: palette.venueClubTop,
    skyBottom: palette.venueClubBottom,
    ground: palette.venueGrass,
    grassTuft: palette.ok,
    runway: palette.venueWall,
    backdrop: "hangars",
    hills: palette.venueRoof,
    clouds: 0.6
  },
  airstrip: {
    id: "airstrip",
    skyTop: palette.venueStripTop,
    skyBottom: palette.venueStripBottom,
    ground: palette.venueGrass,
    grassTuft: palette.ok,
    runway: palette.inkDim,
    backdrop: "trees",
    hills: palette.venueLeaves,
    clouds: 0.3
  },
  farm: {
    id: "farm",
    skyTop: palette.venueFarmTop,
    skyBottom: palette.venueFarmBottom,
    ground: palette.venueSoil,
    grassTuft: palette.warn,
    runway: palette.venueSoil,
    backdrop: "barn",
    hills: palette.venueRoof,
    clouds: 0.4
  }
};

/** Cenário de um local de ensaio; id desconhecido cai no campo do aeroclube. */
export function sceneryForVenue(venueId: string): Scenery {
  return SCENERY[venueId] ?? SCENERY.aeroclub!;
}

/** Ids de cenário conhecidos (para testes e a depuração). */
export const SCENERY_IDS = Object.keys(SCENERY);
