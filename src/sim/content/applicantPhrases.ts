// Frases do formulário de inscrição (Fase 9, S1): "por que quero entrar". Cada perfil escondido tem
// um tipo de frase; o sorteio erra de propósito às vezes (a frase dá pista e às vezes engana).

export type PhraseKind = "eager" | "curious" | "builder" | "flyer" | "referral" | "cv" | "vague";

/**
 * Momento da equipe que a frase pressupõe: "history" = a equipe já competiu (reputação, ex-integrantes,
 * resultados, vídeo da competição); "founding" = só equipe nova. Sem `requires`, serve a qualquer momento.
 * Nenhuma frase pode citar um fato que o estado não sustenta (tests/sim/selection-phrases.test.ts).
 */
export type PhraseRequires = "history" | "founding";

export interface PhraseDef {
  text: string;
  requires?: PhraseRequires;
  /** Só nesta seletiva ("amigo dos fundadores" é indicação). */
  onlyFormat?: string;
}

const any = (text: string): PhraseDef => ({ text });
const history = (text: string): PhraseDef => ({ text, requires: "history" });
const founding = (text: string): PhraseDef => ({ text, requires: "founding" });

export const PHRASES: Record<PhraseKind, readonly PhraseDef[]> = {
  eager: [
    history("Quero muito entrar. Já vi o vídeo da competição umas dez vezes e não consigo pensar em outra coisa."),
    any("Eu largaria qualquer coisa para fazer parte. Pode me pôr para fazer o que precisar."),
    history("É a equipe que eu espero entrar desde o primeiro período. Vou dar o sangue."),
    any("Quero aprender na prática e ficar na oficina até tarde, se for preciso."),
    founding("Quero ajudar a construir algo do zero. Uma equipe nova é a chance de fazer parte desde o começo.")
  ],
  curious: [
    any("Sou curioso e gosto de entender como as coisas voam."),
    any("Quero ver como é o dia a dia de uma equipe de verdade e aprender com quem sabe."),
    any("Sempre me perguntei como um avião daquele tamanho consegue levantar tanta carga."),
    any("Me interessei por aerodinâmica e acho que a equipe é o melhor lugar para aprender."),
    founding("Vi o cartaz da equipe nova e fiquei curioso para saber como vai ser.")
  ],
  builder: [
    any("Gosto de colocar a mão na massa. Já montei aeromodelo e quero fazer algo maior."),
    any("Passo o tempo livre consertando coisas. Quero usar isso para construir um avião."),
    any("Gosto de ver a peça pronta na mão. Quero fabricar, medir e melhorar."),
    any("Faço impressão 3D e já queimei dois motores. Aprendi muito e quero aprender mais."),
    founding("Sempre quis mexer com aeromodelismo e uma equipe começando agora é o lugar para aprender junto.")
  ],
  flyer: [
    any("Sempre quis ver um avião meu voando."),
    any("Sou apaixonado por aviação desde criança e quero projetar o meu."),
    any("Meu sonho é trabalhar com aeronaves e a equipe é o primeiro passo."),
    any("Quero estar no campo vendo o avião decolar e saber que ajudei a fazer.")
  ],
  referral: [
    history("Meu primo era da equipe e falou muito bem de vocês."),
    history("Fui indicado por um amigo que participou ano passado. Ele disse que vale a pena."),
    any("Um veterano da minha turma me convenceu a me inscrever."),
    any("Conheço alguém da equipe e fiquei com vontade de participar também."),
    { text: "Um amigo dos fundadores me chamou para participar.", requires: "founding", onlyFormat: "referral" },
    founding("Um colega da minha turma já está na equipe e me convidou.")
  ],
  cv: [
    any("Quero algo no currículo para o estágio."),
    any("Preciso de horas complementares e achei que a equipe é uma boa opção."),
    any("Disseram que equipe de competição ajuda a conseguir estágio. Quero tentar."),
    any("Estou atrás de experiência prática para o currículo.")
  ],
  vague: [
    any("Acho interessante."),
    any("Quero participar de alguma coisa na faculdade."),
    history("Me falaram bem da equipe."),
    any("Não tenho muito o que dizer, mas quero tentar."),
    founding("Vi o cartaz da equipe nova.")
  ]
};

/** A equipe tem história? Hoje só o fim da competição (o Ano 1 é o único ano); uma temporada nova entra aqui. */
export const hasHistory = (state: { competition: { phase: string } | null }): boolean => state.competition?.phase === "finished";

/** As frases que o estado sustenta: "history" só com história, "founding" só sem. */
export function phrasesFor(kind: PhraseKind, history: boolean, format: string): readonly string[] {
  return PHRASES[kind]
    .filter((item) => (item.requires === undefined || (item.requires === "history") === history) && (item.onlyFormat === undefined || item.onlyFormat === format))
    .map((item) => item.text);
}
