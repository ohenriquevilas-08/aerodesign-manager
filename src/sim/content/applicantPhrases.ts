// Frases do formulário de inscrição (Fase 9, S1): "por que quero entrar". Cada perfil escondido tem
// um tipo de frase; o sorteio erra de propósito às vezes (a frase dá pista e às vezes engana).

export type PhraseKind = "eager" | "curious" | "builder" | "flyer" | "referral" | "cv" | "vague";

export const PHRASES: Record<PhraseKind, readonly string[]> = {
  eager: [
    "Quero muito entrar. Já vi o vídeo da competição umas dez vezes e não consigo pensar em outra coisa.",
    "Eu largaria qualquer coisa para fazer parte. Pode me pôr para fazer o que precisar.",
    "É a equipe que eu espero entrar desde o primeiro período. Vou dar o sangue.",
    "Quero aprender na prática e ficar na oficina até tarde, se for preciso."
  ],
  curious: [
    "Sou curioso e gosto de entender como as coisas voam.",
    "Quero ver como é o dia a dia de uma equipe de verdade e aprender com quem sabe.",
    "Sempre me perguntei como um avião daquele tamanho consegue levantar tanta carga.",
    "Me interessei por aerodinâmica e acho que a equipe é o melhor lugar para aprender."
  ],
  builder: [
    "Gosto de colocar a mão na massa. Já montei aeromodelo e quero fazer algo maior.",
    "Passo o tempo livre consertando coisas. Quero usar isso para construir um avião.",
    "Gosto de ver a peça pronta na mão. Quero fabricar, medir e melhorar.",
    "Faço impressão 3D e já queimei dois motores. Aprendi muito e quero aprender mais."
  ],
  flyer: [
    "Sempre quis ver um avião meu voando.",
    "Sou apaixonado por aviação desde criança e quero projetar o meu.",
    "Meu sonho é trabalhar com aeronaves e a equipe é o primeiro passo.",
    "Quero estar no campo vendo o avião decolar e saber que ajudei a fazer."
  ],
  referral: [
    "Meu primo era da equipe e falou muito bem de vocês.",
    "Fui indicado por um amigo que participou ano passado. Ele disse que vale a pena.",
    "Um veterano da minha turma me convenceu a me inscrever.",
    "Conheço alguém da equipe e fiquei com vontade de participar também."
  ],
  cv: [
    "Quero algo no currículo para o estágio.",
    "Preciso de horas complementares e achei que a equipe é uma boa opção.",
    "Disseram que equipe de competição ajuda a conseguir estágio. Quero tentar.",
    "Estou atrás de experiência prática para o currículo."
  ],
  vague: [
    "Acho interessante.",
    "Quero participar de alguma coisa na faculdade.",
    "Me falaram bem da equipe.",
    "Não tenho muito o que dizer, mas quero tentar."
  ]
};
