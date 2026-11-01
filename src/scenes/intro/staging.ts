// Encenação da abertura (Fase 6, C1): onde cada fundador para na sala do orientador, em que ordem
// entram e por onde andam. Puro: a IntroScene só desenha o que sai daqui.
// Coordenadas em tiles da grade isométrica da sala (hangar/iso.ts): coluna cresce para baixo-direita,
// linha para baixo-esquerda. A porta fica na parede esquerda (coluna 0); a mesa do orientador, na frente.

export const ROOM = { cols: 9, rows: 9 } as const;

/** Onde a porta abre na parede esquerda: os fundadores entram por ela andando ao longo das colunas. */
export const DOOR = { col: 0, row: 4.5 } as const;

/** Primeiro ponto do trajeto: um passo fora da porta, onde o fundador surge. */
export const DOOR_START = { col: -0.6, row: 4.5 } as const;

/** Mesa do orientador, no primeiro plano; os fundadores ficam de frente para ela. */
export const DESK = { col0: 2.6, col1: 6.6, row0: 6.3, row1: 7.5 } as const;

/** Linha de quem fala primeiro; a segunda fileira (a partir de 5 fundadores) fica atrás. */
const FRONT_ROW = 4.9;
const BACK_ROW = 3.8;
const PER_ROW = 4;
const SPACING = 1.25;
/** Centro da fileira, alinhado com a mesa. */
const CENTER_COL = (DESK.col0 + DESK.col1) / 2 + 0.6;

/** Velocidade de caminhada, tiles por segundo. */
export const WALK_SPEED = 2.2;
/** Intervalo entre a entrada de um fundador e a do seguinte, s. */
export const ENTRY_GAP = 0.55;

export interface Slot {
  col: number;
  row: number;
}

export interface FounderFrame extends Slot {
  /** Ainda não passou pela porta. */
  visible: boolean;
  /** Em movimento (o corpo balança). */
  walking: boolean;
  /** 1 = andando para +coluna (de costas para a porta); −1 = de frente para a mesa. */
  facing: 1 | -1;
}

/** Lugares de `count` fundadores: fileiras centralizadas, a da frente primeiro. */
export function standSlots(count: number): Slot[] {
  const slots: Slot[] = [];
  for (let i = 0; i < count; i += 1) {
    const rowIndex = Math.floor(i / PER_ROW);
    const inRow = Math.min(PER_ROW, count - rowIndex * PER_ROW);
    const k = i % PER_ROW;
    // A fileira de trás fica deslocada meio passo para não esconder o rosto de quem está na frente.
    const offset = rowIndex % 2 === 1 ? SPACING / 2 : 0;
    slots.push({
      col: CENTER_COL + (k - (inRow - 1) / 2) * SPACING + offset,
      row: rowIndex === 0 ? FRONT_ROW : BACK_ROW
    });
  }
  return slots;
}

/**
 * Ordem de entrada: índices dos fundadores, do primeiro a passar pela porta ao último. Quem tem o
 * lugar mais fundo (maior coluna, depois fileira de trás) entra primeiro, então ninguém se cruza.
 */
export function entranceOrder(count: number): number[] {
  const slots = standSlots(count);
  return slots
    .map((slot, index) => ({ slot, index }))
    .sort((a, b) => b.slot.row - a.slot.row || b.slot.col - a.slot.col)
    .map(({ index }) => index);
}

/** Trajeto da porta até o lugar: ao longo da linha da porta até a coluna e depois até a fileira. */
export function pathTo(slot: Slot): Slot[] {
  return [
    { ...DOOR_START },
    { col: slot.col, row: DOOR.row },
    slot
  ];
}

function pathLength(path: Slot[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) total += Math.hypot(path[i]!.col - path[i - 1]!.col, path[i]!.row - path[i - 1]!.row);
  return total;
}

/** Instante, em segundos desde o início, em que o fundador `index` passa a porta. */
export function entryTime(index: number, count: number): number {
  return entranceOrder(count).indexOf(index) * ENTRY_GAP;
}

/** Quando o fundador `index` chega ao lugar. */
export function arrivalTime(index: number, count: number): number {
  const slot = standSlots(count)[index]!;
  return entryTime(index, count) + pathLength(pathTo(slot)) / WALK_SPEED;
}

/** Quando todos já pararam em frente à mesa. */
export function entranceDuration(count: number): number {
  let end = 0;
  for (let i = 0; i < count; i += 1) end = Math.max(end, arrivalTime(i, count));
  return end;
}

/** Posição e postura do fundador `index` no instante `t` (s) desde o início da entrada. */
export function founderFrame(index: number, count: number, t: number): FounderFrame {
  const slot = standSlots(count)[index]!;
  const path = pathTo(slot);
  const walked = (t - entryTime(index, count)) * WALK_SPEED;
  if (walked < 0) return { ...path[0]!, visible: false, walking: false, facing: 1 };
  if (walked >= pathLength(path)) return { ...slot, visible: true, walking: false, facing: -1 };
  let left = walked;
  for (let i = 1; i < path.length; i += 1) {
    const from = path[i - 1]!;
    const to = path[i]!;
    const length = Math.hypot(to.col - from.col, to.row - from.row);
    if (left <= length) {
      const k = length === 0 ? 1 : left / length;
      // Na última perna, quando anda para +linha, olha para a mesa; antes, segue para +coluna.
      const facing = to.col === from.col ? -1 : 1;
      return { col: from.col + (to.col - from.col) * k, row: from.row + (to.row - from.row) * k, visible: true, walking: true, facing };
    }
    left -= length;
  }
  return { ...slot, visible: true, walking: false, facing: -1 };
}

export interface SpeakerView {
  /** Fundador em destaque; `null` se ninguém fala (índice fora da lista ou nulo). */
  index: number | null;
}

/** Valida o índice de quem fala contra o tamanho da lista. */
export function speakerView(count: number, speaker: number | null): SpeakerView {
  const valid = speaker !== null && Number.isInteger(speaker) && speaker >= 0 && speaker < count;
  return { index: valid ? speaker : null };
}

/** Quantos pontinhos do balão estão acesos no instante t (s): 1, 2, 3, 1... */
export function balloonDots(t: number): 1 | 2 | 3 {
  return ((Math.floor(t * 3) % 3) + 1) as 1 | 2 | 3;
}
