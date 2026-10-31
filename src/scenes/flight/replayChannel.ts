// Canal entre quem tem o voo resolvido (painel, e depois a simulação) e a FlightScene.
// A cena assina ao criar; quem chama `play` não precisa de referência ao Phaser.Game.
// Quando a simulação guardar as baterias no GameState, a cena pode passar a ler do store.

import type { FlightPlayback } from "./playback";

export type ReplaySpeed = 0.5 | 1 | 2 | 4;

export interface ReplayRequest {
  playback: FlightPlayback;
  /** Incrementa a cada pedido, para repetir o mesmo voo. */
  serial: number;
}

type Listener = (request: ReplayRequest) => void;
type SpeedListener = (speed: ReplaySpeed) => void;

function createReplayChannel() {
  let current: ReplayRequest | null = null;
  let speed: ReplaySpeed = 1;
  let serial = 0;
  const listeners = new Set<Listener>();
  const speedListeners = new Set<SpeedListener>();

  return {
    play(playback: FlightPlayback) {
      serial += 1;
      current = { playback, serial };
      listeners.forEach((listener) => listener(current!));
    },
    setSpeed(next: ReplaySpeed) {
      speed = next;
      speedListeners.forEach((listener) => listener(speed));
    },
    get current() {
      return current;
    },
    get speed() {
      return speed;
    },
    subscribe(listener: Listener, onSpeed?: SpeedListener): () => void {
      listeners.add(listener);
      if (onSpeed) speedListeners.add(onSpeed);
      return () => {
        listeners.delete(listener);
        if (onSpeed) speedListeners.delete(onSpeed);
      };
    }
  };
}

export const flightReplay = createReplayChannel();
