import { useState } from "preact/hooks";
import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import {
  calendarMonth,
  clockToDate,
  DEDICATIONS,
  DISCIPLINES,
  findAction,
  formatDate,
  formatTime,
  rosterMembers,
  seasonOverview,
  SELECTION_FORMATS,
  dateToHours,
  type CalendarDay,
  type Dedication,
  type GameState,
  type SeasonMonth
} from "../../sim";
import { academicTone, dropStartAt, schedulableActions } from "../calendarView";
import { DISCIPLINE_SHORT } from "../format";
import { useDerived } from "../hooks";

// Tela Calendário (Fase 6, U1; referência: calendário anual do FIFA). Faixa da temporada no topo,
// grade do mês embaixo. Arrastar uma ação agendada para outro dia chama reschedule-action; clicar
// num dia abre o painel com o catálogo para agendar ali. A simulação já traz tudo pronto (calendarMonth).

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Sobrevive à troca de tela; não é estado do jogo.
let savedMonth: { year: number; month: number } | null = null;

const monthOf = (state: Pick<GameState, "clock">) => {
  const now = new Date(clockToDate(state.clock.hours));
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
};

export function Calendar() {
  const [view, setViewState] = useState(() => savedMonth ?? monthOf(store.getState()));
  const setView = (next: { year: number; month: number }) => setViewState((savedMonth = next));
  const [selected, setSelected] = useState<number | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const season = useDerived((state) => seasonOverview(state), []);
  const month = useDerived((state) => calendarMonth(state, view.year, view.month), [view.year, view.month]);
  const selectedDay = month.days.find((day) => day.date === selected) ?? null;

  const step = (delta: number) => {
    const when = new Date(Date.UTC(view.year, view.month - 1 + delta, 1));
    setView({ year: when.getUTCFullYear(), month: when.getUTCMonth() + 1 });
    setSelected(null);
  };

  const drop = (day: CalendarDay) => {
    setOver(null);
    const planned = month.days.flatMap((item) => item.planned).find((item) => item.plannedId === dragging);
    setDragging(null);
    if (!planned || day.past) return;
    store.dispatch({ type: "reschedule-action", plannedId: planned.plannedId, startAt: dropStartAt(day.date, planned.startAt) });
  };

  return (
    <div class="screen calendar-screen">
      <header class="screen-head">
        <h1 class="screen-title">Calendário</h1>
        <div class="month-nav">
          <button type="button" class="btn-ghost" aria-label="Mês anterior" onClick={() => step(-1)}>
            ◀
          </button>
          <strong class="month-name">
            {MONTH_NAMES[view.month - 1]} {view.year}
          </strong>
          <button type="button" class="btn-ghost" aria-label="Próximo mês" onClick={() => step(1)}>
            ▶
          </button>
        </div>
        <Legend />
      </header>

      <SeasonStrip season={season} view={view} onPick={(item) => { setView({ year: item.year, month: item.month }); setSelected(null); }} />

      <div class="calendar-grid-wrap">
        <div class="panel cal-panel">
          <div class="cal-weekdays">
            {WEEKDAYS.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
          <div class="cal-grid" data-month={`${view.year}-${view.month}`}>
            {Array.from({ length: month.firstWeekday }, (_, i) => (
              <div key={`pad-${i}`} class="cal-day is-pad" />
            ))}
            {month.days.map((day) => (
              <DayCell
                key={day.date}
                day={day}
                selected={day.date === selected}
                over={day.date === over}
                dragging={dragging}
                onSelect={() => setSelected(day.date === selected ? null : day.date)}
                onDragStart={setDragging}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
                onOver={() => !day.past && setOver(day.date)}
                onLeave={() => setOver((current) => (current === day.date ? null : current))}
                onDrop={() => drop(day)}
              />
            ))}
          </div>
        </div>
        <aside class="cal-side">
          {selectedDay ? <DayPanel key={selectedDay.date} day={selectedDay} /> : <p class="panel hint-panel muted">Clique num dia para ver o que há nele e agendar uma ação. Arraste uma ação agendada para outro dia para mudar a data.</p>}
        </aside>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <span class="cal-legend">
      <span class="cal-key key-planned">Ação agendada</span>
      <span class="cal-key key-test">Ensaio de voo</span>
      <span class="cal-key key-task">Tarefa</span>
      <span class="cal-key key-order">Pedido</span>
      <span class="cal-key key-milestone">Marco</span>
    </span>
  );
}

function SeasonStrip({ season, view, onPick }: { season: SeasonMonth[]; view: { year: number; month: number }; onPick: (month: SeasonMonth) => void }) {
  return (
    <div class="season-strip" role="tablist" aria-label="Temporada">
      {season.map((item) => {
        const active = item.year === view.year && item.month === view.month;
        return (
          <button
            key={item.label}
            type="button"
            role="tab"
            aria-selected={active}
            class={`season-month${item.current ? " is-current" : ""}${item.past ? " is-past" : ""}`}
            title={item.milestones.map((m) => `${formatDate(m.date)} · ${m.title}`).join("\n") || "Sem marcos oficiais"}
            onClick={() => onPick(item)}
          >
            <span class="season-label">{item.label}</span>
            <span class="season-marks">
              {item.milestones.slice(0, 3).map((m) => (
                <span key={m.id} class={`season-mark mark-${m.kind}`}>
                  {m.title}
                </span>
              ))}
              {item.milestones.length > 3 ? <span class="season-more">+{item.milestones.length - 3}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DayCell({
  day,
  selected,
  over,
  dragging,
  onSelect,
  onDragStart,
  onDragEnd,
  onOver,
  onLeave,
  onDrop
}: {
  day: CalendarDay;
  selected: boolean;
  over: boolean;
  dragging: string | null;
  onSelect: () => void;
  onDragStart: (plannedId: string) => void;
  onDragEnd: () => void;
  onOver: () => void;
  onLeave: () => void;
  onDrop: () => void;
}) {
  const tone = academicTone(day.academic.factor);
  const chips: { key: string; cls: string; text: string; title: string; plannedId?: string }[] = [
    ...day.milestones.map((m) => ({ key: m.id, cls: `chip-milestone mark-${m.kind}`, text: m.title, title: m.title })),
    ...day.planned.map((p) => ({ key: p.plannedId, cls: "chip-planned", text: `${formatClock(p.startAt)} ${p.label}`, title: `${p.label}, começa sozinha às ${formatClock(p.startAt)}. Arraste para mudar o dia.`, plannedId: p.plannedId })),
    ...day.flightTests.map((t) => ({ key: t.testId, cls: "chip-test", text: t.title, title: t.title })),
    ...day.orders.map((o) => ({ key: o.orderId, cls: "chip-order", text: o.label, title: `${o.label} (prazo prometido)` })),
    ...day.tasks.map((t) => ({ key: t.taskId, cls: "chip-task", text: t.label, title: `${t.label}${t.endsAt === null ? " (parada)" : ""}` }))
  ];
  const shown = chips.slice(0, 4);
  return (
    <div
      class={`cal-day tone-${tone}${day.today ? " is-today" : ""}${day.past ? " is-past" : ""}${selected ? " is-selected" : ""}${over ? " is-over" : ""}${day.weekday === 0 || day.weekday === 6 ? " is-weekend" : ""}`}
      data-date={day.date}
      title={`${day.day}: ${day.academic.label} (×${day.academic.factor.toLocaleString("pt-BR")} nas horas)`}
      onClick={onSelect}
      onDragOver={(event) => {
        if (!dragging || day.past) return;
        event.preventDefault();
        onOver();
      }}
      onDragLeave={onLeave}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
    >
      <span class="cal-num">{day.day}</span>
      <div class="cal-chips">
        {shown.map((chip) => (
          <span
            key={chip.key}
            class={`cal-chip ${chip.cls}`}
            title={chip.title}
            draggable={chip.plannedId !== undefined && !day.past}
            data-planned={chip.plannedId}
            onDragStart={(event) => {
              if (!chip.plannedId) return;
              event.dataTransfer?.setData("text/plain", chip.plannedId);
              onDragStart(chip.plannedId);
            }}
            onDragEnd={onDragEnd}
          >
            {chip.text}
          </span>
        ))}
        {chips.length > shown.length ? <span class="cal-more">+{chips.length - shown.length}</span> : null}
      </div>
    </div>
  );
}

/** "08:00" a partir de horas de jogo. */
function formatClock(hours: number): string {
  return formatTime(clockToDate(hours));
}

// ---------------------------------------------------------------------------------------------
// Painel do dia: o que há nele e o catálogo para agendar.

function DayPanel({ day }: { day: CalendarDay }) {
  const hours = useGame((state) => Math.floor(state.clock.hours));
  const members = useGame((state) => state.members);
  const catalog = schedulableActions();
  const [actionId, setActionId] = useState(catalog[0]!.id);
  const [targetId, setTargetId] = useState<string>("");
  const [hour, setHour] = useState(8);
  const [dedication, setDedication] = useState<Dedication>("normal");
  const action = findAction(actionId)!;
  const roster = rosterMembers({ members });
  const eligible = roster.filter((member) => (action.id === "trainee-training" ? member.role === "trainee" : member.role !== "trainee"));
  const [picked, setPicked] = useState<string[] | null>(null);
  const crew = picked ?? eligible.slice(0, action.crew.ideal).map((member) => member.id);

  const startAt = dateToHours(day.date) + hour;
  const needsTarget = action.target === "discipline" || action.target === "selection-format";
  const past = startAt < hours;
  const canSchedule = !past && (!needsTarget || targetId !== "");

  const toggle = (id: string) => setPicked(crew.includes(id) ? crew.filter((item) => item !== id) : [...crew, id].slice(0, Math.max(action.crew.max ?? Infinity, 1)));
  const changeAction = (id: string) => {
    setActionId(id);
    setTargetId("");
    setPicked(null);
  };

  return (
    <section class="panel day-panel">
      <h2 class="panel-title">{formatDate(day.date)}</h2>
      <div class="panel-body stack-tight">
        <p class="small muted">
          {day.academic.label} · horas ×{day.academic.factor.toLocaleString("pt-BR")}
        </p>
        <DayList day={day} />

        <h3 class="day-sub">Agendar uma ação</h3>
        {past ? <p class="small alert alert-warn">Esse horário já passou.</p> : null}
        <label class="field">
          <span class="field-label">Ação</span>
          <select value={actionId} onChange={(event) => changeAction((event.target as HTMLSelectElement).value)}>
            {catalog.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {action.target === "discipline" ? (
          <label class="field">
            <span class="field-label">Disciplina</span>
            <select value={targetId} onChange={(event) => setTargetId((event.target as HTMLSelectElement).value)}>
              <option value="">Escolha…</option>
              {DISCIPLINES.map((discipline) => (
                <option key={discipline} value={discipline}>
                  {DISCIPLINE_SHORT[discipline]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {action.target === "selection-format" ? (
          <label class="field">
            <span class="field-label">Formato da seletiva</span>
            <select value={targetId} onChange={(event) => setTargetId((event.target as HTMLSelectElement).value)}>
              <option value="">Escolha…</option>
              {SELECTION_FORMATS.map((format) => (
                <option key={format.id} value={format.id}>
                  {format.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div class="day-row">
          <label class="field">
            <span class="field-label">Hora</span>
            <select value={hour} onChange={(event) => setHour(Number((event.target as HTMLSelectElement).value))}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
          <label class="field">
            <span class="field-label">Dedicação</span>
            <select value={dedication} onChange={(event) => setDedication((event.target as HTMLSelectElement).value as Dedication)}>
              {DEDICATIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {action.cost.hours > 0 ? (
          <div class="field">
            <span class="field-label">
              Quem entra ({crew.length}, mínimo {action.crew.min}{action.crew.max === null ? "" : `, máximo ${action.crew.max}`})
            </span>
            <div class="crew-pick">
              {eligible.map((member) => (
                <label key={member.id} class="check-line">
                  <input type="checkbox" checked={crew.includes(member.id)} onChange={() => toggle(member.id)} />
                  {member.name}
                </label>
              ))}
              {eligible.length === 0 ? <span class="small muted">Ninguém disponível para essa ação.</span> : null}
            </div>
          </div>
        ) : null}
        <button
          type="button"
          class="btn-primary"
          disabled={!canSchedule}
          onClick={() =>
            store.dispatch({
              type: "schedule-action",
              actionId,
              startAt,
              dedication,
              memberIds: action.cost.hours > 0 ? crew : [],
              ...(needsTarget ? { targetId } : {})
            })
          }
        >
          Agendar para {formatDate(day.date)}, {String(hour).padStart(2, "0")}:00
        </button>
      </div>
    </section>
  );
}

function DayList({ day }: { day: CalendarDay }) {
  const empty = day.milestones.length + day.planned.length + day.flightTests.length + day.tasks.length + day.orders.length === 0;
  if (empty) return <p class="small muted">Nada marcado para esse dia.</p>;
  return (
    <ul class="day-list">
      {day.milestones.map((m) => (
        <li key={m.id} class="chip-milestone">
          {m.title}
        </li>
      ))}
      {day.planned.map((p) => (
        <li key={p.plannedId} class="chip-planned">
          <span>
            {formatClock(p.startAt)} · {p.label}
          </span>
          <button type="button" class="btn-ghost" onClick={() => store.dispatch({ type: "unschedule-action", plannedId: p.plannedId })}>
            Cancelar
          </button>
        </li>
      ))}
      {day.flightTests.map((t) => (
        <li key={t.testId} class="chip-test">
          {t.title}
        </li>
      ))}
      {day.orders.map((o) => (
        <li key={o.orderId} class="chip-order">
          {o.label}
        </li>
      ))}
      {day.tasks.map((t) => (
        <li key={t.taskId} class="chip-task">
          {t.label}
          {t.endsAt !== null ? ` · até ${formatDate(clockToDate(t.endsAt))}` : " · parada"}
        </li>
      ))}
    </ul>
  );
}
