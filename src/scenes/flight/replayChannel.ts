// Canal entre quem tem o voo resolvido (painel, e depois a simulação) e a FlightScene.
// A cena assina ao criar; quem chama `play` não precisa de referência ao Phaser.Game.
// Quando a simulação guardar as baterias no GameState, a cena pode passar a ler do store.

import type { MemberLook } from "../../sim";
import type { FlightPlayback } from "./playback";

/** Ensaio de voo agendado, pronto para tocar: `venueId` escolhe o cenário; `crew` são os bonecos da vinheta de chegada. */
export interface FlightTestSession {
  venueId: string;
  venueName: string;
  crew: MemberLook[];
  /** Um por carga planejada. */
  flights: FlightPlayback[];
}

export type ReplaySpeed = 0.5 | 1 | 2 | 4;

export interface ReplayRequest {
  playback: FlightPlayback;
  /** Incrementa a cada pedido, para repetir o mesmo voo. */
  serial: number;
}

type Listener = (request: ReplayRequest) => void;
type SpeedListener = (speed: ReplaySpeed) => void;
type SessionListener = (session: FlightTestSession) => void;

function createReplayChannel() {
  let current: ReplayRequest | null = null;
  let speed: ReplaySpeed = 1;
  let serial = 0;
  const listeners = new Set<Listener>();
  const speedListeners = new Set<SpeedListener>();
  const sessionListeners = new Set<SessionListener>();
  let session: FlightTestSession | null = null;

  return {
    play(playback: FlightPlayback) {
      serial += 1;
      current = { playback, serial };
      listeners.forEach((listener) => listener(current!));
    },
    /** Ensaio de voo: vinheta de chegada e as decolagens em sequência, no cenário do local. */
    playSession(next: FlightTestSession) {
      session = next;
      sessionListeners.forEach((listener) => listener(next));
    },
    setSpeed(next: ReplaySpeed) {
      speed = next;
      speedListeners.forEach((listener) => listener(speed));
    },
    get current() {
      return current;
    },
    get session() {
      return session;
    },
    get speed() {
      return speed;
    },
    subscribe(listener: Listener, onSpeed?: SpeedListener, onSession?: SessionListener): () => void {
      listeners.add(listener);
      if (onSpeed) speedListeners.add(onSpeed);
      if (onSession) sessionListeners.add(onSession);
      return () => {
        listeners.delete(listener);
        if (onSpeed) speedListeners.delete(onSpeed);
        if (onSession) sessionListeners.delete(onSession);
      };
    }
  };
}

export const flightReplay = createReplayChannel();
