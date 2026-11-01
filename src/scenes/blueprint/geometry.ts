// Geometria do blueprint da Prancheta (design §6.1). Pura: AircraftDesign entra, medidas em metros saem.
// Eixos: x do nariz (0) para a cauda; y lateral (vista de cima, 0 = eixo da fuselagem); z altura sobre o solo (vista lateral).
// A cena só escala e desenha; nenhuma regra do jogo mora aqui, só o aspecto do avião.

import { DESIGN_LIMITS, type AircraftDesign, type DesignMaterial } from "../../sim";

export interface Surface {
  role: "wing" | "canard" | "tail";
  /** Posição x da raiz do bordo de ataque. */
  x: number;
  /** Envergadura total da superfície. */
  span: number;
  /** Corda na raiz. */
  chord: number;
  /** Deslocamento do bordo de ataque da ponta para trás (enflechamento). */
  sweep: number;
  /** Afilamento: quanto a corda da ponta encolhe em relação à raiz (0 = retangular). */
  taper: number;
  /** Altura da linha de corda sobre o solo. */
  z: number;
}

export type Hatch = "ribs" | "weave" | "mixed";

export interface BlueprintGeometry {
  /** Envergadura da asa principal (a cota do desenho). */
  wingspan: number;
  /** Comprimento total, do nariz à ponta da cauda. */
  length: number;
  fuselage: { length: number; width: number; height: number; z: number };
  surfaces: Surface[];
  fin: { x: number; chord: number; height: number };
  motor: { x: number; length: number; diameter: number; z: number };
  prop: { x: number; diameter: number };
  gear: { height: number; wheelDiameter: number; noseX: number; mainX: number; mainTrack: number };
  /** Folga da ponta da hélice até o solo (negativa = bate no chão). */
  propClearance: number;
  /** Espessura do perfil da asa na raiz. */
  airfoilThickness: number;
  /** Largura da longarina na vista de cima. */
  sparWidth: number;
  /** Posição da longarina na corda (fração do bordo de ataque). */
  sparAt: number;
  hatch: Hatch;
  /** Nervuras por semi-asa (balsa e misto). */
  ribs: number;
}

const POWER = DESIGN_LIMITS.powerW;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const unit = (value: number, min: number, max: number) => Math.min(1, Math.max(0, (value - min) / (max - min)));

/** Corda média relativa à envergadura (alongamento) por filosofia: alta carga = asa larga, leve = asa esguia. */
const CHORD_RATIO = { payload: 0.145, light: 0.105, stable: 0.125 } as const;
/** Largura da longarina, m. */
const SPAR_WIDTH = { payload: 0.032, light: 0.014, stable: 0.024 } as const;
const HATCH: Record<DesignMaterial, Hatch> = { balsa: "ribs", composite: "weave", mixed: "mixed" };
const RIB_SPACING = { balsa: 0.09, composite: 0.18, mixed: 0.12 } as const;

/** Altura da linha de centro do eixo do motor sobre o solo para cada trem; o diâmetro da hélice cabe nela. */
const GEAR_HEIGHT = { low: 0.15, high: 0.29 } as const;

export function blueprintGeometry(design: AircraftDesign): BlueprintGeometry {
  const { span, surfaces, powerW, philosophy, material, gear } = design;
  const flyingWing = surfaces === 1;

  const wingChord = span * CHORD_RATIO[philosophy] * (flyingWing ? 1.3 : 1);
  const fuselage = {
    length: flyingWing ? 0.55 + span * 0.12 : 0.8 + span * 0.3,
    width: 0.1 + span * 0.015,
    height: 0.14 + span * 0.02,
    z: GEAR_HEIGHT[gear] - 0.04
  };
  const power = unit(powerW, POWER.min, POWER.max);
  const motorDiameter = lerp(0.03, 0.055, power);
  const motor = { x: -lerp(0.06, 0.1, power), length: lerp(0.07, 0.11, power), diameter: motorDiameter, z: fuselage.z + fuselage.height / 2 };
  const prop = { x: motor.x - 0.02, diameter: lerp(0.26, 0.46, power) };
  const gearHeight = GEAR_HEIGHT[gear];

  const wingX = fuselage.length * (flyingWing ? 0.3 : 0.28);
  const list: Surface[] = [
    {
      role: "wing",
      x: wingX,
      span,
      chord: wingChord,
      sweep: flyingWing ? wingChord * 0.55 : 0,
      taper: flyingWing ? 0.35 : 0.1,
      z: fuselage.z + fuselage.height * 0.75
    }
  ];
  if (surfaces === 2) {
    const chord = wingChord * 0.62;
    list.push({ role: "tail", x: fuselage.length - chord * 0.9, span: span * 0.38, chord, sweep: 0, taper: 0, z: fuselage.z + fuselage.height * 0.55 });
  }
  if (surfaces === 3) {
    const chord = wingChord * 0.5;
    list.push({ role: "canard", x: 0.12, span: span * 0.3, chord, sweep: 0, taper: 0, z: fuselage.z + fuselage.height * 0.5 });
    const tail = wingChord * 0.55;
    list.push({ role: "tail", x: fuselage.length - tail * 0.9, span: span * 0.34, chord: tail, sweep: 0, taper: 0, z: fuselage.z + fuselage.height * 0.55 });
  }

  const finChord = flyingWing ? wingChord * 0.5 : wingChord * 0.6;
  return {
    wingspan: span,
    length: Math.max(fuselage.length, ...list.map((s) => s.x + s.chord)),
    fuselage,
    surfaces: list,
    fin: { x: fuselage.length - finChord * (flyingWing ? 0.6 : 0.9), chord: finChord, height: flyingWing ? 0.2 + span * 0.04 : 0.16 + span * 0.05 },
    motor,
    prop,
    gear: {
      height: gearHeight,
      wheelDiameter: lerp(0.08, 0.1, power),
      noseX: 0.18,
      mainX: wingX + wingChord * 0.55,
      mainTrack: Math.min(span * 0.22, 0.6)
    },
    // Eixo do motor a (gearHeight - 0.04 + height/2) do solo; o raio da hélice sai dele.
    propClearance: motor.z - prop.diameter / 2,
    airfoilThickness: wingChord * (philosophy === "payload" ? 0.14 : philosophy === "light" ? 0.1 : 0.12),
    sparWidth: SPAR_WIDTH[philosophy],
    sparAt: 0.28,
    hatch: HATCH[material],
    ribs: Math.max(3, Math.round(span / 2 / RIB_SPACING[material]))
  };
}
