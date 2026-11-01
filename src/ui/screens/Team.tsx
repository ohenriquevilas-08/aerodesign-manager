import { useState } from "preact/hooks";
import { useGame } from "../../app/useGame";
import {
  academicFactor,
  canWork,
  clockToDate,
  DISCIPLINES,
  isOverloaded,
  memberHoursPerDay,
  type Discipline,
  type Member
} from "../../sim";
import { Meter } from "../components/Controls";
import { Formation } from "../team/Formation";
import { WorkshopSchedule } from "../team/WorkshopSchedule";
import { DISCIPLINE_LABEL, DISCIPLINE_SHORT, formatNumber, motivationLabel, ROLE_LABEL } from "../format";

// Tela Equipe (design §5), só leitura: elenco, conhecimento tácito por disciplina e o acervo
// documentado da equipe. Alocação e seletiva chegam com os comandos da simulação.

/** Disciplina mais forte da pessoa, para o subtítulo do capitão. */
function focusOf(member: Member): Discipline | null {
  let best: Discipline | null = null;
  for (const discipline of DISCIPLINES) {
    if (member.knowledge[discipline] > (best ? member.knowledge[best] : 0)) best = discipline;
  }
  return best;
}

type TeamTab = "formation" | "roster" | "schedule";
// Sobrevive à troca de tela; não é estado do jogo.
let savedTab: TeamTab = "formation";

function motivationTone(value: number) {
  if (value >= 75) return "ok" as const;
  if (value >= 50) return "accent" as const;
  if (value >= 25) return "warn" as const;
  return "danger" as const;
}

export function Team() {
  const [tab, setTabState] = useState(savedTab);
  const setTab = (value: TeamTab) => setTabState((savedTab = value));
  const members = useGame((state) => state.members);
  const documented = useGame((state) => state.documented);
  const day = useGame((state) => Math.floor(state.clock.hours / 24));
  const tasks = useGame((state) => state.tasks);
  const date = clockToDate(day * 24);
  const academic = academicFactor(date);
  const workers = members.filter(canWork);
  const teamHours = workers.reduce((sum, member) => sum + memberHoursPerDay(member, date), 0);

  return (
    <div class="screen">
      <header class="screen-head">
        <h1 class="screen-title">Equipe</h1>
        <div class="tabs team-tabs" role="tablist" aria-label="Visão da equipe">
          <button type="button" role="tab" aria-selected={tab === "formation"} onClick={() => setTab("formation")}>
            Escalação
          </button>
          <button type="button" role="tab" aria-selected={tab === "roster"} onClick={() => setTab("roster")}>
            Elenco
          </button>
          <button type="button" role="tab" aria-selected={tab === "schedule"} onClick={() => setTab("schedule")}>
            Escala da oficina
          </button>
        </div>
        <div class="stat-row">
          <span class="stat">
            <span class="stat-label">Integrantes</span>
            <strong>{workers.length}</strong>
          </span>
          <span class="stat">
            <span class="stat-label">Horas/dia hoje</span>
            <strong class="text-hours">⏱ {formatNumber(teamHours, 1)} h</strong>
          </span>
          <span class="stat">
            <span class="stat-label">Período</span>
            <strong>
              {academic.label} · ×{formatNumber(academic.factor, 1)}
            </strong>
          </span>
        </div>
      </header>
      {tab === "formation" ? <Formation /> : null}
      {tab === "schedule" ? <WorkshopSchedule /> : null}
      <div class="team-grid" hidden={tab !== "roster"}>
        <div class="member-list scroll-col">
          {members.map((member) => {
            const focus = focusOf(member);
            return (
              <article key={member.id} class="panel member">
                <header class="member-head">
                  <span class="avatar" aria-hidden="true">
                    {member.name.charAt(0)}
                  </span>
                  <div>
                    <div class="member-name">{member.name}</div>
                    <div class="member-role">
                      {ROLE_LABEL[member.role]}
                      {member.role === "captain" && focus ? ` de ${DISCIPLINE_SHORT[focus]}` : ""} · sai em{" "}
                      {member.graduation}
                    </div>
                  </div>
                  {canWork(member) ? (
                    <span
                      class="member-hours text-hours"
                      title={`Base ${formatNumber(member.hoursPerDay)} h/dia × período acadêmico × motivação`}
                    >
                      ⏱ {formatNumber(memberHoursPerDay(member, date), 1)} h/dia
                    </span>
                  ) : null}
                </header>
                <div class={`member-task${isOverloaded(member) ? " is-overloaded" : ""}`}>
                  {!canWork(member)
                    ? "Você decide e coordena; o trabalho operacional fica com a equipe."
                    : member.taskId
                      ? `Trabalhando em: ${tasks.find((task) => task.id === member.taskId)?.label ?? "tarefa"}`
                      : "Sem tarefa: motivação cai a cada dia parado"}
                  {isOverloaded(member) ? " · sobrecarregado" : ""}
                </div>
                <div class="member-body">
                  <div class="knowledge">
                    {DISCIPLINES.map((discipline) => (
                      <div key={discipline} class="knowledge-row" title={DISCIPLINE_LABEL[discipline]}>
                        <span class="knowledge-label">{DISCIPLINE_SHORT[discipline]}</span>
                        <Meter
                          value={Math.max(member.knowledge[discipline], documented[discipline])}
                          floor={documented[discipline]}
                          label={DISCIPLINE_LABEL[discipline]}
                        />
                        <span class="knowledge-value">{Math.round(member.knowledge[discipline])}</span>
                      </div>
                    ))}
                  </div>
                  <div class="traits">
                    <Trait
                      label="Motivação"
                      value={member.motivation}
                      text={motivationLabel(member.motivation)}
                      tone={motivationTone(member.motivation)}
                    />
                    <Trait label="Fabricação" value={member.fabrication} />
                    <Trait label="Comunicação" value={member.communication} />
                    <Trait label="Pilotagem" value={member.piloting} />
                    <Trait label="Agilidade" value={member.agility} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <section class="panel">
          <h2 class="panel-title">Conhecimento documentado</h2>
          <div class="panel-body stack-tight">
            <p class="muted small">
              O acervo da equipe. É o piso de qualquer integrante na disciplina e fica quando as pessoas saem. Cresce
              com a tarefa "Documentar conhecimento".
            </p>
            {DISCIPLINES.map((discipline) => {
              const best = Math.max(...members.map((member) => member.knowledge[discipline]), 0);
              return (
                <div key={discipline} class="doc-row">
                  <div class="doc-head">
                    <span>{DISCIPLINE_LABEL[discipline]}</span>
                    <span class="knowledge-value">{Math.round(documented[discipline])}</span>
                  </div>
                  <Meter value={documented[discipline]} tone="highlight" label={DISCIPLINE_LABEL[discipline]} />
                  {best > documented[discipline] ? (
                    <span class="doc-risk">
                      {formatNumber(best - documented[discipline])} pontos só na cabeça de alguém
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function Trait({
  label,
  value,
  text,
  tone,
}: {
  label: string;
  value: number;
  text?: string;
  tone?: "ok" | "accent" | "warn" | "danger";
}) {
  return (
    <div class="trait">
      <div class="trait-head">
        <span>{label}</span>
        <span class="knowledge-value">{text ?? Math.round(value)}</span>
      </div>
      <Meter value={value} tone={tone ?? "accent"} label={label} />
    </div>
  );
}
