// Perguntas da entrevista (Fase 9, S4): o jogador escolhe até BALANCE.selection.maxQuestions por
// inscrito. Cada pergunta revela um atributo do perfil escondido com ruído; a comunicação de quem
// entrevista reduz o ruído (ver selection.ts, interviewSpread).

import { DISCIPLINE_LABELS } from "../team";
import type { ApplicantProfile, Discipline } from "../types";

export interface InterviewQuestion {
  id: string;
  /** O que o jogador pergunta. */
  label: string;
  /** O que a pergunta tende a revelar, para a lista. */
  reveals: string;
  /**
   * Resposta em texto. `noise` vai de -1 a 1 (sorteado) e `spread` é o tamanho do ruído em pontos
   * (0 a 100): leitura = valor real + noise × spread.
   */
  answer: (profile: ApplicantProfile, noise: number, spread: number) => string;
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));
const pick = (value: number, low: string, mid: string, high: string, cuts: [number, number] = [40, 65]) =>
  value >= cuts[1] ? high : value >= cuts[0] ? mid : low;
const list = (items: readonly Discipline[]) => items.map((discipline) => DISCIPLINE_LABELS[discipline]).join(" e ");

export const INTERVIEW_QUESTIONS: readonly InterviewQuestion[] = [
  {
    id: "availability",
    label: "Quanto tempo você tem de verdade por semana?",
    reveals: "disponibilidade",
    answer: (profile, noise, spread) => {
      // Horas por dia reais são 2 a 4; o ruído mexe em até ~1,5 h com spread 18.
      const hours = Math.max(1, Math.round((profile.hoursPerDay + noise * (spread / 12)) * 2) / 2);
      return `Diz que consegue umas ${hours.toString().replace(".", ",")} h por dia, fora de semana de prova.`;
    }
  },
  {
    id: "likes",
    label: "O que você mais gosta de fazer em engenharia?",
    reveals: "o que diz gostar",
    answer: (profile, noise, spread) => {
      if (Math.abs(noise) * spread > 12) return "Ficou vago: falou de um pouco de tudo, sem escolher uma coisa.";
      return profile.statedLikes.length > 0
        ? `Diz que curte ${list(profile.statedLikes)}.`
        : "Não soube dizer do que gosta; quer experimentar para descobrir.";
    }
  },
  {
    id: "pressure",
    label: "Conta uma vez em que tudo deu errado perto do prazo.",
    reveals: "como lida com pressão",
    answer: (profile, noise, spread) => {
      const reading = clamp(profile.motivation * 0.4 + profile.communication * 0.3 + profile.agility * 0.3 + noise * spread);
      return pick(
        reading,
        "Admitiu que trava quando aperta e demorou para pedir ajuda.",
        "Contou que fica nervoso, mas se organiza e entrega.",
        "Contou do semestre apertado com calma e uma divisão clara de tarefas: parece firme sob pressão."
      );
    }
  },
  {
    id: "practice",
    label: "Já montou alguma coisa com a mão? Aeromodelo, protótipo, qualquer coisa.",
    reveals: "experiência prática",
    answer: (profile, noise, spread) => {
      const reading = clamp(profile.fabrication * 2.5 + noise * spread);
      return pick(
        reading,
        "Nunca pôs a mão em nada parecido; vai aprender do zero.",
        "Já montou umas coisas simples em casa, nada de muito sério.",
        "Já montou aeromodelo e conta com orgulho os erros que corrigiu.",
        [35, 62]
      );
    }
  },
  {
    id: "why",
    label: "Por que aerodesign, de verdade?",
    reveals: "motivação",
    answer: (profile, noise, spread) => {
      const reading = clamp(profile.motivation + noise * spread);
      return pick(
        reading,
        "Respondeu sem brilho nos olhos: parece mais atrás de currículo do que do avião.",
        "Quer aprender e acha que a equipe é um bom lugar, sem exagero.",
        "Os olhos brilharam: falou da competição e do avião com vontade de verdade.",
        [50, 72]
      );
    }
  },
  {
    id: "teamwork",
    label: "Como é trabalhar em grupo com você?",
    reveals: "comunicação",
    answer: (profile, noise, spread) => {
      const reading = clamp(profile.communication * 1.5 + noise * spread);
      return pick(
        reading,
        "Respondeu curto e olhou para baixo; vai precisar de ajuda para se soltar na equipe.",
        "Se explica bem quando perguntam, mas espera ser chamado.",
        "Falou com clareza, ouviu a pergunta até o fim e já puxou assunto com os capitães.",
        [30, 55]
      );
    }
  },
  {
    id: "basics",
    label: "Como estão suas bases de física e cálculo?",
    reveals: "conhecimento de partida",
    answer: (profile, noise, spread) => {
      const average = Object.values(profile.knowledge).reduce((sum, value) => sum + value, 0) / 7;
      const reading = clamp(average * 6 + noise * spread);
      return pick(
        reading,
        "Passou raspando em cálculo e diz que precisa rever muita coisa.",
        "Tem as bases do ciclo básico em dia.",
        "Foi bem nas disciplinas básicas e já mexeu com um pouco de aerodinâmica por conta.",
        [45, 62]
      );
    }
  }
];

export const findQuestion = (id: string): InterviewQuestion | undefined => INTERVIEW_QUESTIONS.find((question) => question.id === id);
