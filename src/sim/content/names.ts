// Nomes de pessoa (brasileiros, fictícios) para todo aluno: fundadores, candidatos e trainees.
// O papel (presidente, capitão) é um rótulo separado e nunca entra no nome.

export const FEMALE_FIRST_NAMES = [
  "Ana", "Alice", "Beatriz", "Camila", "Carla", "Débora", "Eduarda", "Elisa", "Fernanda", "Gabriela", "Giovana", "Helena",
  "Iara", "Isabela", "Júlia", "Larissa", "Letícia", "Marina", "Natália", "Olívia", "Paula", "Patrícia", "Rafaela", "Sofia",
  "Sabrina", "Tereza", "Vitória", "Yasmin", "Laura", "Manuela"
] as const;

export const MALE_FIRST_NAMES = [
  "Bruno", "Bernardo", "Caio", "Daniel", "Diego", "Enzo", "Felipe", "Fábio", "Gustavo", "Heitor", "Henrique", "Igor", "João",
  "Joaquim", "Lucas", "Marcos", "Mateus", "Nicolas", "Otávio", "Pedro", "Rafael", "Renato", "Samuel", "Thiago", "Vinícius",
  "Yuri", "Leonardo", "Murilo"
] as const;

export const FIRST_NAMES = [...FEMALE_FIRST_NAMES, ...MALE_FIRST_NAMES] as const;

export const LAST_NAMES = [
  "Alves", "Arantes", "Assis", "Barreto", "Brandão", "Campos", "Coutinho", "Duarte", "Fontana", "Furtado", "Ferreira",
  "Lacerda", "Lins", "Mattos", "Mendonça", "Menezes", "Moura", "Nogueira", "Nunes", "Paranhos", "Peixoto", "Prado",
  "Quintela", "Ribeiro", "Rocha", "Salles", "Sardinha", "Siqueira", "Tavares", "Teles", "Vasconcelos", "Viana",
  "Azevedo", "Batista", "Cardoso", "Dantas", "Esteves", "Farias", "Guedes", "Holanda", "Macedo", "Neves", "Pacheco",
  "Queiroz", "Ramos", "Silveira", "Toledo", "Valente", "Xavier", "Zanetti"
] as const;
