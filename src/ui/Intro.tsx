import { useEffect, useMemo, useState } from "preact/hooks";
import { foundTeam } from "../app/session";
import { store } from "../app/store";
import { IntroScene } from "../scenes/IntroScene";
import { introChannel } from "../scenes/intro/channel";
import { DEFAULT_ADVISOR_NAME, DEFAULT_CATEGORY, findAgenda, FORMATIONS, FOUNDERS, type Discipline, type FounderFlair, type Member } from "../sim";
import { PixelAvatar } from "./components/PixelAvatar";
import { DISCIPLINE_LABEL, DISCIPLINE_SHORT } from "./format";
import { PhaserStage } from "./PhaserStage";

// Abertura e fundação (Fase 6, U2): em tela cheia antes do jogo, em 3 passos. A cena (C1) só anima;
// o texto e as escolhas moram aqui. Termina com o comando found-team.

/** O que cada fundador diz no convite (uma fala por pessoa, na ordem da fileira). */
const PITCH: Record<FounderFlair, string> = {
  design: "A gente quer montar uma equipe de aerodesign e levar um avião à competição.",
  build: "Já temos gente com vontade de sujar a mão. Falta alguém que nos guie.",
  organize: "Sem professor orientador a universidade não reconhece a equipe. Você aceita orientar a gente?",
  fly: "Prometo que o avião sai do chão. Pelo menos no primeiro voo de ensaio.",
  management: "Eu cuido da papelada e das contas, se o senhor cuidar do rumo.",
  marketing: "Eu levo a equipe para o campus inteiro conhecer."
};

const STEPS = ["Convite", "Conhecer a turma", "Fundar a equipe"] as const;

const founderDef = (member: Member) => FOUNDERS.find((def) => def.id === member.id);

export function Intro({ seed, onDone }: { seed: number; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [line, setLine] = useState(0);
  const [advisorName, setAdvisorName] = useState(() => store.getState().advisor.name);
  const [teamName, setTeamName] = useState(() => store.getState().teamName);
  const founders = useMemo(() => store.getState().members.filter((member) => member.id.startsWith("founder-")), []);
  const [presidentId, setPresidentId] = useState(() => founders.find((member) => member.agenda === "funding")?.id ?? founders[0]!.id);
  const [captains, setCaptains] = useState<Partial<Record<Discipline, string>>>({});
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    introChannel.show(founders.map((member) => ({ id: member.id, name: member.name, look: member.look })));
    return () => introChannel.show([]);
  }, [founders]);

  // Passo 1: cada fundador fala uma vez, em ordem. Passo 2: quem está sob o mouse.
  const speaker = step === 0 ? (line < founders.length ? line : null) : step === 1 ? hovered : null;
  useEffect(() => introChannel.speak(speaker), [speaker]);

  const president = founders.find((member) => member.id === presidentId)!;
  const agenda = findAgenda(president.agenda ?? "balanced");
  const areas = FORMATIONS[DEFAULT_CATEGORY];
  const takenFor = (area: Discipline) =>
    new Set([presidentId, ...Object.entries(captains).filter(([key, id]) => key !== area && id).map(([, id]) => id!)]);

  const pickPresident = (id: string) => {
    setPresidentId(id);
    // Cada fundador assume um só cargo: o novo presidente deixa o posto de capitão.
    setCaptains((current) => Object.fromEntries(Object.entries(current).filter(([, memberId]) => memberId !== id)));
  };
  const pickCaptain = (area: Discipline, memberId: string) =>
    setCaptains((current) => {
      const next = { ...current };
      if (memberId) next[area] = memberId;
      else delete next[area];
      return next;
    });

  const finish = () => {
    foundTeam(seed, advisorName, { presidentId, captains, teamName });
    onDone();
  };

  return (
    <div class="intro">
      <div class="intro-stage">
        <PhaserStage scene={IntroScene} sceneKey="intro" />
      </div>
      <aside class="intro-panel panel">
        <ol class="intro-steps" aria-label="Passos da abertura">
          {STEPS.map((label, index) => (
            <li key={label} class={index === step ? "is-current" : index < step ? "is-done" : undefined}>
              <span class="intro-step-n">{index + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <section class="intro-body">
            <h1 class="intro-title">Segunda-feira, 10 de novembro</h1>
            <p class="muted">
              A última competição acabou há poucas semanas. Quatro alunos batem na porta da sua sala com uma proposta: criar a
              equipe de aerodesign da universidade, com você como professor orientador.
            </p>
            <div class="intro-talk">
              {founders.slice(0, line + 1).map((member, index) => (
                <p key={member.id} class={`intro-line${index === line ? " is-now" : ""}`}>
                  <strong>{member.name}:</strong> {PITCH[member.flair ?? "design"]}
                </p>
              ))}
            </div>
            {line < founders.length - 1 ? (
              <button type="button" class="btn-ghost" onClick={() => setLine(line + 1)}>
                Ouvir o próximo
              </button>
            ) : (
              <div class="intro-accept">
                <label class="field">
                  <span class="field-label">Nome do orientador</span>
                  <input type="text" value={advisorName} maxLength={40} placeholder={DEFAULT_ADVISOR_NAME} onInput={(event) => setAdvisorName((event.target as HTMLInputElement).value)} />
                </label>
                <button type="button" class="btn-primary" onClick={() => setStep(1)}>
                  Aceitar o convite
                </button>
              </div>
            )}
          </section>
        ) : null}

        {step === 1 ? (
          <section class="intro-body">
            <h1 class="intro-title">Conheça a turma</h1>
            <p class="muted">Ninguém tem cargo ainda. Eles dizem o que querem fazer, mas ninguém sabe ainda no que cada um é bom: isso aparece trabalhando. Escolha quem preside pelo que cada um quer para a equipe.</p>
            <div class="founder-cards">
              {founders.map((member, index) => {
                const def = founderDef(member);
                return (
                  <article key={member.id} class="founder-card" onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)}>
                    <PixelAvatar member={member} scale={2} class="founder-portrait" />
                    <div>
                      <h2 class="founder-name">{member.name}</h2>
                      <span class="chip" title={findAgenda(member.agenda ?? "balanced").text}>{findAgenda(member.agenda ?? "balanced").priority}</span>
                      <p class="small">{def?.likes}</p>
                      <p class="small">
                        Diz que quer trabalhar com <strong>{member.statedLikes.length > 0 ? member.statedLikes.map((discipline) => DISCIPLINE_LABEL[discipline].toLowerCase()).join(", ") : "ainda não sabe"}</strong>
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
            <div class="intro-nav">
              <button type="button" class="btn-ghost" onClick={() => setStep(0)}>
                Voltar
              </button>
              <button type="button" class="btn-primary" onClick={() => setStep(2)}>
                Fundar a equipe
              </button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section class="intro-body">
            <h1 class="intro-title">Fundar a equipe</h1>
            <label class="field">
              <span class="field-label">Nome da equipe</span>
              <input type="text" value={teamName} maxLength={48} onInput={(event) => setTeamName((event.target as HTMLInputElement).value)} />
            </label>
            <div class="field">
              <span class="field-label">Presidente</span>
              <div class="pick-row" role="radiogroup" aria-label="Presidente">
                {founders.map((member) => (
                  <button key={member.id} type="button" role="radio" aria-checked={member.id === presidentId} class="pick-chip" onClick={() => pickPresident(member.id)}>
                    <PixelAvatar member={member} scale={1} />
                    {member.name}
                  </button>
                ))}
              </div>
              <p class="small president-agenda">
                <strong>{agenda.priority}</strong> · {agenda.effect}. {agenda.description} Ficar 3 dias seguidos sem tarefa dessa frente desgasta o presidente. Nada é bloqueado.
              </p>
            </div>
            <div class="field">
              <span class="field-label">Capitães por área (opcional)</span>
              <p class="small muted">Cada fundador assume um só cargo. Dá para deixar áreas sem capitão e escolher depois, com a turma maior.</p>
              <div class="captain-grid">
                {areas.map((area) => {
                  const taken = takenFor(area.discipline);
                  return (
                    <label key={area.discipline} class="captain-row">
                      <span>{DISCIPLINE_SHORT[area.discipline]}</span>
                      <select value={captains[area.discipline] ?? ""} onChange={(event) => pickCaptain(area.discipline, (event.target as HTMLSelectElement).value)}>
                        <option value="">Sem capitão</option>
                        {founders
                          .filter((member) => !taken.has(member.id) || captains[area.discipline] === member.id)
                          .map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            </div>
            <div class="intro-nav">
              <button type="button" class="btn-ghost" onClick={() => setStep(1)}>
                Voltar
              </button>
              <button type="button" class="btn-primary" onClick={finish}>
                Começar a temporada
              </button>
            </div>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
