// Sequência de um ensaio de voo (C3): vinheta de chegada (van, equipe descarregando o avião) e depois
// uma decolagem por carga planejada. Pura: o quadro da vinheta sai do tempo; a cena só posiciona e desenha.
// Distâncias em metros ao longo da pista (x = 0 na largada).

export const ARRIVAL_S = 9;
/** Pausa depois do cartão de cada voo, antes da próxima decolagem (tempo real, s). */
export const BETWEEN_FLIGHTS_S = 3.4;

const T_VAN_STOP = 2.6;
const T_DOORS = 3.3;
const T_CARRY_END = 7;

export interface ArrivalFrame {
  van: { x: number; doorsOpen: boolean; moving: boolean };
  crew: { x: number; visible: boolean; walking: boolean; carrying: boolean; facing: 1 | -1 }[];
  plane: { x: number; h: number; visible: boolean; carried: boolean };
  /** Passou o fim da vinheta. */
  done: boolean;
}

/** Ponto de estacionamento da van e posição de espera do avião, m. */
export const VAN_PARK_X = -15;
export const PLANE_READY_X = 0;
/** Onde a equipe fica vendo o voo, m. */
export const CREW_WATCH_X = -5;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (v: number) => 1 - (1 - clamp01(v)) ** 3;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Quadro da chegada no instante t (s) para `crewSize` pessoas. */
export function arrivalFrame(t: number, crewSize: number): ArrivalFrame {
  const vanX = lerp(VAN_PARK_X - 46, VAN_PARK_X, ease(t / T_VAN_STOP));
  const doorsOpen = t >= T_DOORS;
  const carryK = clamp01((t - T_DOORS - 0.8) / (T_CARRY_END - T_DOORS - 0.8));
  const carrying = t >= T_DOORS + 0.8 && t < T_CARRY_END;
  const planeX = lerp(VAN_PARK_X + 5.5, PLANE_READY_X, ease(carryK));
  const back = ease((t - T_CARRY_END) / (ARRIVAL_S - T_CARRY_END));
  const crew = Array.from({ length: crewSize }, (_, i) => {
    const visible = t >= T_DOORS + i * 0.25;
    // Quem carrega vai nas pontas do avião; depois todos recuam para a posição de espera.
    const slot = i - (crewSize - 1) / 2;
    const carryX = planeX + slot * 1.6;
    const watchX = CREW_WATCH_X - i * 1.1;
    const x = t < T_CARRY_END ? (visible ? carryX : VAN_PARK_X + 1.5) : lerp(carryX, watchX, back);
    const walking = (carrying && visible) || (t >= T_CARRY_END && back < 1);
    return { x, visible, walking, carrying: carrying && visible, facing: (t >= T_CARRY_END && back < 1 ? -1 : 1) as 1 | -1 };
  });
  return {
    van: { x: vanX, doorsOpen, moving: t < T_VAN_STOP },
    crew,
    plane: { x: planeX, h: carrying ? 0.55 : 0, visible: doorsOpen, carried: carrying },
    done: t >= ARRIVAL_S
  };
}

/** Cabeçalho do ensaio: "ENSAIO · LOCAL". */
export function sessionTitle(venueName: string): string {
  return `ENSAIO · ${venueName}`.toUpperCase();
}

/** Progresso na linha de condições: "DECOLAGEM 2/3". */
export function sessionProgress(flightIndex: number, flights: number): string {
  return `DECOLAGEM ${flightIndex + 1}/${flights}`;
}
