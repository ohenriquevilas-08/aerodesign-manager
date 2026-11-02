import { useState } from "preact/hooks";
import { useGame } from "../../app/useGame";
import { academicFactor, clockToDate, memberHoursPerDay, rosterMembers } from "../../sim";
import { Formation } from "../team/Formation";
import { Roster } from "../team/Roster";
import { Selection } from "../team/Selection";
import { WorkshopSchedule } from "../team/WorkshopSchedule";
import { formatNumber } from "../format";

// Tela Equipe (design §5): escalação, Central do Elenco (Fase 6, U5) e escala da oficina.

type TeamTab = "formation" | "roster" | "schedule" | "selection";
// Sobrevive à troca de tela; não é estado do jogo.
let savedTab: TeamTab = "formation";

export function Team() {
  const [tab, setTabState] = useState(savedTab);
  const setTab = (value: TeamTab) => setTabState((savedTab = value));
  const members = useGame((state) => state.members);
  const day = useGame((state) => Math.floor(state.clock.hours / 24));
  const date = clockToDate(day * 24);
  const academic = academicFactor(date);
  const workers = rosterMembers({ members });
  const president = members.find((member) => member.role === "president");
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
          <button type="button" role="tab" aria-selected={tab === "selection"} onClick={() => setTab("selection")}>
            Seletiva
          </button>
        </div>
        {president ? (
          <span class="stat" title="Aluno eleito na fundação; o jogador é o professor orientador">
            <span class="stat-label">Presidente</span>
            <strong>{president.name}</strong>
          </span>
        ) : null}
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
      {tab === "roster" ? <Roster /> : null}
      {tab === "selection" ? <Selection /> : null}
    </div>
  );
}
