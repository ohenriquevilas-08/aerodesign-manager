import { useGame } from "../../app/useGame";
import { HangarScene } from "../../scenes/HangarScene";
import { formatCountdown, formatDate, upcomingDeadlines } from "../../sim";
import { PhaserStage } from "../PhaserStage";

const ARCHETYPE_LABEL: Record<string, string> = {
  tradicional: "Tradicional",
  carga: "Aposta em carga",
  relatorio: "Obcecada por relatório",
  tecnica: "Técnica e fria",
  novata: "Novata ambiciosa"
};

export function Central() {
  const hours = useGame((state) => Math.floor(state.clock.hours));
  const inbox = useGame((state) => state.inbox);
  const rivals = useGame((state) => state.rivals);
  const highlighted = rivals.filter((team) => team.archetype !== null);
  const deadlines = upcomingDeadlines(hours, 4);

  return (
    <div class="central">
      <section class="panel">
        <h2 class="panel-title">Hangar</h2>
        <PhaserStage scene={HangarScene} sceneKey="hangar" />
      </section>
      <div class="side">
        <section class="panel">
          <h2 class="panel-title">Próximos prazos</h2>
          <div class="panel-body">
            {deadlines.map((item) => (
              <div key={item.id} class={`deadline${item.kind === "deadline" ? " is-due" : ""}`}>
                <div>
                  <span class="deadline-title">{item.title}</span>
                  <span class="deadline-date">{formatDate(item.date)}</span>
                </div>
                <span class="deadline-count">{formatCountdown(hours, item.date)}</span>
              </div>
            ))}
          </div>
        </section>
        <section class="panel">
          <h2 class="panel-title">Caixa de entrada</h2>
          <div class="panel-body">
            {inbox.map((message) => (
              <article key={message.id} class={`message${message.read ? "" : " is-unread"}`}>
                <div class="message-from">{message.from}</div>
                <div class="message-title">{message.title}</div>
                <p>{message.body}</p>
              </article>
            ))}
          </div>
        </section>
        <section class="panel">
          <h2 class="panel-title">Rivais de destaque · {rivals.length} no campo</h2>
          <div class="panel-body">
            {highlighted.map((team) => (
              <div key={team.id} class="rival">
                <div>
                  <div>{team.name}</div>
                  <div class="rival-meta">
                    {team.acronym} · {team.city}/{team.state}
                  </div>
                </div>
                <span class="rival-meta">{ARCHETYPE_LABEL[team.archetype ?? ""]}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
