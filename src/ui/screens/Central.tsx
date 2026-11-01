import { useGame } from "../../app/useGame";
import { Meter } from "../components/Controls";
import { DISCIPLINE_LABEL, formatNumber } from "../format";
import { HangarScene } from "../../scenes/HangarScene";
import { DISCIPLINES, formatCountdown, formatDate, presidentView, rosterMembers, upcomingDeadlines, type AgendaStatus } from "../../sim";
import { dayHasItems, upcomingDays } from "../calendarView";
import { useDerived } from "../hooks";
import { PhaserStage } from "../PhaserStage";
import { navigate } from "../nav";

const ARCHETYPE_LABEL: Record<string, string> = {
  tradicional: "Tradicional",
  carga: "Aposta em carga",
  relatorio: "Obcecada por relatório",
  tecnica: "Técnica e fria",
  novata: "Novata ambiciosa"
};

const AGENDA_STATUS: Record<AgendaStatus, string> = {
  none: "Ainda sem registro do mês",
  "on-track": "A equipe está no ritmo da agenda",
  ok: "Dá para puxar mais tarefas da agenda",
  behind: "Faltam tarefas da agenda: o presidente já sente"
};

/** Cartão do presidente (Fase 6, U3): a agenda dele e como o mês está para ela. */
function PresidentCard() {
  const view = useDerived((state) => presidentView(state), []);
  if (!view) return null;
  return (
    <section class="panel president-card">
      <h2 class="panel-title">Presidente · {view.name}</h2>
      <div class="panel-body stack-tight">
        <div>
          <span class="chip">{view.agendaLabel}</span>
        </div>
        <p class="small priority-label">
          <strong>{view.priority}</strong> · {view.effect}
        </p>
        <p class="small muted">{view.description}</p>
        <p class="small">
          <strong class={`agenda-${view.status}`}>{AGENDA_STATUS[view.status]}</strong>
          {view.loggedDays > 0 ? ` · ${view.alignedDays} de ${view.loggedDays} dias com tarefa da agenda` : ""}
          {view.idleStreak > 0 ? ` · ${view.idleStreak} ${view.idleStreak === 1 ? "dia" : "dias"} seguidos sem` : ""}
        </p>
      </div>
    </section>
  );
}

/** Resumo dos próximos 14 dias (Fase 6, U1); o calendário inteiro está em Calendário (L). */
function NextDays() {
  const days = useDerived((state) => upcomingDays(state, 14).filter(dayHasItems), []);
  return (
    <section class="panel">
      <h2 class="panel-title">Próximos 14 dias</h2>
      <div class="panel-body next-days">
        {days.length === 0 ? <p class="small muted">Nada marcado. Agende ações no calendário.</p> : null}
        {days.map((day) => (
          <div key={day.date} class={`next-day${day.today ? " is-today" : ""}`}>
            <span class="next-date">{day.today ? "Hoje" : formatDate(day.date)}</span>
            <span class="next-items">
              {day.milestones.map((m) => (
                <span key={m.id} class="cal-chip chip-milestone">
                  {m.title}
                </span>
              ))}
              {day.planned.map((p) => (
                <span key={p.plannedId} class="cal-chip chip-planned">
                  {p.label}
                </span>
              ))}
              {day.flightTests.map((t) => (
                <span key={t.testId} class="cal-chip chip-test">
                  {t.title}
                </span>
              ))}
              {day.orders.map((o) => (
                <span key={o.orderId} class="cal-chip chip-order">
                  {o.label}
                </span>
              ))}
            </span>
          </div>
        ))}
        <button type="button" class="btn-ghost" onClick={() => navigate("calendar")}>
          Abrir calendário (L)
        </button>
      </div>
    </section>
  );
}

/** Acervo documentado (saiu da aba Elenco na Fase 6): piso de conhecimento que fica quando as pessoas saem. */
function DocumentedKnowledge() {
  const documented = useGame((state) => state.documented);
  const members = useGame((state) => state.members);
  const workers = rosterMembers({ members });
  return (
    <section class="panel">
      <h2 class="panel-title">Conhecimento documentado</h2>
      <div class="panel-body stack-tight">
        <p class="muted small">
          O acervo da equipe é o piso de qualquer integrante na disciplina e fica quando as pessoas saem. Cresce com a tarefa "Documentar conhecimento".
        </p>
        {DISCIPLINES.map((discipline) => {
          const best = Math.max(...workers.map((member) => member.knowledge[discipline]), 0);
          return (
            <div key={discipline} class="doc-row">
              <div class="doc-head">
                <span>{DISCIPLINE_LABEL[discipline]}</span>
                <span class="knowledge-value">{Math.round(documented[discipline])}</span>
              </div>
              <Meter value={documented[discipline]} tone="highlight" label={DISCIPLINE_LABEL[discipline]} />
              {best > documented[discipline] ? (
                <span class="doc-risk">{formatNumber(best - documented[discipline])} pontos só na cabeça de alguém</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

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
        <PresidentCard />
        <NextDays />
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
        <DocumentedKnowledge />
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
