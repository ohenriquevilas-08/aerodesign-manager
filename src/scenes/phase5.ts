// Contrato da Fase 5 que ainda vive na frente de Simulação (S1 e S3). Declarado aqui com os nomes
// exatos do contrato (docs/phases/fase-5.md) para as cenas andarem; quando a simulação integrar,
// trocar pelos tipos de `../sim` e apagar este arquivo (ponto de troca no architecture.md, seção Cenas).

import type { AircraftDesign, FlightPlayback } from "../sim";

/** Campos novos de AircraftDesign (S1). */
export interface DesignPhase5 {
  /** Corda média, m (alongamento = b / corda). */
  chordM: number;
  wingPosition: "high" | "low";
  /** Volume de cauda horizontal, ~0,3–0,7. */
  tailVolume: number;
  /** Posição do CG em % da CMA. */
  cgPercentMac: number;
  /** Diâmetro da hélice, polegadas. */
  propDiameterIn: number;
}

export type BlueprintDesign = AircraftDesign & Partial<DesignPhase5>;

export const PHASE5_DEFAULTS: DesignPhase5 = { chordM: 0.32, wingPosition: "high", tailVolume: 0.5, cgPercentMac: 25, propDiameterIn: 14 };

/** Aparência do integrante (S3). Índices apontam para as tabelas de `people/avatar.ts`. */
export interface MemberLook {
  skin: number;
  hair: number;
  hairColor: number;
  /** Cor da camiseta (a da equipe), 0xRRGGBB. */
  shirt: number;
  accessory?: "glasses" | "cap" | "headband";
}

export const DEFAULT_LOOK: MemberLook = { skin: 1, hair: 0, hairColor: 0, shirt: 0x22c7e6 };

/** Margem estática e ponto neutro, % da CMA (S1: `stabilityEstimate`, valores centrais). */
export interface StaticMargin {
  neutralPointPercentMac: number;
  marginPercentMac: number;
}

/** Stub: cauda maior empurra o ponto neutro para trás. Trocar por `stabilityEstimate(design)`. */
export function staticMarginStub(design: BlueprintDesign): StaticMargin {
  const tailVolume = design.tailVolume ?? PHASE5_DEFAULTS.tailVolume;
  const cg = design.cgPercentMac ?? PHASE5_DEFAULTS.cgPercentMac;
  const neutralPointPercentMac = 25 + (tailVolume - 0.3) * 60;
  return { neutralPointPercentMac, marginPercentMac: neutralPointPercentMac - cg };
}

export type MarginBand = "ok" | "risk" | "unstable";

/** Faixa da margem para a cor do desenho: negativa = instável, 5–20% = ok, resto = risco. */
export function marginBand(marginPercentMac: number): MarginBand {
  if (marginPercentMac < 0) return "unstable";
  return marginPercentMac >= 5 && marginPercentMac <= 20 ? "ok" : "risk";
}

/** Camisetas do stub, no lugar da cor da equipe (S3: `Member.look.shirt`). */
const STUB_SHIRTS = [0xff9f2e, 0x22c7e6, 0x3fd18b, 0xffc23d, 0xff5a5f];
const ACCESSORIES: (MemberLook["accessory"] | undefined)[] = [undefined, "glasses", undefined, "cap", "headband", undefined];

/**
 * Aparência de um integrante: `member.look` quando a simulação já sorteia (S3); até lá, uma aparência
 * estável derivada do id, para o hangar e a carta mostrarem sempre o mesmo boneco.
 */
export function lookFor(member: { id: string; look?: MemberLook }): MemberLook {
  if (member.look) return member.look;
  let h = 7;
  for (const ch of member.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { skin: h % 6, hair: (h >> 3) % 5, hairColor: (h >> 6) % 6, shirt: STUB_SHIRTS[(h >> 9) % STUB_SHIRTS.length]!, accessory: ACCESSORIES[(h >> 12) % ACCESSORIES.length] };
}

/**
 * Ensaio de voo agendado, pronto para tocar (S2: um `FlightPlayback` por carga planejada).
 * `venueId` escolhe o cenário; `crew` são os bonecos da vinheta de chegada.
 */
export interface FlightTestSession {
  venueId: string;
  venueName: string;
  crew: MemberLook[];
  flights: FlightPlayback[];
}
