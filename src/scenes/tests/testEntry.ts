// Entrada da cena de Ensaios (Fase 4, C2). Descreve um ensaio JÁ resolvido pela simulação:
// a cena só anima, o resultado chega pronto. Ensaio de voo reaproveita a FlightScene com o
// FlightPlayback; os de bancada (estrutural, tração, balança) rodam numa bancada do hangar.
//
// TROCAR quando a frente de Simulação entregar `testHistory(state)` (S6): a UI passa a derivar
// estas entradas de lá (data, Hρ, resultado, peças afetadas) e esta tipagem local some.

import type { FlightPlayback } from "../../sim";
import { flightReplay } from "../flight/replayChannel";

export type BenchTestKind = "structural" | "thrust" | "scale";

export interface BenchTestEntry {
  kind: BenchTestKind;
  /** Título curto no cartão da bancada. */
  label: string;
  /** Passou ou quebrou (só o estrutural quebra de verdade na animação). */
  outcome: "pass" | "fail";
  /** Quanto do fundo de escala o instrumento marca no fim (0 a 1). */
  gauge: number;
  /** Resultado escrito no fim, já formatado pela UI (ex.: "Aguentou 3,2 kg"). */
  result: string;
}

export interface FlightTestEntry {
  kind: "flight";
  playback: FlightPlayback;
}

export type TestEntry = BenchTestEntry | FlightTestEntry;

type Listener = (entry: BenchTestEntry) => void;

function createBenchTestChannel() {
  let serial = 0;
  const listeners = new Set<Listener>();
  return {
    run(entry: BenchTestEntry) {
      serial += 1;
      listeners.forEach((listener) => listener(entry));
    },
    get serial() {
      return serial;
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}

/** Canal dos ensaios de bancada: o HangarScene assina ao criar. */
export const benchTestChannel = createBenchTestChannel();

/** Toca um ensaio: voo na FlightScene, bancada no hangar. Quem chama monta a tela certa. */
export function playTest(entry: TestEntry) {
  if (entry.kind === "flight") flightReplay.play(entry.playback);
  else benchTestChannel.run(entry);
}
