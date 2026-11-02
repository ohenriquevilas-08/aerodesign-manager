// "Formulários Goggle" (paródia, Fase 9, U1): a planilha de respostas da seletiva, no Navegador.
// As linhas chegam aos poucos (a simulação sorteia os inscritos dia a dia). Ordena, filtra e marca
// "chamar", "talvez" e "não" com um clique ou pelo teclado (C, T, N; X limpa; setas andam).

import { useMemo, useRef, useState } from "preact/hooks";
import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import { applicantViews, COURSES, funnelCounts, selectionView, type ApplicantStage, type ApplicantTag, type ApplicantView } from "../../sim";
import { Triage } from "../selection/Triage";
import { dateLabel, filterApplicants, funnelSteps, NO_FILTER, nextSort, sortApplicants, STAGE_LABEL, stepIndex, TAG_LABEL, tagForKey, type SheetColumn, type SheetFilter, type SheetSort } from "../selection/model";

const COLUMNS: { id: SheetColumn; label: string }[] = [
  { id: "arrival", label: "#" },
  { id: "name", label: "Nome" },
  { id: "course", label: "Curso" },
  { id: "semester", label: "Período" },
  { id: "stage", label: "Etapa" },
  { id: "tag", label: "Triagem" }
];

// Ordem e filtros sobrevivem à troca de aba; não são estado do jogo.
let savedSort: SheetSort = { column: "arrival", descending: true };
let savedFilter: SheetFilter = NO_FILTER;

const STAGES = Object.keys(STAGE_LABEL) as ApplicantStage[];

export function FormsSite() {
  const campaign = useGame((state) => state.selection);
  const [sort, setSortState] = useState(savedSort);
  const [filter, setFilterState] = useState(savedFilter);
  const setSort = (value: SheetSort) => setSortState((savedSort = value));
  const setFilter = (patch: Partial<SheetFilter>) => setFilterState((previous) => (savedFilter = { ...previous, ...patch }));
  const rows = useMemo(() => applicantViews({ selection: campaign }), [campaign]);
  const view = useMemo(() => selectionView({ selection: campaign }), [campaign]);
  const visible = useMemo(() => sortApplicants(filterApplicants(rows, filter), sort), [rows, filter, sort]);
  // Quem já estava na planilha ao abrir a página não pisca; quem chega depois, sim.
  const known = useRef<Set<string> | null>(null);
  if (known.current === null) known.current = new Set(rows.map((row) => row.id));
  const body = useRef<HTMLTableSectionElement>(null);

  if (!campaign || !view) {
    return (
      <div class="forms-page">
        <FormsHead title="Seletiva da equipe" status="Nenhum formulário ativo" />
        <div class="orders-empty">
          <strong>Nenhum processo seletivo em andamento.</strong>
          <span>Quando você abrir a seletiva (Equipe, aba Seletiva), o formulário aparece aqui.</span>
        </div>
      </div>
    );
  }

  const counts = funnelCounts({ selection: campaign });
  const steps = funnelSteps(counts, rows, view.stage);
  const closed = view.stage !== "promotion" && view.stage !== "open";
  const status =
    view.stage === "promotion" ? "Ainda não publicado" : view.stage === "open" && view.closesAt !== null ? `Recebendo respostas até ${dateLabel(view.closesAt - 1)}` : "Encerrado";

  const tag = (row: ApplicantView, value: ApplicantTag) => store.dispatch({ type: "tag-applicant", applicantId: row.id, tag: row.tag === value ? null : value });
  const focusRow = (id: string | undefined) => {
    if (id) body.current?.querySelector<HTMLElement>(`tr[data-id="${id}"]`)?.focus();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const rowEl = (event.target as HTMLElement).closest<HTMLElement>("tr[data-id]");
    if (!rowEl || event.ctrlKey || event.metaKey || event.altKey) return;
    const index = visible.findIndex((row) => row.id === rowEl.dataset.id);
    const delta = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (delta !== 0) {
      event.preventDefault();
      focusRow(visible[stepIndex(index, delta, visible.length)]?.id);
      return;
    }
    const marked = tagForKey(event.key);
    if (marked === undefined || index < 0) return;
    // As letras são da planilha aqui: não deixam passar para os atalhos de tela.
    event.preventDefault();
    event.stopPropagation();
    store.dispatch({ type: "tag-applicant", applicantId: visible[index]!.id, tag: marked });
  };

  return (
    <div class="forms-page">
      <FormsHead title="Seletiva da equipe: inscrições" status={status} />
      <Triage />
      <div class="forms-funnel" aria-label="Funil da seletiva">
        {steps.map((step) => (
          <div key={step.id} class={`forms-count${step.reached ? " is-reached" : ""}`}>
            <strong>{step.reached ? step.count : "–"}</strong>
            <span>{step.label}</span>
          </div>
        ))}
      </div>

      <div class="forms-toolbar">
        <input
          type="search"
          class="browser-search"
          placeholder="Buscar por nome, curso ou frase"
          aria-label="Buscar nas respostas"
          value={filter.text}
          onInput={(event) => setFilter({ text: event.currentTarget.value })}
        />
        <select aria-label="Filtrar por curso" value={filter.course} onChange={(event) => setFilter({ course: event.currentTarget.value })}>
          <option value="all">Todos os cursos</option>
          {COURSES.map((course) => (
            <option key={course.id} value={course.id}>
              {course.label}
            </option>
          ))}
        </select>
        <select aria-label="Filtrar por etapa" value={filter.stage} onChange={(event) => setFilter({ stage: event.currentTarget.value as SheetFilter["stage"] })}>
          <option value="all">Todas as etapas</option>
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABEL[stage]}
            </option>
          ))}
        </select>
        <select aria-label="Filtrar por triagem" value={filter.tag} onChange={(event) => setFilter({ tag: event.currentTarget.value as SheetFilter["tag"] })}>
          <option value="all">Toda triagem</option>
          <option value="call">Chamar</option>
          <option value="maybe">Talvez</option>
          <option value="no">Não</option>
          <option value="none">Sem marca</option>
        </select>
        <span class="muted small forms-count-shown">
          {visible.length} de {rows.length}
        </span>
      </div>
      <p class="forms-hint muted small">
        Setas escolhem a linha; <kbd>C</kbd> chamar, <kbd>T</kbd> talvez, <kbd>N</kbd> não, <kbd>X</kbd> limpa.
        {closed ? "" : " As respostas chegam aos poucos: deixe o tempo andar."}
      </p>

      <div class="forms-table-wrap">
        <table class="forms-table">
          <thead>
            <tr>
              {COLUMNS.slice(0, 4).map((column) => (
                <SortHeader key={column.id} column={column} sort={sort} onSort={() => setSort(nextSort(sort, column.id))} />
              ))}
              <th scope="col">Por que quero entrar</th>
              {COLUMNS.slice(4).map((column) => (
                <SortHeader key={column.id} column={column} sort={sort} onSort={() => setSort(nextSort(sort, column.id))} />
              ))}
            </tr>
          </thead>
          <tbody ref={body} onKeyDown={onKeyDown}>
            {visible.map((row) => (
              <tr
                key={row.id}
                data-id={row.id}
                tabIndex={0}
                class={`forms-row stage-${row.stage}${known.current!.has(row.id) ? "" : " is-new"}${row.tag ? ` tagged-${row.tag}` : ""}`}
                aria-label={`${row.name}, ${row.courseLabel}`}
              >
                <td class="forms-num">{rows.indexOf(row) + 1}</td>
                <td class="forms-name">{row.name}</td>
                <td>{row.courseLabel}</td>
                <td>{row.semester}º</td>
                <td class="forms-phrase">{row.motivationText}</td>
                <td>
                  <span class={`stage-pill stage-${row.stage}`}>{STAGE_LABEL[row.stage]}</span>
                </td>
                <td class="forms-tags">
                  {(["call", "maybe", "no"] as const).map((value) => (
                    <button key={value} type="button" tabIndex={-1} class={`tag-btn tag-${value}`} aria-pressed={row.tag === value} onClick={() => tag(row, value)}>
                      {TAG_LABEL[value]}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 ? (
          <div class="orders-empty forms-empty">
            <strong>{rows.length === 0 ? "Aguardando respostas…" : "Nenhuma resposta com esses filtros."}</strong>
            <span>{rows.length === 0 ? "O formulário recebe as primeiras inscrições assim que for publicado." : "Limpe a busca ou os filtros."}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FormsHead({ title, status }: { title: string; status: string }) {
  return (
    <header class="forms-head">
      <div class="forms-brand" aria-hidden="true">
        <span class="forms-logo">▦</span>
        <span>Formulários Goggle</span>
      </div>
      <h2>{title}</h2>
      <span class="forms-status">{status}</span>
    </header>
  );
}

function SortHeader({ column, sort, onSort }: { column: { id: SheetColumn; label: string }; sort: SheetSort; onSort: () => void }) {
  const active = sort.column === column.id;
  return (
    <th scope="col" aria-sort={active ? (sort.descending ? "descending" : "ascending") : "none"}>
      <button type="button" class="forms-sort" onClick={onSort}>
        {column.label}
        <span aria-hidden="true">{active ? (sort.descending ? " ▼" : " ▲") : ""}</span>
      </button>
    </th>
  );
}
