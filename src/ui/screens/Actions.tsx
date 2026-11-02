import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import {
  ACTIONS,
  canWork,
  clockToDate,
  formatDate,
  type TaskEta,
  DEDICATIONS,
  DISCIPLINES,
  effectiveKnowledge,
  estimateOutcome,
  estimateTaskDays,
  taskEta,
  findAction,
  formatCountdown,
  leadDaysRange,
  memberHoursPerDay,
  PART_STATE_LABELS,
  regulationPublished,
  partState,
  SELECTION_FORMATS,
  type ActionDef,
  type Dedication,
  type Discipline,
  type Member,
  type Task,
  crewEfficiency,
  taskKeeps,
  type GameState,
} from "../../sim";
import { ActionCard, CostTag } from "../components/CostTag";
import { EnergyBar, energyTone } from "../components/Energy";
import { useDerived } from "../hooks";
import { actionGroups, deliveredText, groupOf, groupSummary, yieldText, type ActionGroupId } from "../actionsView";
import { Meter } from "../components/Controls";
import { takeIntent } from "../nav";
import { crewText, isCounterfeit, DISCIPLINE_LABEL, DISCIPLINE_SHORT, formatDays, formatNumber, SKILL_LABEL } from "../format";

// Tela Ações (design §4.2 e §8): iniciar uma ação cria uma tarefa. O tempo não pula: a tarefa
// espera o prazo ⌛ e avança com as horas de quem está alocado, até o limite de pessoas da ação.

export function Actions() {
  const readDue = useGame((state) => regulationPublished(state) && !state.regulationRead);
  // Vindo do Relatório ("Escrever"): abre a ação já com o alvo escolhido.
  const [intent] = useState(takeIntent);
  const [selectedId, setSelectedId] = useState<string | null>(intent?.actionId ?? null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<ActionGroupId>>(() => {
    const first = intent?.actionId ? groupOf(intent.actionId) : null;
    return new Set(first ? [first] : []);
  });
  const selected = selectedId ? findAction(selectedId) : undefined;
  const groups = useDerived((state) => actionGroups(state, query), [query]);
  const searching = query.trim() !== "";
  // Só o que dá para fazer agora vira grupo; o resto fica na linha "Mais adiante".
  const visible = groups.filter((group) => group.available.length > 0);
  const later = groups.flatMap((group) => group.later);
  const toggle = (id: ActionGroupId) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div class="screen">
      <header class="screen-head">
        <h1 class="screen-title">Ações</h1>
        <input
          type="search"
          class="action-search"
          placeholder="Buscar ação pelo nome"
          aria-label="Buscar ação pelo nome"
          value={query}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
      </header>
      <div class="actions-grid">
        <div class="catalog scroll-col">
          {visible.map((group) => {
            const expanded = searching || open.has(group.id);
            return (
              <section key={group.id} class={`action-group${expanded ? " is-open" : ""}`} data-group={group.id}>
                <button type="button" class="action-group-head" aria-expanded={expanded} onClick={() => toggle(group.id)}>
                  <span class="action-group-chevron" aria-hidden="true">
                    {expanded ? "▾" : "▸"}
                  </span>
                  <span class="action-group-title">{group.title}</span>
                  <span class="action-group-summary">{groupSummary(group)}</span>
                  {group.id === "outreach" ? <Reach /> : null}
                </button>
                {expanded ? (
                  <div class="action-group-body">
                    <p class="muted small">{group.goal}</p>
                    {group.available.length === 0 ? <p class="muted small">Nada para fazer agora neste grupo.</p> : null}
                    <div class="action-group-cards">
                      {group.available.map((action) => (
                        <ActionCard
                          key={action.id}
                          action={action}
                          compact
                          selected={action.id === selectedId}
                          highlight={readDue && action.id === "read-regulation"}
                          onSelect={() => setSelectedId(action.id === selectedId ? null : action.id)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}
          {visible.length === 0 && later.length === 0 ? <p class="muted">Nenhuma ação com esse nome.</p> : null}
          {later.length > 0 ? (
            <section class="action-later" aria-label="Mais adiante">
              <h2 class="group-label">Mais adiante</h2>
              <ul>
                {later.map(({ action, reason }) => (
                  <li key={action.id}>
                    <span>{action.label}</span>
                    <span class="muted small">{reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <div class="stack scroll-col">
          {selected ? (
            <Composer key={selected.id} action={selected} initialTarget={intent?.actionId === selected.id ? intent.targetId : undefined} onClose={() => setSelectedId(null)} />
          ) : (
            <p class="panel hint-panel muted">Escolha uma ação para ver quem pode fazer, quanto rende e quanto tempo leva.</p>
          )}
          <TaskList />
        </div>
      </div>
    </div>
  );
}

/** Alcance acumulado da divulgação: alimenta a próxima seletiva e cai com os dias. */
function Reach() {
  const reach = useGame((state) => Math.round(state.outreach));
  return (
    <span class="stat action-reach" title="Soma das ações de divulgação. Cai 3% por dia e zera quando a seletiva termina.">
      <span class="stat-label">Alcance atual</span>
      <strong>{formatNumber(reach)}</strong>
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Nova tarefa

function Composer({ action, initialTarget, onClose }: { action: ActionDef; initialTarget?: string; onClose: () => void }) {
  const hour = useGame((state) => Math.floor(state.clock.hours));
  const members = useGame((state) => state.members).filter(canWork);
  const credits = useGame((state) => state.credits);
  const stock = useGame((state) => state.stock);
  const parts = useGame((state) => state.parts);
  const tasks = useGame((state) => state.tasks);
  const documented = useGame((state) => state.documented);
  const date = clockToDate(hour);

  // Começa com quem está livre, até o número ideal de pessoas.
  const [picked, setPicked] = useState<string[]>(() =>
    members
      .filter((member) => member.taskId === null)
      .slice(0, action.crew.ideal)
      .map((member) => member.id)
  );
  const [target, setTarget] = useState(initialTarget ?? "");
  // Compras não têm dedicação: sempre "normal".
  const [dedication, setDedication] = useState<Dedication>("normal");

  const usesCrew = action.cost.hours > 0;
  const options = DEDICATIONS.map((item) => ({
    ...item,
    days: estimateTaskDays(store.getState(), action.id, usesCrew ? picked : [], item.id),
    outcome: usesCrew ? estimateOutcome(store.getState(), action.id, picked, target || null, item.id) : null
  }));
  const chosen = options.find((item) => item.id === dedication)!;
  const estimate = chosen.days;
  const outcome = chosen.outcome;
  // Disciplina que conta para ações de conhecimento: a da ação ou a escolhida como alvo.
  const skillDiscipline = action.discipline ?? (action.target === "discipline" && target ? (target as Discipline) : null);
  const skillOf = (member: Member): number | null => {
    if (!action.skill) return null;
    if (action.skill === "knowledge") {
      return skillDiscipline ? effectiveKnowledge(member, documented, skillDiscipline) : null;
    }
    return member[action.skill];
  };
  const skillName =
    action.skill === "knowledge" && skillDiscipline
      ? DISCIPLINE_SHORT[skillDiscipline].toLowerCase()
      : action.skill
        ? SKILL_LABEL[action.skill]
        : null;
  const missingStock = Object.entries(action.requires ?? {}).filter(([item, amount]) => (stock[item] ?? 0) < (amount ?? 0));
  const waitingTasks = tasks.filter((task) => task.status === "waiting");

  const problems = [
    credits < action.cost.credits ? `Caixa insuficiente: faltam ◆ ${formatNumber(action.cost.credits - credits)}.` : null,
    missingStock.length > 0 ? `Falta ${missingStock.map(([item]) => item).join(", ")} no estoque.` : null,
    action.target && !target ? TARGET_PROMPT[action.target] : null
  ].filter((text): text is string => text !== null);

  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : action.crew.max === null || current.length < action.crew.max ? [...current, id] : current
    );

  // Ganho de cada pessoa a mais (ou a menos): quanto o prazo muda se ela entrar (ou sair) da equipe.
  const state = store.getState();
  const baseDays = usesCrew ? estimateTaskDays(state, action.id, picked, dedication) : null;
  const deltaDays = (memberId: string, isPicked: boolean): { text: string; good: boolean } | null => {
    if (!usesCrew) return null;
    if (isPicked) {
      if (picked.length <= action.crew.min) return null;
      const without = estimateTaskDays(state, action.id, picked.filter((id) => id !== memberId), dedication);
      if (without === null || baseDays === null) return null;
      return { text: `sai: ${formatDays(without)}`, good: false };
    }
    const member = members.find((item) => item.id === memberId);
    if (!member || member.taskId !== null || (action.crew.max !== null && picked.length >= action.crew.max)) return null;
    const withMember = estimateTaskDays(state, action.id, [...picked, memberId], dedication);
    if (withMember === null) return null;
    if (baseDays === null) return { text: `entra: ${formatDays(withMember)}`, good: true };
    const gain = baseDays - withMember;
    return gain > 0.05 ? { text: `entra: ${formatDays(withMember)} (−${formatNumber(gain, 1)} d)`, good: true } : { text: "entra: sem ganho", good: false };
  };
  const nextShare = Math.round((crewEfficiency(action, picked.length + 1) - crewEfficiency(action, picked.length)) * 100);
  const marginalText =
    action.crew.max !== null && picked.length >= action.crew.max
      ? `Equipe cheia: o espaço comporta no máximo ${action.crew.max}.`
      : picked.length < action.crew.ideal
        ? `Até ${action.crew.ideal} pessoas, cada uma rende 100%.`
        : `Acima de ${action.crew.ideal}, cada extra rende menos: a próxima pessoa rende ${nextShare}% de uma inteira.`;
  const exhaustedPicked = members.filter((member) => picked.includes(member.id) && energyTone(member.energy) === "exhausted");

  const start = () => {
    const before = store.getState().tasks.length;
    store.dispatch({
      type: "start-action",
      actionId: action.id,
      targetId: target || undefined,
      dedication: usesCrew ? dedication : undefined,
      memberIds: usesCrew ? picked : undefined
    });
    // Recusado (sem o mínimo de gente, por exemplo): o aviso da simulação aparece no topo.
    if (store.getState().tasks.length > before) onClose();
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
        <CostTag cost={action.cost} lead={leadDaysRange(action.id)} />
        {yieldText(action) ? <p class="muted small">{yieldText(action)}</p> : null}
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
                  {format.label}
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
                {part.label} · {PART_STATE_LABELS[partState(part.condition)]} ({Math.round(part.condition)}){isCounterfeit(part) ? " · fora da especificação" : ""}
              </option>
            ))}
          </TargetSelect>
        ) : null}
        {action.target === "waiting-task" ? (
          <TargetSelect label="Encomenda" value={target} onChange={setTarget} empty="Nada chegando no momento">
            {waitingTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.label} · {arrivalText(hour, task)}
              </option>
            ))}
          </TargetSelect>
        ) : null}

        {usesCrew ? (
          <>
            <div class="crew-head">
              <span class="slider-label">Quem trabalha</span>
              <span class="crew-rule">
                {picked.length} {picked.length === 1 ? "escolhida" : "escolhidas"} · {crewText(action.crew)}
              </span>
            </div>
            {skillName ? <p class="muted small">Rende conforme {skillName}, motivação e energia de quem trabalha.</p> : null}
            <div class="crew-list">
              {members.map((member) => {
                const checked = picked.includes(member.id);
                const busy = member.taskId ? tasks.find((task) => task.id === member.taskId) : undefined;
                const full = !checked && action.crew.max !== null && picked.length >= action.crew.max;
                const taken = member.taskId !== null;
                const skill = skillOf(member);
                const delta = deltaDays(member.id, checked);
                return (
                  <label key={member.id} class={`crew-option${full || taken ? " is-disabled" : ""}${checked ? " is-picked" : ""}`}>
                    <input type="checkbox" checked={checked} disabled={full || taken} onChange={() => toggle(member.id)} />
                    <span class="crew-name">{member.name}</span>
                    <EnergyBar member={member} showValue />
                    <span class="crew-meta">
                      {busy ? `ocupado em: ${busy.label}` : "livre"} · ⏱ {formatNumber(memberHoursPerDay(member, date), 1)} h/dia
                      {skill !== null ? ` · ${skillName} ${Math.round(skill)}` : ""}
                      {energyTone(member.energy) !== "ok" ? ` · ${energyTone(member.energy) === "tired" ? "cansado" : "exausto"}` : ""}
                    </span>
                    {delta ? <span class={`crew-gain ${delta.good ? "is-good" : ""}`}>{delta.text}</span> : null}
                  </label>
                );
              })}
            </div>
            <p class="muted small crew-marginal">{marginalText}</p>
            {exhaustedPicked.length > 0 ? (
              <p class="alert alert-warn">
                {exhaustedPicked.map((member) => member.name.split(" ")[0]).join(", ")} {exhaustedPicked.length === 1 ? "está exausto e não vai render" : "estão exaustos e não vão render"} até descansar.
              </p>
            ) : null}
          </>
        ) : (
          <p class="muted small">Não ocupa ninguém: é só esperar a entrega.</p>
        )}

        {usesCrew ? (
          <div class="segmented-field">
            <span class="slider-label">Dedicação</span>
            <div class="dedication" role="radiogroup" aria-label="Dedicação">
              {options.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={item.id === dedication}
                  class="dedication-option"
                  onClick={() => setDedication(item.id)}
                >
                  <span class="dedication-label">{item.label}</span>
                  <span class="dedication-rule">
                    ⏱ ×{formatNumber(item.hoursFactor, 1)} · qualidade{" "}
                    {item.qualityBonus > 0 ? "+" : item.qualityBonus < 0 ? "−" : "±"}
                    {Math.abs(item.qualityBonus)}
                  </span>
                  <span class="dedication-days">{formatDays(item.days)}</span>
                  {item.outcome ? <span class="dedication-outcome">{item.outcome.text}</span> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div class="estimate">
          <span class="slider-label">Fica pronto em</span>
          <strong class={estimate === null ? "text-danger" : "text-accent"}>{formatDays(estimate)}</strong>
        </div>
        {outcome ? (
          <div class="outcome">
            <div class="estimate">
              <span class="slider-label">Resultado esperado</span>
              <strong class="text-highlight">{outcome.text}</strong>
            </div>
            <div class="task-progress">
              <Meter value={outcome.quality} tone="highlight" label="Qualidade da equipe" />
              <span class="knowledge-value">qualidade {Math.round(outcome.quality)}</span>
            </div>
          </div>
        ) : null}
        {estimate === null ? (
          <p class="muted small">
            {`Escolha pelo menos ${action.crew.min} ${action.crew.min === 1 ? "pessoa livre" : "pessoas livres"} para começar: tarefa não anda sozinha.`}
          </p>
        ) : null}
        {problems.map((text) => (
          <p key={text} class="alert alert-warn">
            {text}
          </p>
        ))}
        <button type="button" class="btn-primary" disabled={problems.length > 0 || (usesCrew && picked.length < action.crew.min)} onClick={start}>
          Começar
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

/** Prazo prometido (a data real fica escondida): contagem regressiva ou "atrasado". */
function arrivalText(hour: number, task: Task): string {
  const promised = task.expectedReadyAt ?? hour;
  return promised > hour ? `previsto em ${formatCountdown(hour, clockToDate(promised))}` : "atrasado, aguardando";
}

/** Prazo da tarefa em dias de calendário: "hoje", "amanhã" ou "em N dias (data)". */
function etaText(eta: TaskEta | null): string {
  if (!eta || eta.finishesAt === null || eta.daysLeft === null) return "parada";
  if (eta.daysLeft === 0) return "termina hoje";
  const when = formatDate(clockToDate(eta.finishesAt));
  return eta.daysLeft === 1 ? `termina amanhã (${when})` : `termina em ${eta.daysLeft} dias (${when})`;
}

function TaskRow({ task }: { task: Task }) {
  const members = useGame((state) => state.members);
  const hour = useGame((state) => Math.floor(state.clock.hours));
  const [confirming, setConfirming] = useState(false);
  const action = findAction(task.actionId);
  const crew = action?.crew ?? { min: 0, ideal: 0, max: 0 as number | null };
  const eta = taskEta(store.getState(), task.id);
  const waiting = task.status === "waiting";
  const stalled = !waiting && task.hoursTotal > 0 && task.assignees.length < Math.max(1, crew.min);
  // Só gente livre entra (quem está em outra tarefa precisa ser liberado antes).
  const candidates = members.filter((member) => canWork(member) && member.taskId === null);
  const progress = eta?.percent ?? 0;
  const delivered = deliveredText(task, action);
  const canAdd = crew.max === null || task.assignees.length < crew.max;
  const canRemove = task.assignees.length > crew.min;
  const nextShare = action ? Math.round((crewEfficiency(action, task.assignees.length + 1) - crewEfficiency(action, task.assignees.length)) * 100) : 0;

  return (
    <article class={`task${stalled ? " is-stalled" : ""}`} data-task={task.id}>
      <div class="task-head">
        <span class="task-label">{task.label}</span>
        <span class={`task-status${stalled ? " text-danger" : ""}`}>
          {waiting
            ? `⌛ ${arrivalText(hour, task)}`
            : stalled
              ? "parada"
              : etaText(eta)}
        </span>
      </div>
      {task.hoursTotal > 0 ? (
        <div class="task-progress">
          <Meter value={progress} label={`Progresso de ${task.label}`} />
          <span class="knowledge-value">
            {formatNumber(progress)}%
          </span>
        </div>
      ) : null}
      {delivered ? <span class="task-delivered">{delivered}</span> : null}
      {eta && task.hoursTotal > 0 && eta.workHoursLeft > 0 ? (
        <span class="task-eta-detail">Faltam {formatNumber(eta.workHoursLeft)} h de trabalho (horas-pessoa, somadas entre a equipe).</span>
      ) : null}
      {task.hoursTotal > 0 ? (
        <div class="task-crew">
          {task.assignees.map((id) => {
            const member = members.find((item) => item.id === id);
            return (
              <span key={id} class="chip chip-member">
                {member?.name ?? id}
                {member ? <EnergyBar member={member} /> : null}
                {canRemove ? (
                  <button type="button" aria-label="Tirar da tarefa" onClick={() => store.dispatch({ type: "unassign-member", memberId: id })}>
                    ×
                  </button>
                ) : null}
              </span>
            );
          })}
          {canAdd && candidates.length > 0 ? (
            <select
              class="add-member"
              value=""
              aria-label="Pôr mais uma pessoa"
              title={`A próxima pessoa rende ${nextShare}% de uma inteira`}
              onChange={(event) => {
                const memberId = event.currentTarget.value;
                if (memberId) store.dispatch({ type: "assign-member", memberId, taskId: task.id });
              }}
            >
              <option value="">+ pessoa ({nextShare}%)</option>
              {candidates.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} · energia {Math.round(member.energy)}
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
            <span class="muted small">{taskKeeps(store.getState(), task.id) || "Créditos e material não voltam."}</span>
            <button type="button" class="btn-ghost btn-danger" onClick={() => store.dispatch({ type: "close-task", taskId: task.id })}>
              Confirmar
            </button>
            <button type="button" class="btn-ghost" onClick={() => setConfirming(false)}>
              Manter
            </button>
          </>
        ) : (
          <button type="button" class="btn-ghost" onClick={() => setConfirming(true)}>
            Encerrar agora
          </button>
        )}
      </div>
    </article>
  );
}
