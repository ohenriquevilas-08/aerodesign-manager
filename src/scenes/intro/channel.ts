// Canal entre a abertura (UI, U2) e a IntroScene, no molde do blueprintChannel. A cena só anima:
// a UI entrega a lista de fundadores e o índice de quem está falando. A cena assina ao criar.

import type { MemberLook } from "../../sim";

export interface IntroFounder {
  id: string;
  name: string;
  look: MemberLook;
}

type FoundersListener = (founders: IntroFounder[]) => void;
type SpeakerListener = (speaker: number | null) => void;

function createIntroChannel() {
  let founders: IntroFounder[] = [];
  let speaker: number | null = null;
  const founderListeners = new Set<FoundersListener>();
  const speakerListeners = new Set<SpeakerListener>();
  return {
    /** Entrega a lista; a cena refaz a entrada do zero. */
    show(next: IntroFounder[]) {
      founders = next;
      speaker = null;
      founderListeners.forEach((listener) => listener(next));
    },
    /** Quem fala agora (índice em `show`), ou `null` para ninguém. */
    speak(index: number | null) {
      speaker = index;
      speakerListeners.forEach((listener) => listener(index));
    },
    get founders() {
      return founders;
    },
    get speaker() {
      return speaker;
    },
    subscribe(onFounders: FoundersListener, onSpeaker: SpeakerListener): () => void {
      founderListeners.add(onFounders);
      speakerListeners.add(onSpeaker);
      return () => {
        founderListeners.delete(onFounders);
        speakerListeners.delete(onSpeaker);
      };
    }
  };
}

export const introChannel = createIntroChannel();
