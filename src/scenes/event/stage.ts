// Lógica pura da moldura de evento (Fase 7, C1 a C3): cenário por evento e bloco, foco da câmera,
// hora do dia no céu, posição da equipe, mesas e lançamentos da dinâmica, luzes da inspeção e a
// janela onde roda a FlightScene/QueueScene. A EventStage só desenha o que sai daqui.
// Coordenadas (col, row) são as do piso isométrico de hangar/iso.ts.

import type { MemberLook } from "../../sim";
import { palette } from "../palette";
import { sunElevation, sunProgress } from "../queue/queueView";
import type {
  EventBlockKind,
  EventKind,
  EventView,
  InspectionItemView,
  InspectionStatus,
  SelectionGroupView
} from "./contract";

export type StageSetting = "campus" | "aeroclub" | "competition";
export type StageFocus = "gathering" | "work" | "bench" | "runway" | "launch" | "podium";
export type Pose = "stand" | "work";

/** Piso do cenário: todos os cenários usam a mesma grade. */
export const GRID = { cols: 18, rows: 12 } as const;

export interface Cell {
  col: number;
  row: number;
}

export function settingForEvent(kind: EventKind): StageSetting {
  if (kind === "selection-day") return "campus";
  if (kind === "flight-test") return "aeroclub";
  return "competition";
}

/** Para onde a câmera olha em cada bloco. */
export function focusForBlock(kind: EventBlockKind): StageFocus {
  switch (kind) {
    case "challenge":
    case "setup":
    case "exhibit":
    case "repair":
      return "work";
    case "inspection":
      return "bench";
    case "queue":
    case "flight":
      return "runway";
    case "launch":
      return "launch";
    case "ceremony":
      return "podium";
    default:
      return "gathering";
  }
}

/** Pontos de interesse do cenário; o foco que o cenário não tem cai em `gathering`. */
const ANCHORS: Record<StageSetting, Partial<Record<StageFocus, Cell>> & { gathering: Cell }> = {
  campus: { gathering: { col: 9, row: 5.5 }, work: { col: 9, row: 5.5 }, launch: { col: 9.5, row: 9 } },
  aeroclub: {
    gathering: { col: 6, row: 5.5 },
    work: { col: 4.5, row: 5 },
    bench: { col: 6.5, row: 5 },
    runway: { col: 9, row: 9 },
    launch: { col: 9, row: 9 }
  },
  competition: {
    gathering: { col: 8, row: 6 },
    work: { col: 5, row: 5 },
    bench: { col: 9, row: 4.5 },
    runway: { col: 9, row: 9.5 },
    launch: { col: 9, row: 9.5 },
    podium: { col: 14, row: 5 }
  }
};

export function anchorFor(setting: StageSetting, focus: StageFocus): Cell {
  return ANCHORS[setting][focus] ?? ANCHORS[setting].gathering;
}

const FOCUS_ZOOM: Record<StageFocus, number> = {
  gathering: 1.15,
  work: 1.45,
  bench: 1.75,
  runway: 1.05,
  launch: 1.1,
  podium: 1.4
};

/** Foco efetivo no cenário (o que o cenário não tem vira `gathering`). */
export function effectiveFocus(setting: StageSetting, focus: StageFocus): StageFocus {
  return ANCHORS[setting][focus] ? focus : "gathering";
}

/** Zoom relativo ao enquadramento base da cena (1 = a grade inteira cabe na tela). */
export function zoomFor(setting: StageSetting, focus: StageFocus): number {
  return FOCUS_ZOOM[effectiveFocus(setting, focus)];
}

// ------------------------------------------------------------------ céu

export interface SkyState {
  /** 0 = dia, 1 = noite fechada. */
  night: number;
  /** 0 a 1: quanto o céu está alaranjado (nascer e pôr do sol). */
  warm: number;
  sunProgress: number;
  elevation: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function skyAt(hour: number): SkyState {
  const elevation = sunElevation(hour);
  return {
    night: clamp01((0.08 - elevation) / 0.28),
    warm: elevation >= 0 ? clamp01(1 - elevation / 0.35) : 0,
    sunProgress: sunProgress(hour),
    elevation
  };
}

// ------------------------------------------------------------------ equipe

export interface FigurePlan {
  /** Estável entre leituras: a cena anima o caminho de um lugar ao outro. */
  id: string;
  role: "crew" | "candidate" | "inspector";
  look: MemberLook;
  col: number;
  row: number;
  facing: 1 | -1;
  pose: Pose;
  groupId?: string;
}

/** Onde a equipe se junta em cada cenário e foco. */
const CREW_ANCHOR: Record<StageSetting, Partial<Record<StageFocus, Cell>> & { gathering: Cell }> = {
  campus: { gathering: { col: 4, row: 6.5 }, launch: { col: 7, row: 7.6 } },
  aeroclub: {
    gathering: { col: 7.5, row: 6 },
    work: { col: 4.5, row: 6.4 },
    bench: { col: 6.5, row: 6.4 },
    runway: { col: 8, row: 7.4 },
    launch: { col: 8, row: 7.4 }
  },
  competition: {
    gathering: { col: 8, row: 7 },
    work: { col: 5, row: 6.3 },
    bench: { col: 9, row: 6.2 },
    runway: { col: 8, row: 7.9 },
    launch: { col: 8, row: 7.9 },
    podium: { col: 12.5, row: 6.5 }
  }
};

/** Lugares da equipe: fileiras de até 4 voltadas para a tela, centradas na âncora. */
export function crewSlots(count: number, setting: StageSetting, focus: StageFocus): Cell[] {
  const base = CREW_ANCHOR[setting][focus] ?? CREW_ANCHOR[setting].gathering;
  const perRow = 4;
  return Array.from({ length: count }, (_, k) => {
    const inRow = Math.min(perRow, count - Math.floor(k / perRow) * perRow);
    const lateral = ((k % perRow) - (inRow - 1) / 2) * 1.4;
    const depth = Math.floor(k / perRow) * 0.85;
    // Lateral na tela = col crescendo e row diminuindo; fundo = os dois crescendo.
    return { col: base.col + lateral * 0.7 + depth * 0.7, row: base.row - lateral * 0.7 + depth * 0.7 };
  });
}

function crewFacing(focus: StageFocus, k: number, count: number): 1 | -1 {
  if (focus === "runway" || focus === "launch" || focus === "podium") return 1;
  if (focus === "bench") return -1;
  return k < count / 2 ? 1 : -1;
}

function crewPose(focus: StageFocus): Pose {
  return focus === "work" ? "work" : "stand";
}

/** Fiscais da inspeção técnica: colete na cor de aviso. */
export const INSPECTOR_LOOKS: MemberLook[] = [
  { skin: 2, hair: 1, hairColor: 5, shirt: palette.warn, accessory: "cap" },
  { skin: 4, hair: 0, hairColor: 0, shirt: palette.warn, accessory: "glasses" },
  { skin: 1, hair: 3, hairColor: 2, shirt: palette.warn }
];

/** Bancada da inspeção técnica no pátio da competição. */
export const INSPECTION_BENCH = { col0: 8.2, col1: 10.4, row0: 3.9, row1: 4.9 } as const;
/** Bancada de checagem do aeroclube. */
export const CHECK_BENCH = { col0: 5.7, col1: 7.4, row0: 4.4, row1: 5.3 } as const;

/** Fiscais do outro lado da bancada, olhando para o avião. */
export function inspectorSlots(count: number = INSPECTOR_LOOKS.length): Cell[] {
  const mid = (INSPECTION_BENCH.col0 + INSPECTION_BENCH.col1) / 2;
  return Array.from({ length: count }, (_, i) => {
    const lateral = (i - (count - 1) / 2) * 0.9;
    return { col: mid + lateral * 0.7, row: INSPECTION_BENCH.row0 - 0.5 - lateral * 0.7 };
  });
}

// ------------------------------------------------------------------ dinâmica da seletiva

/** Mesas dos grupos: até duas fileiras no pátio, centradas. */
export function groupTables(count: number): Cell[] {
  const perRow = Math.max(1, Math.ceil(count / 2));
  return Array.from({ length: count }, (_, i) => {
    const inRow = Math.min(perRow, count - Math.floor(i / perRow) * perRow);
    const lateral = ((i % perRow) - (inRow - 1) / 2) * 4.0;
    const depth = Math.floor(i / perRow);
    return { col: 10.5 + lateral * 0.7 + depth * 2.6, row: 3.6 - lateral * 0.7 + depth * 2.6 };
  });
}

export interface Seat extends Cell {
  facing: 1 | -1;
}

/** Lugares dos integrantes em volta da mesa (de frente para ela). */
export function seatsAround(table: Cell, count: number): Seat[] {
  return Array.from({ length: count }, (_, k) => {
    const angle = Math.PI * 0.15 + (k / Math.max(1, count)) * Math.PI * 1.7;
    const col = table.col + Math.cos(angle) * 1.5;
    const row = table.row + Math.sin(angle) * 1.5;
    return { col, row, facing: col > table.col ? -1 : 1 };
  });
}

export type SelectionPhase = "kit" | "assembling" | "launching" | "landed";

/** Em que ponto da dinâmica está o bloco atual: depende da ordem dos blocos do dia. */
export function selectionPhase(view: Pick<EventView, "blocks" | "blockIndex">): SelectionPhase {
  const challenge = view.blocks.findIndex((b) => b.kind === "challenge");
  const launch = view.blocks.findIndex((b) => b.kind === "launch");
  if (launch >= 0 && view.blockIndex > launch) return "landed";
  if (launch >= 0 && view.blockIndex === launch) return "launching";
  if (challenge >= 0 && view.blockIndex > challenge) return "launching";
  if (challenge >= 0 && view.blockIndex === challenge) return "assembling";
  return "kit";
}

/** Segundos de cena que o grupo leva para montar o planador. */
export const ASSEMBLY_SECONDS = 16;
/** Peças do kit: fuselagem, asa, empenagem, lastro. */
export const KIT_PARTS = 4;

/** Quantas peças já estão montadas no instante t do bloco (cada grupo atrasa um pouco). */
export function assemblyParts(groupIndex: number, t: number): number {
  const progress = clamp01((t - groupIndex * 0.9) / ASSEMBLY_SECONDS);
  return Math.floor(progress * KIT_PARTS + 1e-9);
}

/** Linha de lançamento: a pista de cada grupo corre em col, uma por row. */
export const LAUNCH_LANE = { col0: 3.2, length: 13, row0: 8.9, rowStep: 0.85 } as const;
/** Distância de lançamento que enche a pista inteira (m). */
export const LANE_FULL_M = 25;

export interface GliderFrame extends Cell {
  /** Altura (px). */
  z: number;
  landed: boolean;
}

/** Quando o grupo lança (s do bloco): um atrás do outro. */
export function launchStart(groupIndex: number): number {
  return 1 + groupIndex * 1.3;
}

/**
 * Trajetória do planador do grupo: sai da mão, sobe em arco e pousa a `distanceM` (da simulação)
 * do início da pista. `t` é o tempo do bloco; `landed` depois do pouso.
 */
export function gliderFrame(groupIndex: number, distanceM: number, t: number): GliderFrame {
  const row = LAUNCH_LANE.row0 + groupIndex * LAUNCH_LANE.rowStep;
  const share = clamp01(distanceM / LANE_FULL_M);
  const duration = 1.6 + share * 2.4;
  const p = clamp01((t - launchStart(groupIndex)) / duration);
  const eased = 1 - (1 - p) * (1 - p);
  return {
    col: LAUNCH_LANE.col0 + share * LAUNCH_LANE.length * eased,
    row,
    z: p >= 1 ? 3 : 22 + 4 * 34 * p * (1 - p),
    landed: p >= 1
  };
}

/** Planador pousado no fim da pista (blocos depois do lançamento). */
export function landedGlider(groupIndex: number, distanceM: number): GliderFrame {
  return gliderFrame(groupIndex, distanceM, 1e6);
}

export function formatDistance(meters: number): string {
  return `${meters.toFixed(1).replace(".", ",")} m`;
}

/** Candidatos do grupo atrás da linha de lançamento, vendo o planador voar. */
function launchSeats(groupIndex: number, group: SelectionGroupView): Seat[] {
  const row = LAUNCH_LANE.row0 + groupIndex * LAUNCH_LANE.rowStep;
  return group.members.map((_, k) => ({ col: LAUNCH_LANE.col0 - 0.8 - k * 0.5, row: row + 0.1, facing: 1 as const }));
}

// ------------------------------------------------------------------ inspeção

const LIGHT_COLOR: Record<InspectionStatus, number> = {
  ok: palette.ok,
  pending: palette.warn,
  fail: palette.danger
};

export interface InspectionLight {
  color: number;
  /** Pendência pisca; o resto fica aceso. */
  blink: boolean;
}

export function inspectionLights(items: InspectionItemView[]): InspectionLight[] {
  return items.map((item) => ({ color: LIGHT_COLOR[item.status], blink: item.status === "pending" }));
}

export function inspectionTally(items: InspectionItemView[]): Record<InspectionStatus, number> {
  const tally: Record<InspectionStatus, number> = { ok: 0, pending: 0, fail: 0 };
  for (const item of items) tally[item.status] += 1;
  return tally;
}

// ------------------------------------------------------------------ janela do voo e da fila

export type FramedScene = "flight" | "queue";

/** A cena do voo ou da fila que roda dentro da moldura neste bloco (null = só o cenário do evento). */
export function framedSceneFor(kind: EventBlockKind): FramedScene | null {
  if (kind === "flight") return "flight";
  if (kind === "queue") return "queue";
  return null;
}

/** Janela da cena embutida, em frações da tela. A UI posiciona o `PhaserStage` do voo/fila nela. */
export const FRAME_WINDOW = { x: 0.1, y: 0.13, w: 0.8, h: 0.62 } as const;

// ------------------------------------------------------------------ plano completo

/**
 * Tudo o que está em pé no cenário: a equipe, os candidatos em volta das mesas e os fiscais.
 * Puro: a EventStage só reconcilia estes planos com os bonecos que já existem.
 */
export function planFigures(view: EventView): FigurePlan[] {
  const setting = settingForEvent(view.kind);
  const block = view.blocks[view.blockIndex];
  const focus = effectiveFocus(setting, block ? focusForBlock(block.kind) : "gathering");
  const plans: FigurePlan[] = [];

  const slots = crewSlots(view.crew.length, setting, focus);
  view.crew.forEach((person, k) => {
    plans.push({
      id: `crew:${person.id}`,
      role: "crew",
      look: person.look,
      col: slots[k]!.col,
      row: slots[k]!.row,
      facing: crewFacing(focus, k, view.crew.length),
      pose: crewPose(focus)
    });
  });

  if (view.selection) {
    const tables = groupTables(view.selection.groups.length);
    const phase = selectionPhase(view);
    view.selection.groups.forEach((group, g) => {
      const seats =
        phase === "launching" || phase === "landed" ? launchSeats(g, group) : seatsAround(tables[g]!, group.members.length);
      group.members.forEach((person, k) => {
        plans.push({
          id: `cand:${person.id}`,
          role: "candidate",
          look: person.look,
          col: seats[k]!.col,
          row: seats[k]!.row,
          facing: seats[k]!.facing,
          pose: phase === "assembling" ? "work" : "stand",
          groupId: group.id
        });
      });
    });
  }

  if (view.kind === "competition" && focus === "bench") {
    inspectorSlots().forEach((spot, i) => {
      plans.push({
        id: `inspector:${i}`,
        role: "inspector",
        look: INSPECTOR_LOOKS[i % INSPECTOR_LOOKS.length]!,
        col: spot.col,
        row: spot.row,
        facing: -1,
        pose: "work"
      });
    });
  }
  return plans;
}
