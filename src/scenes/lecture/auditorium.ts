// Lógica pura do auditório da palestra (Fase 9, C1): cadeiras, quem senta onde conforme quantos vieram,
// a entrada da plateia, o palco e os slides. A LectureScene só desenha o que sai daqui.
// Coordenadas (col, row) são as do piso isométrico de hangar/iso.ts. O palco fica na parede da coluna 0
// (à esquerda na tela) e a plateia olha para ele (para -col), em fileiras que correm ao longo de `row`.

export const ROOM = { cols: 17, rows: 14 } as const;

/** Palco: plataforma encostada na parede da coluna 0. */
export const STAGE = { col0: 0, col1: 3.8, row0: 1.4, row1: 12.6, height: 12 } as const;

/** Cadeiras: `LINES` fileiras (da mais próxima do palco à mais distante) de `PER_LINE` lugares. */
export const LINES = 9;
export const PER_LINE = 12;
export const CAPACITY = LINES * PER_LINE;
const FIRST_LINE_COL = 5.2;
const LINE_STEP = 1.1;
const FIRST_ROW = 1.9;
const ROW_STEP = 0.96;

/** Porta do fundo (canto da plateia): por onde o público entra. */
export const DOOR = { col: 16.6, row: 13.4 } as const;
/** Corredor de trás das cadeiras, onde a plateia anda antes de sentar. */
export const BACK_AISLE_ROW = 13.3;
/** Quem passa da capacidade fica em pé atrás da última fileira. */
export const STANDING_COL = FIRST_LINE_COL + (LINES - 1) * LINE_STEP + 1.5;
export const STANDING_CAPACITY = 24;

export interface Cell {
  col: number;
  row: number;
}

export interface Seat extends Cell {
  index: number;
  line: number;
  slot: number;
}

export function seatAt(line: number, slot: number): Seat {
  return {
    index: line * PER_LINE + slot,
    line,
    slot,
    col: FIRST_LINE_COL + line * LINE_STEP,
    row: FIRST_ROW + slot * ROW_STEP
  };
}

/** Todas as cadeiras, fileira por fileira. */
export function seats(): Seat[] {
  return Array.from({ length: CAPACITY }, (_, i) => seatAt(Math.floor(i / PER_LINE), i % PER_LINE));
}

/** Ruído estável de 0 a 1 por cadeira (sem `Math.random`). */
function seatNoise(index: number): number {
  let h = Math.imul(index + 1, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 0x100000000;
}

/**
 * Ordem em que as cadeiras enchem: perto do palco e do meio primeiro, com ruído para não formar um
 * bloco perfeito. Quem chega depois só ocupa cadeiras que vêm depois nesta lista, então com mais gente
 * a sala enche sem ninguém trocar de lugar.
 */
export function seatOrder(): Seat[] {
  const score = (seat: Seat) => seat.line * 0.9 + Math.abs(seat.slot - (PER_LINE - 1) / 2) * 0.3 + seatNoise(seat.index) * 2.2;
  return seats().sort((a, b) => score(a) - score(b) || a.index - b.index);
}

const ORDER = seatOrder();

export interface AudienceSpot extends Cell {
  /** Cadeira (`Seat.index`); `null` para quem está em pé. */
  seat: number | null;
}

/** Em pé, atrás da plateia, em duas fileiras que correm ao longo de `row`. */
export function standingSpot(k: number): Cell {
  const perRow = STANDING_CAPACITY / 2;
  const slot = k % perRow;
  const rank = Math.floor(k / perRow);
  return { col: STANDING_COL + rank * 0.9, row: FIRST_ROW + (slot + (rank % 2) * 0.5) * ((PER_LINE - 1) * ROW_STEP / (perRow - 1)) };
}

/**
 * Onde cada um dos `count` presentes fica: as primeiras cadeiras da ordem e, passando de `CAPACITY`,
 * em pé no fundo (até `STANDING_CAPACITY`; o excedente some, a sala está cheia).
 */
export function placeAudience(count: number): AudienceSpot[] {
  const total = Math.min(Math.max(0, Math.floor(count)), CAPACITY + STANDING_CAPACITY);
  return Array.from({ length: total }, (_, i) => {
    if (i < CAPACITY) {
      const seat = ORDER[i]!;
      return { col: seat.col, row: seat.row, seat: seat.index };
    }
    return { ...standingSpot(i - CAPACITY), seat: null };
  });
}

/** Ocupação da sala: 0 a 1 das cadeiras ocupadas. */
export function occupancy(count: number): number {
  return Math.min(1, Math.max(0, count) / CAPACITY);
}

// ------------------------------------------------------------------ entrada da plateia

/** Duração total da fila entrando (s), qualquer que seja o número de presentes. */
export const ARRIVAL_SPAN = 4;
export const WALK_SPEED = 5.5; // casas por segundo

/** Instante (s) em que o presente de ordem `order` sai da porta. */
export function arrivalTime(order: number, count: number): number {
  return order * Math.min(0.12, ARRIVAL_SPAN / Math.max(1, count));
}

export interface AudienceFrame extends Cell {
  visible: boolean;
  walking: boolean;
  facing: 1 | -1;
}

/** Trajeto da porta ao lugar: pelo corredor do fundo até a fileira e daí até o lugar. */
export function walkPath(spot: Cell): Cell[] {
  return [
    { col: DOOR.col, row: DOOR.row },
    { col: spot.col, row: BACK_AISLE_ROW },
    { col: spot.col, row: spot.row }
  ];
}

export function pathLength(path: Cell[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) total += Math.hypot(path[i]!.col - path[i - 1]!.col, path[i]!.row - path[i - 1]!.row);
  return total;
}

/** Duração (s) do trajeto de quem vai para `spot`. */
export function walkDuration(spot: Cell): number {
  return pathLength(walkPath(spot)) / WALK_SPEED;
}

/**
 * Posição de quem é o `order`-ésimo a entrar, no instante t (s) desde que a palestra abriu. Antes da hora
 * espera fora da porta (invisível); depois de chegar fica sentado de frente para o palco (facing -1).
 */
export function audienceFrame(spot: Cell, order: number, count: number, t: number): AudienceFrame {
  const start = arrivalTime(order, count);
  const path = walkPath(spot);
  if (t < start) return { ...path[0]!, visible: false, walking: false, facing: -1 };
  let left = (t - start) * WALK_SPEED;
  for (let i = 1; i < path.length; i += 1) {
    const from = path[i - 1]!;
    const to = path[i]!;
    const len = Math.hypot(to.col - from.col, to.row - from.row);
    if (left <= len && len > 0) {
      const k = left / len;
      const dc = to.col - from.col;
      const dr = to.row - from.row;
      return {
        col: from.col + dc * k,
        row: from.row + dr * k,
        visible: true,
        walking: true,
        // Mesma regra da EventStage: para a direita da tela = front-right.
        facing: dc - dr > 0 ? 1 : -1
      };
    }
    left -= len;
  }
  return { col: spot.col, row: spot.row, visible: true, walking: false, facing: -1 };
}

/** Tempo (s) até todo mundo estar sentado. */
export function settleTime(spots: Cell[]): number {
  let last = 0;
  spots.forEach((spot, order) => {
    last = Math.max(last, arrivalTime(order, spots.length) + walkDuration(spot));
  });
  return last;
}

// ------------------------------------------------------------------ palco

/** Lugares de quem está no palco: o primeiro no atril, ao lado do telão; os outros logo atrás dele, na frente do palco. */
export function stageSpots(count: number): (Cell & { facing: 1 | -1 })[] {
  return Array.from({ length: count }, (_, i) => {
    if (i === 0) return { col: 2.5, row: 9.4, facing: 1 as const };
    return { col: 2.4, row: Math.min(STAGE.row1 - 0.4, 10.9 + i * 0.8), facing: 1 as const };
  });
}

/** Atril do apresentador. */
export const LECTERN = { col0: 2.9, col1: 3.5, row0: 9.9, row1: 10.5 } as const;

// ------------------------------------------------------------------ slides

export interface Slide {
  title: string;
  lines: string[];
}

/** Os slides da apresentação; o primeiro leva o nome da equipe. */
export function slidesFor(teamName: string): Slide[] {
  return [
    { title: teamName, lines: ["Seletiva de novos integrantes", "Obrigado por virem"] },
    { title: "Quem somos", lines: ["Estudantes que projetam,", "constroem e voam um avião", "de carga com rádio controle"] },
    { title: "A competição", lines: ["Competição Aerodesign Brasil", "Relatório, apresentação oral", "e voos de carga"] },
    { title: "Como entrar", lines: ["1. Esta palestra", "2. Dinâmica em grupos", "3. Entrevista", "4. Treinamento de trainee"] },
    { title: "Perguntas?", lines: ["Quem quiser seguir,", "fique de olho no e-mail"] }
  ];
}

export const SECONDS_PER_SLIDE = 7;

/** Slide do instante t (s), dando a volta no fim; `forced` (índice) manda no ritmo automático. */
export function slideAt(t: number, count: number, forced: number | null = null): number {
  if (count <= 0) return 0;
  if (forced !== null) return ((Math.floor(forced) % count) + count) % count;
  return Math.floor(Math.max(0, t) / SECONDS_PER_SLIDE) % count;
}

// ------------------------------------------------------------------ rótulo do contador

/** "55 de 92 vieram" (ou "55 presentes" sem o total de inscritos). */
export function attendanceLabel(present: number, registered: number | null): string {
  if (registered === null || registered < present) return `${present} ${present === 1 ? "presente" : "presentes"}`;
  return `${present} de ${registered} ${present === 1 ? "veio" : "vieram"}`;
}
