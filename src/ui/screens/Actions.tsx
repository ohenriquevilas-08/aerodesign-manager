import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import {
  ACTIONS,
  canWork,
  clockToDate,
  DISCIPLINES,
  estimateRemainingDays,
  estimateTaskDays,
  findAction,
  formatCountdown,
  memberHoursPerDay,
  PART_STATE_LABELS,
  partState,
  SELECTION_FORMATS,
  type ActionCategory,
  type ActionDef,
  type Task
} from "../../sim";
import { ActionCard, CostLegend, CostTag } from "../components/CostTag";
import { Meter } from "../components/Controls";
import { crewText, DISCIPLINE_LABEL, formatDays, formatNumber } from "../format";

// Tela Ações (design §4.2 e §8): iniciar uma ação cria uma tarefa. O tempo não pula: a tarefa
// espera o prazo ⌛ e avança com as horas de quem está alocado, até o limite de pessoas da ação.

const GROUPS: { category: ActionCategory; title: string }[] = [
  { category: "hours", title: "Só horas" },
  { category: "credits", title: "Só créditos" },
  { category: "both", title: "Horas + créditos" }
];

export function Actions() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? findAction(selectedId) : undefined;

  return (
    <div class="screen">
      <header class="screen-head">
        <h1 class="screen-title">Ações</h1>
        <CostLegend />
      </header>
      <div class="actions-grid">
        <div class="catalog">
          {GROUPS.map((group) => {
            const actions = ACTIONS.filter((action) => action.category === group.category);
            return (
              <section key={group.category} class="panel">
                <h2 class="panel-title">
                  {group.title} <span class="panel-count">{actions.length}</span>
                </h2>
                <div class="panel-body stack-tight">
                  {actions.map((action) => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      selected={action.id === selectedId}
                      onSelect={() => setSelectedId(action.id === selectedId ? null : action.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <div class="stack scroll-col">
          {selected ? (
            <Composer key={selected.id} action={selected} onClose={() => setSelectedId(null)} />
          ) : (
            <p class="panel hint-panel muted">Escolha uma ação para ver quem pode fazer e quanto tempo leva.</p>
          )}
          <TaskList />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Nova tarefa

function Composer({ action, onClose }: { action: ActionDef; onClose: () => void }) {
  const hour = useGame((state) => Math.floor(state.clock.hours));
  const members = useGame((state) => state.members).filter(canWork);
  const credits = useGame((state) => state.credits);
  const stock = useGame((state) => state.stock);
  const parts = useGame((state) => state.parts);
  const tasks = useGame((state) => state.tasks);
  const date = clockToDate(hour);

  // Começa com quem está livre, até o número ideal de pessoas.
  const [picked, setPicked] = useState<string[]>(() =>
    members
      .filter((member) => member.taskId === null)
      .slice(0, action.crew.ideal)
      .map((member) => member.id)
  );
  const [target, setTarget] = useState("");

  const usesCrew = action.crew.max > 0;
  const estimate = estimateTaskDays(store.getState(), action.id, usesCrew ? picked : []);
  const missingStock = Object.entries(action.requires ?? {}).filter(([item, amount]) => (stock[item] ?? 0) < (amount ?? 0));
  const waitingTasks = tasks.filter((task) => task.status === "waiting" && task.readyAt !== null && task.readyAt > hour);

  const problems = [
    credits < action.cost.credits ? `Caixa insuficiente: faltam ◆ ${formatNumber(action.cost.credits - credits)}.` : null,
    missingStock.length > 0 ? `Falta ${missingStock.map(([item]) => item).join(", ")} no estoque.` : null,
    action.target && !target ? TARGET_PROMPT[action.target] : null
  ].filter((text): text is string => text !== null);

  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : current.length < action.crew.max ? [...current, id] : current
    );

  const start = () => {
    const before = store.getState().tasks.length;
    store.dispatch({ type: "start-action", actionId: action.id, targetId: target || undefined });
    const after = store.getState();
    const created = after.tasks.length > before ? after.tasks[after.tasks.length - 1] : undefined;
    if (!created) return; // recusado: o aviso da simulação aparece no topo
    if (created.status !== "done") {
      for (const memberId of picked) store.dispatch({ type: "assign-member", memberId, taskId: created.id });
    }
    onClose();
  };

  return (
    <section class="panel composer">
      <h2 class="panel-title composer-title">
        <span>{action.label}</span>
        <button type="button" class="icon-btn" aria-label="Fechar" onClick={onClose}>
          ×
        </button>
      </h2>
      <div class="panel-body stack-tight">
        <CostTag cost={action.cost} />
        {action.requires ? (
          <p class="muted small">
            Consome do estoque:{" "}
            {Object.entries(action.requires)
              .map(([item, amount]) => `${amount} ${item} (tem ${stock[item] ?? 0})`)
              .join(", ")}
          </p>
        ) : null}

        {action.target === "discipline" ? (
          <TargetSelect label="Disciplina" value={target} onChange={setTarget}>
            {DISCIPLINES.map((discipline) => (
              <option key={discipline} value={discipline}>
                {DISCIPLINE_LABEL[discipline]}
              </option>
            ))}
          </TargetSelect>
        ) : null}
        {action.target === "selection-format" ? (
          <>
            <TargetSelect label="Formato da seletiva" value={target} onChange={setTarget}>
              {SELECTION_FORMATS.map((format) => (
                <option key={format.id} value={format.id}>
                  {format.label} · {format.candidates} candidatos
                </option>
              ))}
            </TargetSelect>
            {target ? <p class="muted small">{SELECTION_FORMATS.find((format) => format.id === target)?.description}</p> : null}
          </>
        ) : null}
        {action.target === "part" ? (
          <TargetSelect label="Peça" value={target} onChange={setTarget} empty="Nenhuma peça fabricada ainda">
            {parts.map((part) => (
              <option key={part.id} value={part.id}>
                {part.label} · {PART_STATE_LABELS[partState(part.condition)]} ({Math.round(part.condition)})
              </option>
            ))}
          </TargetSelect>
        ) : null}
        {action.target === "waiting-task" ? (
          <TargetSelect label="Encomenda" value={target} onChange={setTarget} empty="Nada chegando no momento">
            {waitingTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.label} · chega em {formatCountdown(hour, clockToDate(task.readyAt ?? hour))}
              </option>
            ))}
          </TargetSelect>
        ) : null}

        {usesCrew ? (
          <>
            <div class="crew-head">
              <span class="slider-label">Quem trabalha</span>
              <span class="crew-rule">{crewText(action.crew)}</span>
            </div>
            <div class="crew-list">
              {members.map((member) => {
                const checked = picked.includes(member.id);
                const busy = member.taskId ? tasks.find((task) => task.id === member.taskId) : undefined;
                const full = !checked && picked.length >= action.crew.max;
                return (
                  <label key={member.id} class={`crew-option${full ? " is-disabled" : ""}`}>
                    <input type="checkbox" checked={checked} disabled={full} onChange={() => toggle(member.id)} />
                    <span class="crew-name">{member.name}</span>
                    <span class="crew-meta">
                      {busy ? `sai de: ${busy.label}` : "livre"} · ⏱ {formatNumber(memberHoursPerDay(member, date), 1)} h/dia
                    </span>
                  </label>
                );
              })}
            </div>
            {picked.length > action.crew.ideal ? (
              <p class="muted small">Acima de {action.crew.ideal}, cada pessoa extra rende metade.</p>
            ) : null}
          </>
        ) : (
          <p class="muted small">Não ocupa ninguém: é só esperar a entrega.</p>
        )}

        <div class="estimate">
          <span class="slider-label">Fica pronto em</span>
          <strong class={estimate === null ? "text-danger" : "text-accent"}>{formatDays(estimate)}</strong>
        </div>
        {estimate === null ? (
          <p class="muted small">
            {picked.length === 0
              ? "Sem ninguém alocado a tarefa fica parada. Dá para alocar depois."
              : `Precisa de pelo menos ${action.crew.min} pessoas para andar.`}
          </p>
        ) : null}
        {problems.map((text) => (
          <p key={text} class="alert alert-warn">
            {text}
          </p>
        ))}
        <button type="button" class="btn-primary" disabled={problems.length > 0} onClick={start}>
          Iniciar
        </button>
      </div>
    </section>
  );
}

const TARGET_PROMPT: Record<NonNullable<ActionDef["target"]>, string> = {
  discipline: "Escolha a disciplina.",
  "selection-format": "Escolha o formato da seletiva.",
  part: "Escolha a peça.",
  "waiting-task": "Escolha a encomenda a acelerar."
};

function TargetSelect({
  label,
  value,
  onChange,
  empty,
  children
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  empty?: string;
  children: ComponentChildren;
}) {
  const hasOptions = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <label class="select-field">
      <span class="slider-label">{label}</span>
      <select value={value} disabled={!hasOptions} onChange={(event) => onChange(event.currentTarget.value)}>
        <option value="">{hasOptions ? "Escolher…" : empty ?? "Nada disponível"}</option>
        {children}
      </select>
    </label>
  );
}

// ---------------------------------------------------------------------------------------------
// Tarefas em andamento

function TaskList() {
  const tasks = useGame((state) => state.tasks);
  const open = tasks.filter((task) => task.status !== "done");
  const done = tasks.filter((task) => task.status === "done").slice(-3).reverse();

  return (
    <section class="panel">
      <h2 class="panel-title">
        Tarefas <span class="panel-count">{open.length}</span>
      </h2>
      <div class="panel-body stack-tight">
        {open.length === 0 ? <p class="muted">Nenhuma tarefa aberta. Escolha uma ação ao lado.</p> : null}
        {open.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
        {done.length > 0 ? <p class="group-label">Concluídas</p> : null}
        {done.map((task) => (
          <div key={task.id} class="task-done">
            ✓ {task.label}
          </div>
        ))}
      </div>
    </section>
  );
}

function TaskRow({ task }: { task: Task }) {
  const members = useGame((state) => state.members);
  const hour = useGame((state) => Math.floor(state.clock.hours));
  const [confirming, setConfirming] = useState(false);
  const action = findAction(task.actionId);
  const crew = action?.crew ?? { min: 0, ideal: 0, max: 0 };
  const remaining = estimateRemainingDays(store.getState(), task.id);
  const waiting = task.status === "waiting" && task.readyAt !== null && task.readyAt > hour;
  const stalled = !waiting && task.hoursTotal > 0 && task.assignees.length < Math.max(1, crew.min);
  const candidates = members.filter((member) => canWork(member) && !task.assignees.includes(member.id));
  const progress = task.hoursTotal > 0 ? (task.hoursDone / task.hoursTotal) * 100 : 0;

  return (
    <article class={`task${stalled ? " is-stalled" : ""}`}>
      <div class="task-head">
        <span class="task-label">{task.label}</span>
        <span class={`task-status${stalled ? " text-danger" : ""}`}>
          {waiting
            ? `⌛ ${formatCountdown(hour, clockToDate(task.readyAt ?? hour))}`
            : stalled
              ? "parada"
              : formatDays(remaining)}
        </span>
      </div>
      {task.hoursTotal > 0 ? (
        <div class="task-progress">
          <Meter value={progress} label={`Progresso de ${task.label}`} />
          <span class="knowledge-value">
            {formatNumber(task.hoursDone)}/{formatNumber(task.hoursTotal)} h
          </span>
        </div>
      ) : null}
      {crew.max > 0 ? (
        <div class="task-crew">
          {task.assignees.map((id) => (
            <span key={id} class="chip chip-member">
              {members.find((member) => member.id === id)?.name ?? id}
              <button
                type="button"
                aria-label="Tirar da tarefa"
                onClick={() => store.dispatch({ type: "unassign-member", memberId: id })}
              >
                ×
              </button>
            </span>
          ))}
          {task.assignees.length < crew.max && candidates.length > 0 ? (
            <select
              class="add-member"
              value=""
              aria-label="Alocar integrante"
              onChange={(event) => {
                const memberId = event.currentTarget.value;
                if (memberId) store.dispatch({ type: "assign-member", memberId, taskId: task.id });
              }}
            >
              <option value="">+ pessoa</option>
              {candidates.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                  {member.taskId ? " (sai da tarefa atual)" : ""}
                </option>
              ))}
            </select>
          ) : null}
          <span class="crew-rule">{crewText(crew)}</span>
        </div>
      ) : null}
      <div class="task-actions">
        {confirming ? (
          <>
            <span class="muted small">Créditos e material não voltam.</span>
            <button type="button" class="btn-ghost btn-danger" onClick={() => store.dispatch({ type: "cancel-task", taskId: task.id })}>
              Confirmar
            </button>
            <button type="button" class="btn-ghost" onClick={() => setConfirming(false)}>
              Manter
            </button>
          </>
        ) : (
          <button type="button" class="btn-ghost" onClick={() => setConfirming(true)}>
            Cancelar tarefa
          </button>
        )}
      </div>
    </article>
  );
}
