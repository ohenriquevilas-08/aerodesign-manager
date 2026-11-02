// Canal entre a UI e a LectureScene, no molde do introChannel. A cena só anima: a UI entrega a leitura
// da palestra (presentes e quem está no palco) e, se quiser, força o slide. A cena assina ao criar.

import type { LectureView } from "./contract";

type ViewListener = (view: LectureView | null) => void;
type SlideListener = (slide: number | null) => void;

function createLectureChannel() {
  let view: LectureView | null = null;
  let slide: number | null = null;
  const viewListeners = new Set<ViewListener>();
  const slideListeners = new Set<SlideListener>();
  return {
    /** Entrega a palestra; a cena refaz a entrada da plateia do zero. `null` esvazia o auditório. */
    show(next: LectureView | null) {
      view = next;
      slide = null;
      viewListeners.forEach((listener) => listener(next));
    },
    /** Força um slide (índice); `null` devolve ao ritmo automático. */
    setSlide(index: number | null) {
      slide = index;
      slideListeners.forEach((listener) => listener(index));
    },
    get current() {
      return view;
    },
    get slide() {
      return slide;
    },
    subscribe(onView: ViewListener, onSlide: SlideListener): () => void {
      viewListeners.add(onView);
      slideListeners.add(onSlide);
      return () => {
        viewListeners.delete(onView);
        slideListeners.delete(onSlide);
      };
    }
  };
}

export const lectureChannel = createLectureChannel();
