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
  StageView,
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
    case "assembly":
    case "exhibition":
      return "work";
    case "inspection":
      return "bench";
    case "flights":
    case "takeoff":
      return "runway";
    case "awards":
      return "podium";
    default:
      return "gathering";
  }
}

/** Foco do bloco atual do evento; na dinâmica, o bloco depois do desafio olha para a pista de lançamento. */
export function focusForView(view: Pick<StageView, "kind" | "blocks" | "blockIndex" | "selection">): StageFocus {
  const block = view.blocks[view.blockIndex];
  if (view.selection && selectionPhase(view) === "launching") return "launch";
  return block ? focusForBlock(block.kind) : "gathering";
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

/** A partir de quantos grupos a dinâmica é "cheia" (dezenas de pessoas, Fase 9): bonecos menores e câmera mais aberta. */
export const CROWDED_GROUPS = 5;

export function isCrowded(view: Pick<StageView, "selection">): boolean {
  return (view.selection?.groups.length ?? 0) >= CROWDED_GROUPS;
}

/** Escala inteira dos bonecos: 2 normalmente, 1 na dinâmica cheia (trinta pessoas não cabem no pátio em 2x). */
export function figureScale(view: Pick<StageView, "selection">): 1 | 2 {
  return isCrowded(view) ? 1 : 2;
}

/** Zoom efetivo: a dinâmica cheia abre a câmera para mostrar todas as mesas. */
export function zoomForView(view: Pick<StageView, "kind" | "blocks" | "blockIndex" | "selection">): number {
  const setting = settingForEvent(view.kind);
  const focus = effectiveFocus(setting, focusForView(view));
  const zoom = zoomFor(setting, focus);
  return isCrowded(view) && setting === "campus" ? Math.min(zoom, CROWDED_ZOOM) : zoom;
}
const CROWDED_ZOOM = 1.6;

/** Altura (px) acima do centro da mesa onde fica a etiqueta do grupo (com fundo, para ler por cima da roda). */
export const GROUP_LABEL_OFFSET = 80;

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
  /** Roupa forçada: candidatos com roupa própria, capitães com a camiseta da equipe (dinâmica). */
  outfit?: "own" | "team";
  /** Um por grupo: quem ergue o planador antes do lançamento. */
  lifter?: boolean;
  /** Capitão que circula entre os grupos: a cena anda de parada em parada por `patrolStop`. */
  patrol?: Patrol;
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

/**
 * Mesas dos grupos: duas fileiras no pátio, centradas. Com 5 ou mais grupos (30 pessoas em grupos de 5–6,
 * Fase 9) as mesas chegam mais perto uma da outra e a fileira da frente desce um pouco.
 */
export function groupTables(count: number): Cell[] {
  const perRow = Math.max(1, Math.ceil(count / 2));
  const crowded = count > 4;
  const spacing = crowded ? 3.3 : 4.0;
  const base = crowded ? { col: 10, row: 4.4 } : { col: 10.5, row: 3.6 };
  const rowStep = crowded ? 2.5 : 2.6;
  return Array.from({ length: count }, (_, i) => {
    const inRow = Math.min(perRow, count - Math.floor(i / perRow) * perRow);
    const lateral = ((i % perRow) - (inRow - 1) / 2) * spacing;
    const depth = Math.floor(i / perRow);
    return { col: base.col + lateral * 0.7 + depth * rowStep, row: base.row - lateral * 0.7 + depth * rowStep };
  });
}

export interface Seat extends Cell {
  facing: 1 | -1;
}

/** Meia-medida da bancada (col × row), de onde sai a roda em volta dela. */
export const BENCH_HALF = { col: 0.75, row: 0.55 } as const;
/** Folga entre a borda da bancada e quem trabalha nela. */
const BENCH_REACH = 0.55;

/**
 * Lugares dos integrantes em volta da bancada, colados nela (elipse que contorna o tampo), cada um virado
 * para ela: quem está à esquerda do centro na tela olha para a direita e vice-versa.
 */
export function seatsAround(table: Cell, count: number): Seat[] {
  return Array.from({ length: count }, (_, k) => {
    const angle = Math.PI * 0.15 + (k / Math.max(1, count)) * Math.PI * 1.7;
    const col = table.col + Math.cos(angle) * (BENCH_HALF.col + BENCH_REACH);
    const row = table.row + Math.sin(angle) * (BENCH_HALF.row + BENCH_REACH);
    return { col, row, facing: col - row > table.col - table.row ? -1 : 1 };
  });
}

export type SelectionPhase = "kit" | "assembling" | "launching" | "landed";

/**
 * Em que ponto da dinâmica está o bloco atual. A simulação resolve o desafio de uma vez (os
 * planadores voam quando o jogador segue): enquanto o desafio é o bloco atual os grupos montam; no
 * bloco seguinte os planadores são lançados; depois ficam pousados.
 */
export function selectionPhase(view: Pick<StageView, "blocks" | "blockIndex">): SelectionPhase {
  const challenge = view.blocks.findIndex((b) => b.kind === "challenge");
  if (challenge < 0 || view.blockIndex < challenge) return "kit";
  if (view.blockIndex === challenge) return "assembling";
  return view.blockIndex === challenge + 1 ? "launching" : "landed";
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
/** Grupos que a pista comporta com o espaçamento cheio (os de antes da Fase 9). */
export const LANES_AT_FULL_STEP = 4;
/** Fundo da pista (row): com mais grupos, as faixas se apertam para não passar daqui. */
const LANE_BOTTOM = 11.8;

/** Espaço entre as faixas: cheio até 4 grupos, depois comprimido para caber 5 ou 6 na mesma pista. */
export function laneStep(groupCount: number): number {
  if (groupCount <= LANES_AT_FULL_STEP) return LAUNCH_LANE.rowStep;
  return Math.min(LAUNCH_LANE.rowStep, (LANE_BOTTOM - LAUNCH_LANE.row0) / (groupCount - 1));
}

/** Linha (row) da faixa do grupo. */
export function laneRow(groupIndex: number, groupCount: number): number {
  return LAUNCH_LANE.row0 + groupIndex * laneStep(groupCount);
}
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
export function gliderFrame(groupIndex: number, distanceM: number, t: number, groupCount = LANES_AT_FULL_STEP): GliderFrame {
  const row = laneRow(groupIndex, groupCount);
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
export function landedGlider(groupIndex: number, distanceM: number, groupCount = LANES_AT_FULL_STEP): GliderFrame {
  return gliderFrame(groupIndex, distanceM, 1e6, groupCount);
}

export function formatDistance(meters: number): string {
  return `${meters.toFixed(1).replace(".", ",")} m`;
}

// ------------------------------------------------------------------ planador na bancada

export interface GliderPart {
  id: "fuselage" | "wing" | "tail" | "ballast";
  /** Caixa montada, relativa ao centro da bancada. */
  c0: number;
  c1: number;
  r0: number;
  r1: number;
  /** Altura da peça (px). */
  h: number;
  /** Deslocamento (col, row) da peça solta sobre o tampo, no começo. */
  loose: Cell;
}

/** Peças do kit, na ordem em que são montadas: fuselagem, asa, empenagem e lastro na proa. */
export const GLIDER_PARTS: readonly GliderPart[] = [
  { id: "fuselage", c0: -0.45, c1: 0.45, r0: -0.05, r1: 0.05, h: 4, loose: { col: 0.05, row: 0.34 } },
  { id: "wing", c0: -0.1, c1: 0.18, r0: -0.5, r1: 0.5, h: 2, loose: { col: -0.4, row: 0 } },
  { id: "tail", c0: 0.32, c1: 0.46, r0: -0.2, r1: 0.2, h: 2, loose: { col: 0.2, row: -0.3 } },
  { id: "ballast", c0: -0.52, c1: -0.42, r0: -0.05, r1: 0.05, h: 4, loose: { col: 0.62, row: 0.05 } }
];

export interface PartFrame {
  /** 0 = solta sobre a mesa, 1 = no lugar. */
  k: number;
  /** Deslocamento (col, row) atual em relação à posição montada. */
  dc: number;
  dr: number;
  /** Quanto a peça sobe no ar enquanto viaja até o lugar (px). */
  lift: number;
}

/** Segundos que uma peça leva do tampo ao lugar. */
export const PART_TRAVEL_SECONDS = 2;

/** Quando a peça `index` começa a ser encaixada (s do bloco): o grupo atrasa um pouco e as peças vão em sequência. */
export function partStart(groupIndex: number, index: number): number {
  return groupIndex * 0.9 + index * (ASSEMBLY_SECONDS / KIT_PARTS);
}

/** Estado da peça `index` do grupo no instante t: solta até a hora dela, viaja ~2 s e fica montada. */
export function partFrame(groupIndex: number, index: number, t: number): PartFrame {
  const part = GLIDER_PARTS[index]!;
  const p = clamp01((t - partStart(groupIndex, index)) / PART_TRAVEL_SECONDS);
  const k = p * p * (3 - 2 * p);
  return { k, dc: part.loose.col * (1 - k), dr: part.loose.row * (1 - k), lift: Math.sin(p * Math.PI) * 6 };
}

/** Quanto do planador está montado (0 a 1): média das peças. */
export function assemblyProgress(groupIndex: number, t: number): number {
  let sum = 0;
  for (let i = 0; i < GLIDER_PARTS.length; i += 1) sum += partFrame(groupIndex, i, t).k;
  return sum / GLIDER_PARTS.length;
}

/**
 * Instante (s do bloco) que o desenho das peças usa em cada fase: soltas no começo (`kit`), em andamento
 * (`assembling`, o tempo do bloco) e todas no lugar depois (`launching`, `landed`).
 */
export function assemblyClock(phase: SelectionPhase, blockT: number): number {
  if (phase === "kit") return -1;
  if (phase === "assembling") return blockT;
  return 1e6;
}

/** Altura (px) da mão do candidato que ergue o planador acima da própria cabeça. */
export function heldHeight(figureScale: number): number {
  return 48 * figureScale + 8;
}

export interface FlightFrame extends GliderFrame {
  /** Ainda nas mãos de quem ergue, antes do arremesso. */
  held: boolean;
}

/**
 * Voo do planador que sai da mão de quem o ergue na bancada (`start`) e pousa na faixa do grupo, a
 * `distanceM` (da simulação) do início da pista. Antes de `launchStart` fica erguido; depois sobe em
 * arco e desce até o pouso. `t` é o tempo do bloco; `1e6` dá o planador pousado.
 */
export function flightFrame(start: Cell, groupIndex: number, distanceM: number, t: number, groupCount = LANES_AT_FULL_STEP, holdZ = 56): FlightFrame {
  const row = laneRow(groupIndex, groupCount);
  const share = clamp01(distanceM / LANE_FULL_M);
  const endCol = LAUNCH_LANE.col0 + share * LAUNCH_LANE.length;
  const duration = 1.6 + share * 2.4;
  const p = clamp01((t - launchStart(groupIndex)) / duration);
  const eased = 1 - (1 - p) * (1 - p);
  return {
    col: start.col + (endCol - start.col) * eased,
    row: start.row + (row - start.row) * eased,
    z: p >= 1 ? 3 : holdZ * (1 - eased) + 3 * eased + 4 * 34 * p * (1 - p),
    landed: p >= 1,
    held: t < launchStart(groupIndex)
  };
}

// ------------------------------------------------------------------ capitães

export interface Patrol {
  /** Paradas ao lado de cada bancada. */
  stops: Cell[];
  /** Onde este capitão começa na ronda (para dois capitães não pararem no mesmo grupo). */
  offset: number;
}

/** Segundos que o capitão fica em cada bancada. */
export const PATROL_SECONDS = 6;

/** Parada do capitão ao lado da bancada. */
export function patrolStops(tables: Cell[]): Cell[] {
  return tables.map((table) => ({ col: table.col + 0.9, row: table.row + 1.9 }));
}

export function patrolStop(patrol: Patrol, t: number): Cell {
  const n = patrol.stops.length;
  return patrol.stops[(Math.floor(Math.max(0, t) / PATROL_SECONDS) + patrol.offset) % n]!;
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
  return kind === "flights" || kind === "takeoff" ? "flight" : null;
}

/** Janela da cena embutida, em frações da tela. A UI posiciona o `PhaserStage` do voo/fila nela. */
export const FRAME_WINDOW = { x: 0.1, y: 0.13, w: 0.8, h: 0.62 } as const;

// ------------------------------------------------------------------ plano completo

/**
 * Tudo o que está em pé no cenário: a equipe, os candidatos em volta das mesas e os fiscais.
 * Puro: a EventStage só reconcilia estes planos com os bonecos que já existem.
 */
export function planFigures(view: StageView): FigurePlan[] {
  const setting = settingForEvent(view.kind);
  const focus = effectiveFocus(setting, focusForView(view));
  const plans: FigurePlan[] = [];

  const slots = crewSlots(view.crew.length, setting, focus);
  const stops = patrolStops(view.selection ? groupTables(view.selection.groups.length) : []);
  view.crew.forEach((person, k) => {
    // Na dinâmica a equipe são os capitães: camiseta da equipe, circulando entre os grupos.
    if (stops.length > 0) {
      const patrol: Patrol = { stops, offset: Math.floor((k * stops.length) / view.crew.length) };
      const first = patrolStop(patrol, 0);
      plans.push({ id: `crew:${person.id}`, role: "crew", look: person.look, col: first.col, row: first.row, facing: 1, pose: "stand", outfit: "team", patrol });
      return;
    }
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
      // Em todas as fases o grupo fica em volta da sua bancada; os planadores saem dali.
      const seats = seatsAround(tables[g]!, group.members.length);
      group.members.forEach((person, k) => {
        plans.push({
          id: `cand:${person.id}`,
          role: "candidate",
          look: person.look,
          col: seats[k]!.col,
          row: seats[k]!.row,
          facing: seats[k]!.facing,
          pose: phase === "assembling" ? "work" : "stand",
          groupId: group.id,
          outfit: "own",
          ...(k === 0 ? { lifter: true } : {})
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
