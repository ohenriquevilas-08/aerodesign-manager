// Roteiro do replay: transforma um FlightPlayback numa linha do tempo de poses (x, altura,
// arfagem) e eventos. Puro e determinístico, para a cena só amostrar e o teste conferir.
// A física é cenográfica (design §9.4): o que vale são os números que a simulação mandou.

import { FLIGHT_RULES, type FlightPlayback } from "./playback";

export type FlightPhase =
  | "ready"
  | "roll"
  | "abort"
  | "climb"
  | "circuit"
  | "approach"
  | "bounce"
  | "rollout"
  | "crash"
  | "wreck"
  | "unload";

export type FlightEventType =
  | "start"
  | "rotate"
  | "obstacle-clear"
  | "tape-break"
  | "abort"
  | "circuit-start"
  | "approach-start"
  | "touchdown"
  | "bounce"
  | "runway-exit"
  | "stop"
  | "crash-impact"
  | "unload-start"
  | "unload-end"
  | "end";

export interface FlightEvent {
  type: FlightEventType;
  /** Tempo do replay, s. */
  t: number;
  x: number;
  h: number;
}

export interface FlightPose {
  phase: FlightPhase;
  /** Distância ao longo da pista desde a largada, m. */
  x: number;
  /** Altura das rodas acima do solo, m. */
  h: number;
  /** Arfagem, graus; positivo = nariz para cima. */
  pitchDeg: number;
  onGround: boolean;
  /** Progresso 0–1 dentro da fase atual (circuito, retirada...). */
  progress: number;
}

interface Segment {
  phase: FlightPhase;
  start: number;
  duration: number;
  pose(u: number): Omit<FlightPose, "phase" | "progress">;
}

export interface FlightScript {
  playback: FlightPlayback;
  duration: number;
  events: FlightEvent[];
  /** Onde o avião toca o solo no pouso, m (o pouso é na mesma pista, depois do obstáculo). */
  touchdownM: number;
  /** Fim da área de pouso desenhada pela cena, m. Posicionado para o desfecho ficar legível. */
  runwayEndM: number;
  sample(t: number): FlightPose;
}

const LIFTOFF_SPEED = 13; // m/s
const AIR_SPEED = 14; // m/s
const CIRCUIT_ALTITUDE = 24; // m
const CLIMB_OUT = 90; // m de subida depois do obstáculo
const CIRCUIT_TIME = 7; // s de circuito resumido
const APPROACH_LENGTH = 80; // m
const APPROACH_HEIGHT = 14; // m
const TOUCHDOWN_SPEED = 11; // m/s
const TOUCHDOWN_M = 100;
const ABORT_AT = 50; // m: onde o piloto corta o motor quando não sai do chão
const ABORT_STOP = 3.5; // m de frenagem depois do corte

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const deg = (slope: number) => (Math.atan(slope) * 180) / Math.PI;

/** Hermite cúbica: posição e inclinação no início e no fim, inclinação em unidades por u. */
function hermite(p0: number, m0: number, p1: number, m1: number, u: number) {
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1;
}
function hermiteSlope(p0: number, m0: number, p1: number, m1: number, u: number) {
  const u2 = u * u;
  return (6 * u2 - 6 * u) * p0 + (3 * u2 - 4 * u + 1) * m0 + (-6 * u2 + 6 * u) * p1 + (3 * u2 - 2 * u) * m1;
}

/** Ritmo do replay: câmera lenta perto do obstáculo, retirada acelerada. Multiplica o tempo. */
export function playbackRate(pose: FlightPose): number {
  const near = pose.x > 44 && pose.x < 60;
  if (near && (pose.phase === "roll" || pose.phase === "climb" || pose.phase === "abort")) return 0.4;
  if (pose.phase === "unload") return 3;
  if (pose.phase === "circuit") return 1.4;
  return 1;
}

export function buildFlightScript(playback: FlightPlayback): FlightScript {
  const { obstacleDistanceM: OBS, obstacleHeightM } = FLIGHT_RULES;
  const segments: Segment[] = [];
  const events: FlightEvent[] = [];
  let clock = 0;
  let last = { x: 0, h: 0, pitchDeg: 0, onGround: true };

  // Fim da área de pouso: depois do ponto de parada quando parou dentro, antes quando não.
  const stopForEnd = Math.max(2, playback.stopDistanceM ?? 20);
  const runwayEndM =
    playback.outcome === "landing-out"
      ? TOUCHDOWN_M + stopForEnd * 0.65
      : TOUCHDOWN_M + Math.max(stopForEnd + 15, stopForEnd * 1.4);

  const push = (phase: FlightPhase, duration: number, pose: Segment["pose"]) => {
    segments.push({ phase, start: clock, duration, pose });
    clock += duration;
    last = pose(1);
  };
  const mark = (type: FlightEventType) => events.push({ type, t: clock, x: last.x, h: last.h });

  /** Queda a partir da pose atual: nariz cai, avião gira e bate no chão. */
  const crash = (fall: number) => {
    const from = { ...last };
    const duration = clamp(0.9 + Math.sqrt(from.h) * 0.45, 1.2, 3.2);
    push("crash", duration, (u) => ({
      x: from.x + fall * (1 - (1 - u) * (1 - u)),
      h: from.h * (1 - u * u),
      pitchDeg: lerp(from.pitchDeg + 12, -55, u * u) + Math.sin(u * 18) * 14 * (1 - u),
      onGround: u >= 1
    }));
    mark("crash-impact");
    const wreck = { x: last.x, h: 0, pitchDeg: -18, onGround: true };
    push("wreck", 1.6, () => wreck);
  };

  mark("start");
  push("ready", 1.6, () => ({ x: 0, h: 0, pitchDeg: 0, onGround: true }));

  const rotation = playback.rotationDistanceM;
  const tookOff = playback.outcome !== "no-takeoff" && rotation !== null;

  if (!tookOff) {
    // Corre até perto do obstáculo sem sair do chão; o piloto corta e o avião para antes da fita.
    const accel = (LIFTOFF_SPEED * LIFTOFF_SPEED) / (2 * ABORT_AT);
    const rollTime = Math.sqrt((2 * ABORT_AT) / accel);
    push("roll", rollTime, (u) => ({ x: 0.5 * accel * (u * rollTime) ** 2, h: 0, pitchDeg: u * 2, onGround: true }));
    mark("abort");
    const brakeTime = (2 * ABORT_STOP) / LIFTOFF_SPEED;
    push("abort", brakeTime, (u) => ({
      x: ABORT_AT + ABORT_STOP * (1 - (1 - u) * (1 - u)),
      h: 0,
      pitchDeg: lerp(2, -3, u) + Math.sin(u * 30) * 1.5 * (1 - u),
      onGround: true
    }));
    mark("stop");
    const stopped = { ...last, pitchDeg: 0 };
    push("wreck", 1.4, () => stopped);
  } else {
    const R = clamp(rotation, 8, OBS - 1);
    const accel = (LIFTOFF_SPEED * LIFTOFF_SPEED) / (2 * R);
    const rollTime = (2 * R) / LIFTOFF_SPEED;
    push("roll", rollTime, (u) => ({ x: 0.5 * accel * (u * rollTime) ** 2, h: 0, pitchDeg: u * 3, onGround: true }));
    mark("rotate");

    // Da rotação ao obstáculo: parábola que chega aos 55 m com a folga recebida.
    const clearance = playback.obstacleClearanceM ?? 0.3;
    const h55 = Math.max(0.15, obstacleHeightM + clearance);
    const c = h55 / ((OBS - R) * (OBS - R));
    const s55 = 2 * c * (OBS - R);
    push("climb", (OBS - R) / AIR_SPEED, (u) => {
      const d = u * (OBS - R);
      return { x: R + d, h: c * d * d, pitchDeg: Math.max(3, deg(2 * c * d) + 4), onGround: u === 0 };
    });
    mark(playback.outcome === "tape-break" ? "tape-break" : "obstacle-clear");

    // Subida até a altura do circuito, com inclinação contínua na saída do obstáculo.
    const rise = CIRCUIT_ALTITUDE - h55;
    const m0 = Math.min(s55 * CLIMB_OUT, 2.5 * rise);
    const climbOut = (u: number) => ({
      x: OBS + u * CLIMB_OUT,
      h: hermite(h55, m0, CIRCUIT_ALTITUDE, 0, u),
      pitchDeg: deg(hermiteSlope(h55, m0, CIRCUIT_ALTITUDE, 0, u) / CLIMB_OUT) + 3,
      onGround: false
    });
    const crashPhase = playback.crashPhase ?? "circuit";
    const isCrash = playback.outcome === "crash";

    if (isCrash && crashPhase === "climb") {
      // Estol logo depois do obstáculo: sobe um pouco, cabra e cai.
      push("climb", (0.22 * CLIMB_OUT) / AIR_SPEED, (u) => {
        const pose = climbOut(u * 0.22);
        return { ...pose, pitchDeg: pose.pitchDeg + u * 18 };
      });
      crash(16);
    } else {
      push("climb", CLIMB_OUT / AIR_SPEED, climbOut);
      mark("circuit-start");
      const circuitFrom = last.x;
      const circuitPose = (u: number) => ({
        x: circuitFrom + u * CIRCUIT_TIME * AIR_SPEED,
        h: CIRCUIT_ALTITUDE + Math.sin(u * Math.PI * 2) * 1.5,
        pitchDeg: Math.cos(u * Math.PI * 2) * 3,
        onGround: false
      });

      if (isCrash && crashPhase === "circuit") {
        push("circuit", CIRCUIT_TIME * 0.55, (u) => circuitPose(u * 0.55));
        crash(30);
      } else {
        push("circuit", CIRCUIT_TIME, circuitPose);
        mark("approach-start");
        const ax = TOUCHDOWN_M - APPROACH_LENGTH;
        const approachPose = (u: number) => ({
          x: ax + u * APPROACH_LENGTH,
          h: APPROACH_HEIGHT * (1 - u) ** 1.8,
          pitchDeg: lerp(-7, 5, u * u),
          onGround: false
        });
        const approachTime = APPROACH_LENGTH / AIR_SPEED;

        if (isCrash) {
          push("approach", approachTime * 0.5, (u) => approachPose(u * 0.5));
          crash(14);
        } else {
          push("approach", approachTime, approachPose);
          mark("touchdown");
          landing();
        }
      }
    }
  }

  function landing() {
    const stop = Math.max(2, playback.stopDistanceM ?? 20);
    let speed = TOUCHDOWN_SPEED;
    let from = last.x;
    let remaining = stop;

    if (playback.outcome === "damage") {
      // Pouso duro: quica uma vez antes de assentar.
      const hop = Math.min(10, stop * 0.4);
      const hopTime = hop / speed;
      push("bounce", hopTime, (u) => ({
        x: from + u * hop,
        h: 4 * 1.1 * u * (1 - u),
        pitchDeg: lerp(6, -4, u),
        onGround: u === 0 || u === 1
      }));
      mark("bounce");
      from = last.x;
      remaining = stop - hop;
      speed *= 0.8;
    }

    const rolloutTime = (2 * remaining) / speed;
    const finalPitch = playback.outcome === "damage" ? -9 : 0;
    const end = from + remaining;
    push("rollout", rolloutTime, (u) => {
      const x = from + remaining * (1 - (1 - u) * (1 - u));
      const offRunway = playback.outcome === "landing-out" && x > runwayEndM;
      const bump = offRunway ? Math.abs(Math.sin(x * 2.1)) * 0.12 : 0;
      return { x, h: bump, pitchDeg: lerp(4, finalPitch, Math.min(1, u * 2.5)) + (offRunway ? Math.sin(x * 3) * 3 : 0), onGround: true };
    });
    if (playback.outcome === "landing-out") {
      // Instante em que o avião cruza o fim da pista (x = runwayEndM), invertendo o movimento uniformemente retardado.
      const ratio = clamp((runwayEndM - from) / remaining, 0, 1);
      const u = 1 - Math.sqrt(1 - ratio);
      events.push({ type: "runway-exit", t: clock - rolloutTime + u * rolloutTime, x: runwayEndM, h: 0 });
    }
    mark("stop");
    last = { x: end, h: 0, pitchDeg: finalPitch, onGround: true };

    const rest = { ...last };
    if (playback.unloadTimeS !== null && playback.unloadTimeS > 0) {
      push("wreck", 0.8, () => rest);
      mark("unload-start");
      push("unload", playback.unloadTimeS, () => rest);
      mark("unload-end");
    } else {
      push("wreck", 1.4, () => rest);
    }
  }

  const final = { ...last };
  push("wreck", 0.6, () => final);
  mark("end");
  events.sort((a, b) => a.t - b.t);

  const duration = clock;
  return {
    playback,
    duration,
    events,
    touchdownM: TOUCHDOWN_M,
    runwayEndM,
    sample(t: number): FlightPose {
      const time = clamp(t, 0, duration);
      const segment = segments.find((s) => time < s.start + s.duration) ?? segments[segments.length - 1]!;
      const u = segment.duration > 0 ? clamp((time - segment.start) / segment.duration, 0, 1) : 1;
      return { phase: segment.phase, progress: u, ...segment.pose(u) };
    }
  };
}
