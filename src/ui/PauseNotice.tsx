// Aviso central das pausas automáticas: o que aconteceu, o resultado e duas saídas, "Ver resultado"
// (leva à tela certa) e "Seguir o tempo". Vários motivos no mesmo instante ficam em fila. Enter segue o
// tempo, Esc fecha o aviso atual. Eventos obrigatórios têm o próprio "Entrar" (EventMode). A leitura
// vem pronta da simulação (pauseNotices); aqui só se apresenta.

import { useEffect, useMemo, useState } from "preact/hooks";
import { store } from "../app/store";
import { useGame } from "../app/useGame";
import { pauseNotices, type NoticeTarget } from "../sim";
import { FORMS_SITE } from "./browser/sites";
import { navigate } from "./nav";
import { openSite } from "./screens/Browser";
import { openLecture } from "./selection/LectureOverlay";

const TARGET_LABEL: Record<NoticeTarget, string> = {
  central: "Central",
  actions: "Ações",
  calendar: "Calendário",
  team: "Equipe",
  tests: "Ensaios",
  report: "Relatório",
  browser: "Navegador",
  competition: "Competição",
  lecture: "a palestra"
};

export function PauseNotice() {
  const paused = useGame((state) => (state.pause && !state.activeEvent ? state : null));
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const notices = useMemo(() => (paused ? pauseNotices(paused).map((notice) => ({ ...notice, key: `${paused.pause!.at}:${notice.messageId}` })) : []), [paused]);
  const queue = notices.filter((notice) => !dismissed.has(notice.key));
  const current = queue[0];
  const position = current ? notices.indexOf(current) + 1 : 0;

  const dismiss = () => current && setDismissed((set) => new Set(set).add(current.key));
  const follow = () => store.setSpeed(1);
  const showResult = () => {
    if (!current) return;
    dismiss();
    if (current.target === "lecture") {
      navigate("team");
      openLecture();
    } else if (current.reason === "triage") {
      openSite(FORMS_SITE);
      navigate("browser");
    } else navigate(current.target);
  };

  useEffect(() => {
    if (!current) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Enter" && current.canResume) {
        event.preventDefault();
        event.stopPropagation();
        store.setSpeed(1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setDismissed((set) => new Set(set).add(current.key));
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [current?.key, current?.canResume]);

  if (!current) return null;
  return (
    <div class="pause-notice" role="dialog" aria-modal="true" aria-label={current.title}>
      <section class="pause-card">
        <header class="pause-head">
          <span class="event-kind">Tempo parado</span>
          {notices.length > 1 ? (
            <span class="pause-count" aria-label={`Aviso ${position} de ${notices.length}`}>
              {position} de {notices.length}
            </span>
          ) : null}
        </header>
        <h2>{current.title}</h2>
        <p class="pause-result">{current.result}</p>
        <div class="pause-actions">
          <button type="button" class="btn-ghost" onClick={showResult}>
            Ver resultado <span class="muted small">({TARGET_LABEL[current.target]})</span>
          </button>
          {current.canResume ? (
            <button type="button" class="btn-primary" autofocus onClick={follow}>
              Seguir o tempo
            </button>
          ) : null}
        </div>
        <p class="pause-hint muted small">Enter segue o tempo · Esc fecha o aviso</p>
      </section>
    </div>
  );
}
