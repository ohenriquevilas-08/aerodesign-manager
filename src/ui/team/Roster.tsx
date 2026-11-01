import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useGame } from "../../app/useGame";
import { clockToDate, findAgenda, isOverloaded, memberHoursPerDay, rosterMembers, type Member } from "../../sim";
import { PixelAvatar } from "../components/PixelAvatar";
import { Meter } from "../components/Controls";
import { DISCIPLINE_LABEL, DISCIPLINE_SHORT, formatNumber, motivationLabel, ROLE_LABEL } from "../format";
import {
  BASE_COLUMNS,
  findColumn,
  memberOverall,
  nextSort,
  ROSTER_COLUMNS,
  ROSTER_TABS,
  rosterSummary,
  shiftsPerMember,
  sortRoster,
  stepSelection,
  type RosterColumn,
  type RosterContext,
  type RosterTab,
  type SortState
} from "../roster";

// Central do Elenco (Fase 6, U5; referência: Central do Elenco do modo carreira do FIFA). Resumo no
// topo, abas, tabela ordenável à esquerda e, à direita, a ficha do selecionado com o boneco grande.
// Aba, ordem e seleção sobrevivem à troca de tela; não são estado do jogo.

let savedTab: RosterTab = "status";
let savedSort: SortState = { columnId: "overall", descending: true };
let savedSelected: string | null = null;

function tone(value: number) {
  if (value >= 75) return "ok" as const;
  if (value >= 50) return "accent" as const;
  if (value >= 25) return "warn" as const;
  return "danger" as const;
}

export function Roster() {
  const [tab, setTabState] = useState(savedTab);
  const [sort, setSortState] = useState(savedSort);
  const [selectedId, setSelectedState] = useState(savedSelected);
  const setTab = (value: RosterTab) => setTabState((savedTab = value));
  const setSort = (value: SortState) => setSortState((savedSort = value));
  const setSelected = (value: string | null) => setSelectedState((savedSelected = value));

  const members = useGame((state) => state.members);
  const tasks = useGame((state) => state.tasks);
  const schedule = useGame((state) => state.workshop.schedule);
  const day = useGame((state) => Math.floor(state.clock.hours / 24));
  const ctx: RosterContext = useMemo(
    () => ({ date: clockToDate(day * 24), tasks, shifts: shiftsPerMember(schedule) }),
    [day, tasks, schedule]
  );

  const workers = rosterMembers({ members });
  const columns = ROSTER_COLUMNS[tab];
  const sortColumn = findColumn(tab, sort.columnId) ?? columns[0]!;
  const sorted = sortRoster(workers, sortColumn, sort.descending, ctx);
  const selected = sorted.find((member) => member.id === selectedId) ?? sorted[0] ?? null;
  const summary = rosterSummary(workers);
  const tableRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent) => {
    const delta = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    setSelected(stepSelection(sorted.map((member) => member.id), selected?.id ?? null, delta));
  };

  // Mantém a linha selecionada à vista quando as setas a movem.
  useEffect(() => {
    tableRef.current?.querySelector(".cast-row.is-selected")?.scrollIntoView({ block: "nearest" });
  }, [selected?.id]);

  const changeTab = (value: RosterTab) => {
    setTab(value);
    // A coluna ordenada pode não existir na aba nova; volta para o nome.
    if (!findColumn(value, sort.columnId)) setSort({ columnId: "name", descending: false });
  };

  return (
    <div class="cast">
      <Summary summary={summary} count={workers.length} />
      <div class="tabs cast-tabs" role="tablist" aria-label="Aba do elenco">
        {ROSTER_TABS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => changeTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div class="cast-main">
        <div class="panel cast-table-wrap" ref={tableRef} tabIndex={0} onKeyDown={onKeyDown} aria-label="Tabela do elenco (setas mudam a seleção)">
          <table class="cast-table">
            <thead>
              <tr>
                {[...BASE_COLUMNS, ...columns].map((column) => (
                  <th
                    key={column.id}
                    class={column.numeric ? "is-num" : undefined}
                    title={column.title}
                    aria-sort={column.id === sortColumn.id ? (sort.descending ? "descending" : "ascending") : "none"}
                  >
                    <button type="button" onClick={() => setSort(nextSort(sort, column))}>
                      {column.label}
                      <span class="sort-mark" aria-hidden="true">
                        {column.id === sortColumn.id ? (sort.descending ? "▼" : "▲") : ""}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((member) => (
                <tr
                  key={member.id}
                  class={`cast-row${member.id === selected?.id ? " is-selected" : ""}`}
                  data-member={member.id}
                  onClick={() => setSelected(member.id)}
                >
                  <td>
                    <div class="cast-name-cell">
                      <PixelAvatar member={member} scale={1} class="cast-portrait" />
                      <span>{member.name}</span>
                    </div>
                  </td>
                  <td>
                    <span class={`role-tag role-${member.role}`}>{ROLE_LABEL[member.role]}</span>
                  </td>
                  <td>{member.area ? DISCIPLINE_SHORT[member.area] : <span class="muted">Sem área</span>}</td>
                  {columns.map((column) => (
                    <Cell key={column.id} column={column} member={member} ctx={ctx} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected ? <Sheet member={selected} tab={tab} ctx={ctx} /> : <div class="panel cast-sheet" />}
      </div>
    </div>
  );
}

function Cell({ column, member, ctx }: { column: RosterColumn; member: Member; ctx: RosterContext }) {
  const value = column.value(member, ctx);
  const text = column.text ? column.text(member, ctx) : String(value);
  return (
    <td class={column.numeric ? "is-num" : undefined}>
      <span class={column.id === "overload" && value === 1 ? "text-danger" : undefined}>{text}</span>
      {column.meter && typeof value === "number" ? <Meter value={value} tone={tone(value)} label={column.label} /> : null}
    </td>
  );
}

function Summary({ summary, count }: { summary: ReturnType<typeof rosterSummary>; count: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <div class="cast-summary panel">
      <div class="cast-ring" title="Média da nota geral da equipe">
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
          <circle cx="36" cy="36" r={radius} class="ring-bg" />
          <circle
            cx="36"
            cy="36"
            r={radius}
            class="ring-fill"
            stroke-dasharray={`${(summary.average / 100) * circumference} ${circumference}`}
            transform="rotate(-90 36 36)"
          />
        </svg>
        <strong class="ring-value">{summary.average}</strong>
      </div>
      <div class="cast-total">
        <span class="stat-label">Equipe</span>
        <strong>{count} alunos</strong>
        <span class="small muted">Nota média</span>
      </div>
      <div class="area-counts">
        {summary.perArea.map((item) => (
          <span key={item.area ?? "none"} class={`area-count${item.count === 0 ? " is-empty" : ""}`}>
            <strong>{item.count}</strong>
            {item.area ? DISCIPLINE_SHORT[item.area] : "Sem área"}
          </span>
        ))}
      </div>
    </div>
  );
}

function Sheet({ member, tab, ctx }: { member: Member; tab: RosterTab; ctx: RosterContext }) {
  const columns = ROSTER_COLUMNS[tab];
  const overall = memberOverall(member);
  const task = ctx.tasks.find((item) => item.id === member.taskId)?.label ?? null;
  return (
    <aside class="panel cast-sheet" aria-live="polite">
      <div class="sheet-head">
        <div>
          <h2 class="sheet-name">{member.name}</h2>
          <div class="sheet-sub">
            <span class={`role-tag role-${member.role}`}>{ROLE_LABEL[member.role]}</span>
            {member.role === "president" ? <span class="chip" title={findAgenda(member.agenda ?? "balanced").text}>{findAgenda(member.agenda ?? "balanced").priority}</span> : null}
            <span class="muted">{member.area ? DISCIPLINE_LABEL[member.area] : "Sem área"}</span>
          </div>
        </div>
        <div class={`sheet-overall tier-${overall >= 60 ? "gold" : overall >= 30 ? "silver" : "bronze"}`} title="Nota geral">
          <strong>{overall}</strong>
          <span>NOTA</span>
        </div>
      </div>
      <div class="sheet-body">
        <dl class="sheet-stats">
          {columns.map((column) => {
            const value = column.value(member, ctx);
            return (
              <div key={column.id} class="sheet-stat">
                <dt>{column.label}</dt>
                <dd>
                  <span>{column.text ? column.text(member, ctx) : String(value)}</span>
                  {column.meter && typeof value === "number" ? <Meter value={value} tone={tone(value)} label={column.label} /> : null}
                </dd>
              </div>
            );
          })}
        </dl>
        <div class="sheet-figure">
          <PixelAvatar member={member} scale={8} pose="stand" class="sheet-avatar" />
        </div>
      </div>
      {tab === "development" ? <p class="small muted">Preferências e facilidades chegam na Fase 7.</p> : null}
      {tab === "knowledge" ? <p class="small muted">Conhecimento tácito. O acervo documentado fica na Central.</p> : null}
    </aside>
  );
}
