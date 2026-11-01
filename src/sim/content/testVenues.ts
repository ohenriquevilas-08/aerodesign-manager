// Locais de ensaio de voo (Fase 5, S2; design §7.3). Paródias de lugares onde equipes de
// aerodesign voam: aeroclube, clube de aeromodelismo, fazenda de ex-integrante.
// Valores provisórios (balanceamento na Fase 6).

import type { Weekday } from "../types";

export type VenueScenery = "aeroclub" | "model-field" | "farm";

export interface TestVenue {
  id: string;
  name: string;
  description: string;
  /** ◆ pagos ao agendar: taxa do local + combustível da van (ida e volta). */
  cost: number;
  /** Dias de antecedência mínima para marcar. */
  minLeadDays: number;
  /** Dias da semana em que o local recebe a equipe (0 = domingo). */
  weekdays: Weekday[];
  /** Estrada até o local, km (ida): risco de dano no transporte. */
  distanceKm: number;
  /** Pressão típica na pista, hPa (altitude do campo); o clima do dia varia em volta. */
  pressureHpa: number;
  /** Hρ típica às 8h (Apêndice 4), m: o que a tela mostra para escolher o local. */
  typicalDensityAltitudeM: number;
  /** Cenário da FlightScene (C3). */
  scenery: VenueScenery;
}

export const TEST_VENUES: readonly TestVenue[] = [
  {
    id: "aeroclub",
    name: "Aeroclube de Vila Serena",
    description: "Pista de grama longa e biruta de verdade. Só no fim de semana e com uma semana de aviso ao chefe de pista.",
    cost: 120,
    minLeadDays: 7,
    weekdays: [0, 6],
    distanceKm: 25,
    pressureHpa: 950,
    typicalDensityAltitudeM: 760,
    scenery: "aeroclub"
  },
  {
    id: "model-field",
    name: "Pista do Clube Asas do Planalto",
    description: "Pista de asfalto curta do clube de aeromodelismo, perto do campus. Quarta, sábado e domingo.",
    cost: 60,
    minLeadDays: 3,
    weekdays: [0, 3, 6],
    distanceKm: 12,
    pressureHpa: 940,
    typicalDensityAltitudeM: 860,
    scenery: "model-field"
  },
  {
    id: "farm",
    name: "Fazenda Boa Esperança (do Juca, ex-integrante)",
    description: "O Juca libera o pasto qualquer dia, é só avisar na véspera. Estrada de terra longa: o avião sacode na van.",
    cost: 30,
    minLeadDays: 1,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    distanceKm: 60,
    pressureHpa: 958,
    typicalDensityAltitudeM: 670,
    scenery: "farm"
  }
];

export function findVenue(id: string): TestVenue | undefined {
  return TEST_VENUES.find((venue) => venue.id === id);
}
