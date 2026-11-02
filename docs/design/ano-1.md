# Aerodesign Manager · Design do Ano 1 (fatia vertical)

> **Status:** rascunho v3 para revisão (31/10/2026), atualizado com o **Regulamento SAE BRASIL AeroDesign 2026 Rev01**, o modelo de custos (seção 8) e a lista de equipes (Apêndice A).
> Marcações: **[DECIDIDO]** = escolha confirmada pelo Henrique · **[PROPOSTA]** = sugestão do Claude, aguardando OK · **[ABERTO]** = precisa de decisão.

Este documento é o contrato de design da primeira fatia jogável: **a temporada de fundação, do primeiro dia da equipe até o fim da competição**. Tudo que for implementado na Fase 2 (simulação, interface, cenas) segue o que está aqui. O que não estiver aqui não entra no Ano 1.

---

## 1. Visão

**Fantasia:** você é presidente de uma equipe universitária de aerodesign recém-fundada e precisa formar gente, projetar, fabricar, ensaiar e levar um avião à competição nacional, sob regras que espelham as da SAE.

**Referências:** Football Manager / modo carreira do FIFA (gestão, calendário, inbox) · Into Space! (o voo como espetáculo) · Hero Zero / C.A.T.S (progresso visível, peças, montagem) · Habbo (o hangar como lugar vivo, com a equipe trabalhando) · Polytopia (clareza visual, leitura imediata).

**Pilares:**

1. **Fidelidade à SAE.** Calendário, prazos, pontuação e regras de voo espelham o regulamento real. Quem é de aerodesign deve reconhecer a própria temporada. **[DECIDIDO]**
2. **Pessoas importam tanto quanto o avião.** Profundidade equilibrada entre equipe, projeto e competição. **[DECIDIDO]**
3. **Incerteza é o recurso central.** A equipe nunca sabe o desempenho real do avião, só uma estimativa com margem de erro. Conhecimento e ensaios estreitam a margem, e a competição pontua exatamente isso (previsão de carga e de peso vazio). **[PROPOSTA]**
4. **Urgência.** O tempo corre sem parar; prazos se aproximam enquanto você decide. **[DECIDIDO]**
5. **Risco legível.** Toda decisão arriscada mostra a chance em linguagem clara (baixo/médio/alto). **[DECIDIDO]**
6. **Feito para notebook.** Mouse, teclado, telas de 1366×768 a 1920×1080. Sem celular. **[DECIDIDO]**

---

## 2. Mundo fictício, "ao máximo parecido" **[DECIDIDO: fictício e parecido]**

Nada usa marca real; tudo deve soar familiar para quem é do meio.

| Real | No jogo |
|---|---|
| SAE BRASIL | **Aerodesign Brasil** (organizadora) **[DECIDIDO]** |
| Competição SAE BRASIL AeroDesign | **Competição Aerodesign Brasil** **[DECIDIDO]** |
| Comissão Técnica (CT) | Comissão Técnica (CT) |
| Portal aeroct | **Portal da CT** (dentro do jogo, onde se entregam relatório, vídeo e previsões) |
| DCTA, São José dos Campos | **CTAe, São José dos Campos** (taxiway do Centro Técnico Aeroespacial) |
| Classes Regular, Advanced, Micro | iguais |

### 2.1 Equipes rivais **[DECIDIDO: nomes parecidos com os reais]**

O **Apêndice A** traz as 61 equipes do jogo, uma paródia para cada equipe da lista real de inscritas (fornecida pelo Henrique). Regras da paródia:

- **Mesmo espírito do nome:** ave vira ave parecida (Tucano → Tucanuçu), regionalismo vira regionalismo (Uai, sô! Fly!!! → Uai, Sô! Voa!!!), mitologia vira mitologia (Zeus → Apolo), inglês vira inglês (Keep Flying → Keep Climbing).
- **Instituição fictícia, mesma cidade e estado:** a cidade é real; a universidade não (USP → UESP, ITA → ITAe, UFU → UFTri).
- **Mesmo tipo de instituição:** federal continua federal, instituto federal continua IF, privada continua privada, estrangeira continua estrangeira.
- Exibição no jogo: **"Tucanuçu · UFTri"**.

**Campo da Classe Regular no Ano 1:** ~30 equipes sorteadas do Apêndice A (as estrangeiras ficam para a carreira). **[PROPOSTA]**

**Rivais de destaque (4 ou 5):** têm filosofia, história e personalidade (aproveitando o sistema de filosofias do jogo atual). **[PROPOSTA]**

| Arquétipo | Equipe |
|---|---|
| A tradicional, multicampeã | EESC-UESP Alfa |
| A que aposta tudo em carga | Uai, Sô! Voa!!! |
| A obcecada por relatório | Keep Climbing |
| A do instituto de aeronáutica, técnica e fria | Monteverde |
| A novata ambiciosa (como você) | Gigazord AeroDesign |

---

## 3. Regulamento de referência: 2026, Classe Regular

Base: **Regulamento SAE BRASIL AeroDesign 2026 Rev01** (cap. 7, 10 e 11; Apêndices 4, 6 e 8). O Ano 1 usa os valores de 2026 sem alteração. Nos anos seguintes, o regulamento anual do jogo varia coeficientes, como na vida real.

- **Classe do Ano 1:** só Regular. **[PROPOSTA]**

### 3.1 Restrições da Classe Regular (2026)

| Regra | Valor | Se violar |
|---|---|---|
| Envergadura (B) | ≤ 4,0 m | `PD = 100 × excesso` (+20 se excesso > 5 cm), por bateria |
| Potência de pico em voo (P) | ≤ 600 W, motor elétrico | `PP = 0,5 × excesso em W`, por bateria |
| Altura (H) | sem limite | Se romper a fita do obstáculo numa decolagem abortada, voo inválido e perde as próximas tentativas |
| Peso máximo de decolagem | 20 kg (vazio + carga) | Carga acima disso não conta |
| Decolagem válida | passar obstáculo de **0,9 m** a **55 m** do início da corrida | Voo inválido |
| Voo válido | carga ≥ 5,0 kg e pontuação da bateria > 0 | Voo inválido |

A mudança grande de 2026: **não existe mais a fórmula de "custo"** de 2024. O compromisso de projeto agora está dentro da pontuação: eficiência estrutural, número de superfícies e envergadura (seção 9.3).

---

## 4. Tempo: tempo corrido **[DECIDIDO]**

### 4.1 Relógio contínuo

Não há turnos. O tempo corre como em jogos de gestão em tempo real (Two Point Hospital, Football Manager em "jogo ao vivo"):

- Controles: **⏸ pausa · ▶ 1× · ▶▶ 2× · ▶▶▶ 4×** (barra de espaço pausa).
- **Pausa automática** em eventos importantes (configurável): peça quebrou, ensaio terminou, prazo a 7 dias, alguém pediu para sair.
- Escala **[PROPOSTA]**: em 1×, **1 dia de jogo ≈ 10 segundos**. De 10/nov a 22/out (~345 dias) dá ~58 min em 1×; acelerando nos períodos calmos (pré-temporada, férias), o Ano 1 completo (com competição) fica nos 60–90 min. **[PROPOSTA, Fase 6]**
- Prazos aparecem como **contagem regressiva**: `Relatório: 12d 04h`.

### 4.2 Trabalho como tarefas em andamento

Todo trabalho é uma **tarefa com duração em horas-pessoa** que avança em tempo real conforme quem está alocado nela:

```
Fabricar asa (v1)       ████████░░░░  64%   Ana, Caio      ~3d restantes
Capítulo Aerodinâmica   ███░░░░░░░░░  25%   Bia            ~6d restantes
Rifa de março           ██████████░░  85%   Davi           +420 cr
```

- Cada integrante tem **horas disponíveis por dia** = disponibilidade × calendário acadêmico × motivação × energia (§5.1).
- **Uma tarefa nunca fica parada sem gente [DECIDIDO, Fase 8].** Ao iniciar, o jogador escolhe as pessoas (`start-action` com `memberIds`) e a tarefa só começa com o **mínimo** da ação (`crew.min`); quem entra fica ocupado até a tarefa terminar ou o jogador **encerrar** (`close-task`). Não dá tirar gente e deixá-la abaixo do mínimo; o caminho é encerrar. Quem é desligado ou se forma e deixa a tarefa abaixo do mínimo faz a tarefa encerrar sozinha, com o parcial, e avisar. A espera de calendário (compra, cura) não ocupa ninguém.
- **O resultado sai aos poucos.** Cada ação declara como entrega (`yield`), e `Task.yielded` guarda o que já saiu para nada sair duas vezes:
  - **contínuo:** o efeito acontece proporcional às horas. Divulgação soma alcance, o capítulo do relatório soma horas de escrita (aparecem na nota na hora). O total é sorteado ao iniciar, com a equipe escolhida.
  - **em marcos:** a seletiva traz os inscritos a cada 25% das horas (`BALANCE.yield.selectionStep`); a fabricação avança em três etapas (corte, montagem, acabamento; `fabricateStep` = 1/3). Peça encerrada no meio fica **parcial**: não voa, mas uma nova tarefa de fabricar com a peça como alvo termina o que falta, sem gastar material nem caixa de novo. Encerrar antes da primeira etapa perde o material.
  - **só no fim:** onde parcial não faz sentido (rifa, patrocínio, ensaios, documentar, reparo). Encerrar perde o resultado; o aprendizado de quem trabalhou fica.
  - Em qualquer modo o conhecimento e as habilidades sobem **hora a hora**, não na conclusão.
- **Sem limite rígido de pessoas onde não há espaço físico.** Tarefas de organização (seletiva, divulgação, estudo, relatório, documentação, captação) aceitam qualquer número de pessoas; fabricação, laminação e bancada mantêm um máximo físico. Até o número ideal cada pessoa soma 100%; as extras rendem menos, nesta ordem: 70%, 50%, 35%, 25%, 18%, 12% (depois fica em 12%; `BALANCE.crew.extraEfficiency`). A leitura `crewEfficiency(ação, n)` devolve quantas "pessoas inteiras" de trabalho rendem n pessoas, para a UI mostrar o ganho de mais uma.
- O jogador monta a fila de tarefas escolhendo a equipe de cada uma; as barras andam sozinhas. No hangar (cena), dá para ver as pessoas trabalhando em cada bancada.
- Gente sem tarefa desmotiva. Gente exausta (§5.1, energia) também.
- Isso substitui as "ações flexíveis" da premissa 3B: o volume de trabalho depende da equipe, não de um limite de ações.

### 4.3 Calendário da temporada 2025–26 **[DECIDIDO, Fase 6]**

A temporada real começa quando a competição anterior acaba, na 2ª semana de novembro. O relógio parte da **segunda, 10/nov/2025** (`SEASON_START`), pausado na abertura (os fundadores convidam o orientador, seção 5.2), e a temporada dura 13 meses (nov a nov).

**Pré-temporada (nov a fev)**, marcos com efeito (`content/season2026.ts`):

| Data | Marco | Efeito no jogo |
|---|---|---|
| 10/nov | Convite dos fundadores | Abertura; o comando `found-team` libera o relógio |
| Nov | Janela do processo seletivo (Ano 1, fundação) | Abrir a campanha rende mais inscritos aqui e em março (calouros); fora das duas janelas é possível abrir, com menos gente (seção 5.2) |
| 1/dez a 1/fev | Etapa trainee | Quem entrou pela seletiva é `trainee` e treina (seção 5.2) |
| 15/dez a 13/fev | Férias de verão | Horas por integrante a 50% (`BALANCE.season.summerFactor`, **[PROPOSTA]**) |
| 1/fev | Fim da etapa trainee | Cada trainee vira integrante ou desiste |
| **9/fev** | **Regulamento 2026 publicado (Rev00)** | Libera a tarefa "Leitura do regulamento" e a Prancheta (antes: "Aguardando regulamento") |

Antes de 9/fev ficam permitidos: estudo, seletiva, trainee, captação e compras.

**Datas oficiais de 2026** (iguais):

| Data | Marco | Efeito no jogo |
|---|---|---|
| 1/mar | Revisão 01 do regulamento | Evento: "Errata publicada" |
| **16/ago** | **Relatório, plantas, peso vazio previsto e reta de previsão de carga** | Congela as previsões que valem na competição |
| 23/ago | Prazo final do relatório, com penalidade | Atrasar custa pontos |
| 13/set | Cronograma da apresentação oral | Informativo |
| **27/set** | **Vídeo de voo** · alterações de projeto · matrícula · cadastro do piloto | Sem vídeo válido, não voa na competição |
| 4/out | Lista preliminar de aviões aprovados | Confirma participação |
| **17/out** | **Apresentação oral (online)** | 40 pontos |
| Fim de out / nov | Exposição (quinta-feira) + competição de voo | Clímax (seção 9) |

O regulamento 2026 deixa a data da competição "a definir". No jogo, fixamos **a semana seguinte à apresentação oral**. **[PROPOSTA]**

O prazo do vídeo de voo é o grande divisor: **até o fim de setembro o avião oficial precisa ter voado de verdade.** Isso cria o ritmo natural da temporada (projeto → protótipo → avião oficial → voo filmado) sem etapas artificiais.

### 4.4 Calendário acadêmico genérico **[DECIDIDO: genérico]**

| Período | Horas por integrante |
|---|---|
| Aulas normais | 100% |
| Semanas de provas (nov e dez de 2025; meados de abr, jun, set e nov de 2026) | 40% |
| Férias de verão (15/dez a 13/fev) | 50% **[PROPOSTA]**: muitos viajam |
| Férias de julho | 160% (é quando as equipes reais fabricam) |
| Carnaval, feriados | 70% |

### 4.5 Calendário anual e ações agendadas **[DECIDIDO, Fase 6]**

O jogador pode marcar ações no calendário (estilo FIFA): `schedule-action` põe a ação em `plannedActions` com `startAt` (horas de jogo), e ela vira tarefa sozinha nessa hora, com a gente indicada já alocada. Se faltar gente livre, caixa, material ou pré-condição na hora, não começa: sai da lista, avisa na caixa de entrada e pausa o relógio (`PauseReason` `"scheduled"`). `reschedule-action` muda a data; `unschedule-action` tira. Sem `memberIds`, a tarefa nasce sem ninguém alocado. As leituras `calendarMonth(state, ano, mês 1–12)` (por dia: marcos, período acadêmico, ações agendadas, ensaios de voo, tarefas em andamento com início e fim previstos, prazos de pedidos) e `seasonOverview(state)` (os 13 meses com marcos) alimentam a tela.

---

## 5. Equipe

### 5.1 Integrantes **[PROPOSTA]**

| Atributo | Faixa | Uso |
|---|---|---|
| Função | Presidente (aluno), capitão, membro, trainee | Capitães recomendam e lideram a frente. O **jogador é o professor orientador**, fora desta tabela: permanente, sem horas nem área |
| Conhecimento por disciplina | 0–100 (tácito) | Qualidade do trabalho e do capítulo do relatório |
| Fabricação | 0–100 | Qualidade e velocidade na oficina |
| Pilotagem | 0–100 | Só para quem pilota; afeta risco no voo |
| Agilidade | 0–100 | Retirada rápida de carga (até 2 pessoas) |
| Motivação | Baixa → Alta | Multiplica horas e qualidade |
| Energia **[Fase 8]** | 0–100 | Gasta trabalhando, recupera descansando; multiplica horas e qualidade (abaixo) |
| Diz gostar de **[Fase 8]** | 0–2 disciplinas | Preferência declarada; pode estar errada |
| Gosta / detesta **[Fase 8]** | escondido | A preferência real; trabalhar no que gosta anima, no que detesta gasta mais energia |
| Facilidade **[Fase 8]** | devagar · normal · rápido, por disciplina | Escondida; multiplica o ganho de conhecimento (0,6 · 1 · 1,5). Aparece depois de 10 horas na disciplina |
| Disponibilidade | h/dia | Base das horas |
| Período / formatura | semestre | Define quando sai da equipe |

**Formação por área (Fase 4):** a equipe se organiza por área, cada uma com 1 capitão e N integrantes; sem banco nem reserva. Classe Regular: Aerodinâmica (2 vagas de integrante), Estruturas (3), Elétrica (2), Desempenho (1), Estabilidade e controle (1) e Cargas (1), ou seja, 6 capitães + 10 integrantes (valores provisórios, `content/formations.ts`). Projeto conceitual não é área. Novato chega sem área; o presidente é um aluno como os outros e pode ocupar uma área (mas não a vaga de capitão); o trainee fica fora da formação até virar integrante. Trocar um integrante de uma área para outra custa **8 pontos de motivação** (`BALANCE.formation.changeAreaMotivation`); o conhecimento tácito fica na disciplina antiga. Área vazia mostra o que para sem ela. Os capitães escolhidos na fundação já começam nas suas áreas.

**Energia [DECIDIDO, Fase 8; valores PROPOSTA em `BALANCE.energy`].** Todo aluno começa com 100.
- **Gasta** 5 pontos por hora trabalhada; a madrugada de oficina gasta ×1,6 (×2,2 depois da 1h) e a disciplina que a pessoa detesta ×1,4. Quem trabalha não recupera nas horas trabalhadas.
- **Recupera** por hora de relógio fora do trabalho: 0,5 acordado e 1,5 dormindo (23h às 7h), ×1,5 no fim de semana. Um aluno com 3 h/dia de trabalho fica estável; uma semana de madrugadas derruba.
- **Rendimento:** abaixo de 40 de energia as horas e a qualidade caem, linearmente até 50% em 15; abaixo de 15 a pessoa **para sozinha** (a tarefa não anda com ela, a motivação cai 4 por dia) e volta quando recupera. Substitui o antigo `workStreakHours` e a sobrecarga escondida. "Cansado" na UI é energia abaixo de 40.
- **Leitura `energyOutlook`:** energia atual, nível (ok, cansado, exausto), variação por dia no ritmo atual (a tarefa em que está e a escala), tendência (sobe, desce, estável) e em quantas horas chega ao limite de exaustão.

**Alunos não determinados [DECIDIDO, Fase 8].** Ninguém chega "forte em X". O conhecimento inicial é baixo e parecido: 8 ± 3 em todas as disciplinas, para fundadores, candidatos e trainees (a seletiva só dá um bônus de 0 a 6 na disciplina que o candidato diz gostar). O que cada um **diz gostar** (0 a 2 disciplinas) bate com o que **gosta de verdade** só em parte (60% por item), e cada pessoa também **detesta** uma disciplina. A **facilidade** em cada disciplina é sorteada (25% devagar, 50% normal, 25% rápido) e fica escondida até a pessoa somar 10 horas de trabalho nela; aí chega uma mensagem ("Enzo pegou rápido Cargas e aeroelasticidade") e `revealedAptitude` marca a disciplina. A Fase 9 (árvore do orientador) terá um ramo que revela preferência e facilidade mais cedo: o gancho é `revealAptitude(estado, integrante, disciplina)`. Os textos dos fundadores e os pareceres dos capitães são **intenções** ("Diz que quer mexer com aerodinâmica"), não medidas. O orientador tem nome padrão masculino (Ricardo Prado), editável na abertura, e a paleta de cabelo dos alunos não tem cinza.

**Disciplinas** = as do relatório 2026: Projeto conceitual e preliminar · Aerodinâmica · Desempenho · Estabilidade e controle · Cargas e aeroelasticidade · Estruturas e ensaios estruturais · Projeto elétrico e safety assessment. Usar as disciplinas reais amarra equipe, projeto e nota do relatório num único eixo.

**Piloto:** piloto próprio (treina nos ensaios, conhece o avião) ou piloto da CT (nível fixo, não conhece o avião), como na regra real. O cadastro vence em 27/set.

### 5.2 Fundação, seletiva e trainee **[DECIDIDO, Fase 6]**

**O jogador é o professor orientador** (`advisor: { name, reputation }`), permanente de ano para ano, como o técnico no modo carreira. A reputação começa baixa (`BALANCE.advisor`, **[PROPOSTA]**) e sobe com resultados (relatório enviado, fim da competição); no Ano 1 só é exibida (`advisorView`).

**Fundação:** um grupo de **4 alunos fundadores** (`content/founders.ts`), sem cargo, conhecimento inicial baixo e parecido, cada um com uma "cara" (o que **diz** gostar de fazer, uma intenção que pode não ser o gosto real) e um perfil de agenda, convida o orientador. O comando `found-team { presidentId, captains, teamName? }` (só no estado `founding`; o relógio fica pausado até lá) é a eleição: o orientador sugere quem preside e quem capitaneia o quê. Os capitães são opcionais (o organograma de fundação não é rígido); cada fundador assume um só cargo; só áreas da formação têm capitão. Fundadores podem ter inclinação de gestão ou marketing, não só de engenharia (áreas de negócio ficam para a Fase 7).

**Presidente:** um aluno NPC. Trabalha, tem horas, área e carta, e uma `agenda`: `report`, `flight`, `funding` ou `balanced` (**[PROPOSTA]**). Tarefa concluída da agenda dá +1 de motivação a toda a equipe; 3 dias seguidos sem tarefa da agenda tiram 3 de motivação do presidente por dia (`BALANCE.agenda`). Nada é bloqueado. `presidentView` mostra a agenda e como o mês (30 dias) está para ela. Os rótulos são **prioridades com o efeito** (Fase 7), no conteúdo: "Prioridade: fazer o avião voar · tarefas de fabricação e ensaio animam a equipe"; do mesmo jeito, entregar o relatório, levantar caixa e gente, equilibrar as três frentes (`AgendaDef.priority`, `effect`, `text`).

**Seletiva imersiva (Fase 9) [PROPOSTA]:** a seletiva é um funil de cerca de 6 semanas. Inscrito não é membro: o jogador vê a multidão afinando a cada etapa, a informação chega aos poucos e com ruído, e as escolhas custam. Só existe uma campanha por vez (`GameState.selection`).

| Etapa | Duração | Números no Ano 1 bem divulgado | O que o jogador vê |
|---|---|---|---|
| 1. Divulgação e abertura (`open-selection`) | ~1 semana, tarefa com gente | | Alcance de divulgação somando |
| 2. Inscrições | 3 semanas, espera no calendário | ~90 inscritos (40 a 120) | Nome, curso, período e uma frase "por que quero entrar" |
| 3. Palestra | 1 noite, 2 dias depois | ~80% vêm | "73 de 92 vieram"; quem falta sai |
| 4. Dinâmica (evento) | 1 dia, 3 dias depois | até 36 convidados, uns 10% faltam; grupos de 5 a 6 | Anotações dos grupos acompanhados |
| 5. Entrevistas | ~1 semana, tarefa com gente | até 24 passam; cada entrevista custa 1,5 h por entrevistador (em dupla) | Respostas às até 3 perguntas escolhidas |
| 6. Aprovação (`approve-applicants`) | 1 dia | até 20 vagas, as que o jogador aprovar | E-mail para todos; aprovados viram trainees |

Contagem num Ano 1 bem divulgado: ~90 inscritos, ~72 na palestra, ~30 na dinâmica, ~16 entrevistados, ~10 trainees, ~6 membros.

- **Inscritos (S1).** Cada um é sorteado na chegada com um **perfil escondido** (o que vira o `Member`: conhecimento, mão na oficina, agilidade, comunicação, motivação, horas por dia, gostos reais e facilidade) e só mostra o formulário: nome, curso, período e a frase. A leitura da UI é `applicantView`/`applicantViews`; o perfil nunca sai da simulação. **Cursos** (`content/selection.ts`): engenharia aeronáutica (metade), mecânica, elétrica, computação e produção, com `femaleShare` por curso (aeronáutica 0,2); o curso puxa levemente o conhecimento de partida e a fabricação. **Frase** (`content/applicantPhrases.ts`): um banco por tipo de perfil (empolgado, curioso, mão na massa, apaixonado por aviação, indicação, currículo, vago), com 25% de chance de a frase não bater com o perfil: a pista às vezes engana.
- **Quantos se inscrevem.** O total é sorteado quando as inscrições abrem: base do formato × época × (1 + alcance × 0,03) × (1 + reputação × 0,004), ±15%. Época: novembro 0,8 e março 1,25 (calouros); fora das duas janelas 0,5. Os inscritos chegam em marcos diários, mais no começo; divulgação feita durante as inscrições ainda soma (0,8 inscrito por ponto de alcance).
- **Por indicação.** No formato "Por indicação" os inscritos vêm da **rede da equipe**, não do alcance: o total é a soma, por integrante (trainees não contam), de `1,6 + comunicação/100 × 3,2` inscritos, × época × reputação (`BALANCE.selection.referral`, **[PROPOSTA]**), ±15%. Mais gente e gente que se comunica melhor trazem mais inscritos. Durante a campanha, as ações de divulgação geral (cartazes, posts, sala de aula, stand) não aparecem na tela Ações, são recusadas pela simulação e não somam alcance. A ação **Pedir indicações** (só com as inscrições abertas) custa 3 h-pessoa **por integrante** escolhido e rende, aos poucos, `1,2 + comunicação/100 × 2,4` inscritos a mais por integrante. Os indicados nascem de um integrante (`Applicant.referredBy`): vêm mais motivados (motivação 75 a 95, contra 50 a 80 na ampla) e, com 60% de chance, gostam da mesma área que quem indicou.
- **Triagem.** `tag-applicant` marca "chamar", "talvez" ou "não". A tag não muda quem vai à palestra, mas decide quem a dinâmica convida: "chamar" primeiro, "não" nunca, até o teto.
- **Triagem com o presidente.** Depois de fechadas as inscrições e de novo depois da palestra, o jogador marca a planilha e **envia a avaliação ao presidente**; a palestra e a dinâmica só abrem depois disso. O presidente (NPC) devolve um parecer curto pela agenda dele e pode discordar de até 2 nomes, com o motivo; o jogador aceita ou mantém a sua escolha. Quem está em "chamar" e "talvez" segue.
- **Palestra (S2).** A palestra é um evento (recepção, apresentação da equipe, como funciona o processo, perguntas da plateia, encerramento) com duas decisões leves que mexem um pouco em quem se anima a seguir; o resumo diz quantos vieram e o clima. A chance de ir vai de 70% a 90% conforme a motivação escondida (menos 8 pontos em semana de provas; `BALANCE.selection`). Quem falta vira `absent`; a mensagem diz "N de M vieram".
- **Dinâmica (S3).** Evento da Fase 7 (o relógio pausa; 9h recepção, 10h apresentação da equipe, 11h desafio prático com planador de balsa, 16h deliberação), agora com os convidados que apareceram em grupos de 5 a 6. Cada grupo lança o planador a `distância base × (0,6 + 0,9 × fabricação + 0,3 × agilidade)` m, com ruído, e o resultado vem pronto para a cena. O jogador acompanha de perto até 2 grupos (decisão antes do desafio): os acompanhados geram anotações para todos os membros (mão firme ou torta, quem puxou a conversa, quem perguntou da peça de verdade); os outros ganham só uma anotação geral do grupo. A segunda chance a quem travou continua, mas só vale em grupo acompanhado. Os capitães indicam quem acharam mais interessante, sem decidir nada: **quem passa para a entrevista é escolha do jogador** (`advance-applicants`, até 24).
- **Entrevistas (S4).** `schedule-interviews` é tarefa com gente (entrevistadores em dupla, 1,5 h-pessoa cada; ~1 semana para uns 16). O jogador escolhe até 3 perguntas por pessoa (`set-interview-questions`; `content/interviewQuestions.ts`: disponibilidade, o que diz gostar, pressão, experiência prática, por que aerodesign, trabalho em grupo, bases). Cada pergunta revela um atributo do perfil com ruído de ±18 pontos, reduzido pela comunicação média de quem entrevista (até 55% a 100). As respostas aparecem uma entrevista por vez enquanto a tarefa anda; encerrar no meio deixa as que faltam para agendar de novo.
- **Aprovação (S5).** `approve-applicants` cria os trainees (o perfil escondido vira o `Member`; preferências reais e facilidade continuam escondidas, como na Fase 8). As vagas são quantas pessoas o jogador aprovar (até 20). A campanha some e os demais recebem um e-mail (só mensagem). Antes de 1/fev viram `trainee`; depois (campanha de março) já entram como integrantes, porque a etapa trainee acaba em 1/fev. `recruitment`, `hire-candidate` e `dismiss-candidates` saíram.
- **Janelas.** Campanha de novembro (Ano 1, fundação) e de março (calouros, semestres iniciais pesam mais); marcos no calendário. Abrir fora delas é possível, com menos inscritos.

**Proporção de gênero (Fase 7) [DECIDIDO]:** o sorteio de nome e aparência de fundadores, candidatos e trainees segue `BALANCE.people.femaleShare` = 0,2, a proporção real da engenharia aeronáutica, sem diversidade forçada (`drawPerson`; `MemberLook.female`).

**Etapa trainee (1/dez a 1/fev):** quem é aprovado na seletiva antes de 1/fev chega como `trainee`; mais trainees dividem as mesmas horas de capitão, então cada um treina menos por tarefa. A tarefa "Treinamento de trainees" (horas do trainee e de um capitão; sem capitão rende 50%) dá horas de treino e conhecimento. Em 1/fev cada trainee vira integrante ou desiste, com chance de ficar entre 40% (motivação 0) e 95% (100), multiplicada por 0,5 a 1 conforme o treino (**[PROPOSTA]**, `BALANCE.trainee`).

### 5.3 Conhecimento: tácito vs documentado **[DECIDIDO]**

- **Tácito:** vive na pessoa. Cresce trabalhando na disciplina e participando de ensaios. Sai com ela.
- **Documentado (da equipe):** vive no acervo. É o **piso** de conhecimento de qualquer integrante naquela disciplina.
- **Documentar** (tarefa, custa horas) converte parte do tácito de alguém em documentado e adianta o capítulo correspondente do relatório.
- **Mentoria** (veterano + novato) transfere tácito direto entre pessoas: mais rápido que documentar, mas só para uma pessoa.
- Na tela da equipe, quem vai sair mostra **"conhecimento em risco"**.

### 5.4 Liderança e delegação **[DECIDIDO como princípio; mecânicas em PROPOSTA]**

O orientador não fabrica nem calcula: coordena (o presidente, aluno, trabalha como qualquer outro). Gerir a equipe é o mesmo problema de qualquer grupo trabalhando em paralelo: **fazer muita gente produzir ao mesmo tempo sem perder a coerência do avião.** Quatro princípios guiam as mecânicas:

1. **Delegar com instrução, não só alocar.** Ao iniciar uma tarefa, o orientador escolhe quem lidera e a **dedicação** (rápido, normal, caprichado). Instrução vaga sai rápido e com mais variância; instrução caprichada custa horas e reduz o erro.
2. **Dependências visíveis.** Algumas tarefas só começam quando outras terminam (fabricar a asa depende do projeto aerodinâmico; o relatório de Estruturas depende do ensaio estrutural). Adiantar o que tem dependência é possível, mas o que for feito sobre base não confirmada pode virar retrabalho.
3. **Integração é um evento.** Montar o protótipo ou o avião oficial junta peças feitas por pessoas diferentes e pode revelar incompatibilidades (encaixe, peso acima do previsto, CG fora). A chance cai com o conhecimento documentado e com quem conhece o conjunto (capitão de projeto conceitual).
4. **A atenção do orientador é um recurso.** Pedidos de decisão (aprovar compra, escolher candidato, autorizar ensaio arriscado) chegam pela caixa de entrada; enquanto não são respondidos, a tarefa espera. A pausa automática já cobre os pedidos urgentes.

**Teste de validade:** toda mecânica que sai destes princípios precisa ser reconhecível por quem já foi de equipe de aerodesign. Se só fizer sentido como metáfora de gestão de projetos, fica de fora. O tema do jogo é aerodesign e pessoas, não gestão.

### 5.5 Escala da oficina **[PROPOSTA]**

Toda equipe real tem uma planilha de escala: quem está na oficina em cada turno, encaixado entre as aulas. A oficina é pequena, a chave fica com poucos e ninguém lamina sozinho. No jogo, a escala decide **quando** o trabalho de oficina acontece.

**A grade:** semana de 7 dias × 4 turnos.

| Turno | Horário | Observação |
|---|---|---|
| Manhã | 8h–12h | Disputa com aula |
| Tarde | 13h–18h | Disputa com aula |
| Noite | 19h–22h | Disputa com aula noturna em alguns semestres |
| Madrugada | 22h–3h | **O único turno em que todos estão livres.** Sempre disponível na grade; cobra sono |

**Madrugada:** na engenharia, cada semestre tem uma grade diferente. Juntar Aerodinâmica, Estruturas e Elétrica no mesmo turno quase sempre só é possível de madrugada. É ali que acontecem a integração do avião e as laminações grandes, que precisam de muita gente ao mesmo tempo.

- **Sem autorização:** a oficina é da equipe, fora do bloco de aulas, e a equipe tem a chave (quem pode abrir a oficina continua sendo decisão do orientador: a chave). A madrugada está sempre disponível na grade; o que a limita são os custos abaixo, não um pedido ao departamento (decidido no playtest de 01/11/2026).
- **Sono cobra a conta [Fase 8]:** a madrugada gasta mais energia (×1,6, e ×2,2 depois da 1h) e não deixa recuperar; quem virou a noite acorda com pouca energia e rende menos no dia seguinte (uma consequência contínua, no lugar de perder o turno da manhã), além da queda de motivação, que aumenta com madrugadas seguidas.
- **Cansaço gera erro:** trabalho de madrugada sai com qualidade menor (como uma dedicação "rápida" involuntária), maior depois da 1h. Dá para compensar com a dedicação "caprichado".
- **Virada antes de prazo:** na semana de um prazo (relatório, vídeo de voo), a madrugada rende mais motivação em vez de tirar. A equipe se une na reta final, e qualquer um que já virou noite na oficina reconhece isso. Fora dessas semanas, ela desgasta.

- Cada integrante tem a **grade de aulas** do semestre. Turno com aula fica bloqueado. Em semana de provas, os turnos livres somem; nas férias de julho, todos ficam livres (é o 160% da seção 4.4, agora visível).
- O orientador monta a escala arrastando pessoas para os turnos. O capitão sugere uma **escala automática**, que o orientador aceita ou ajusta: a atenção do orientador é recurso (§5.4).

**O que a escala muda:**

- **Só tarefa de oficina depende dela:** fabricar, reparar, montar, laminar. Ela só avança nos turnos em que quem está alocado nela está escalado. Estudo, relatório, divulgação e captação continuam fora da oficina, nas horas livres do dia.
- **Lotação:** a oficina tem **4 lugares** no Ano 1. Turno cheio não aceita mais ninguém.
- **Chave:** a oficina só abre se alguém com chave estiver no turno (no começo, os capitães). Dar a chave a mais gente é uma decisão simples, sem custo.
- **Nunca sozinho:** laminação com resina e uso de máquinas exigem duas pessoas no turno (regra de segurança de toda oficina universitária). Com uma pessoa só, a tarefa não anda e o hangar mostra o motivo.
- **Turno junto ensina:** veterano e novato no mesmo turno é mentoria de graça (§5.3): o novato ganha conhecimento tácito mais rápido.
- **Escala automática sabe da madrugada:** o capitão só sugere madrugada quando a tarefa precisa de gente que não coincide em nenhum outro turno, e avisa o custo.
- **Estimativas respeitam a escala:** "~3d restantes" passa a contar só os turnos escalados. Escala vazia = "não anda".

**No hangar:** a cena mostra quem está escalado naquela hora. Fora de turno a oficina fica vazia; à noite, com luz acesa; de madrugada, cheia, com café, pizza e gente cochilando no canto. É o que faz o hangar parecer vivo (referência Habbo).

**Fica de fora do Ano 1:** ampliar a oficina (mais lugares e áreas), troca de turno entre integrantes, ponto e frequência.

---

## 6. Projeto da aeronave **[PROPOSTA]**

### 6.1 Decisões de projeto (a prancheta)

| Decisão | Opções | Compromisso (regras 2026) |
|---|---|---|
| Envergadura (b) | 1,5 a 4,0 m | Mais sustentação e carga ↔ pontuação multiplicada por `1,15^(−b)` (2 m: ×0,76 · 3 m: ×0,66 · 4 m: ×0,57) |
| Superfícies sustentadoras (N) | 1 (asa voadora) · 2 (convencional) · 3 (três superfícies) | Multiplicador `0,185N² − 0,775N + 1,81`: N=1 ×1,22 · N=2 ×1,00 · N=3 ×1,15. Asa voadora pontua mais mas é difícil de estabilizar e carregar; N=3 exige que a terceira superfície tenha função real |
| Potência (P) | 300 a 600 W | Decolagem antes dos 55 m ↔ bateria e peso |
| Filosofia | Alta carga · Leve · Estável | Equivalente aos "conceitos" do jogo atual |
| Materiais | Balsa · Compósito · Misto | Peso vazio ↔ custo ↔ dificuldade de fabricação |
| Altura do trem | Baixo · Alto | Altura livre em 2026, mas avião alto rompe a fita se abortar a decolagem. Também limita a hélice (baixo ≤ 15", alto ≤ 20") |
| Corda média (c) | 0,25 a 0,60 m | Área S = b × c e alongamento AR = b / c. Mais corda = mais sustentação e longarina mais leve; mais AR = menos perda de asa finita (AR/(AR+2)), longarina mais pesada |
| Posição da asa | Alta · Baixa | Alta: +0,03 de estabilidade (efeito pêndulo). Baixa: efeito solo (corrida ÷1,04) e −0,03 de estabilidade |
| Volume de cauda (VH) | 0,30 a 0,70 | Cauda maior = ponto neutro mais atrás (mais estável) e empenagem mais pesada. Ignorado na asa voadora |
| CG | 10 a 45 % da CMA | CG atrás = margem estática menor = mais carga e mais risco (seção 6.5) |
| Hélice | 10 a 20 pol. | Tração estática ∝ D^(2/3) com a mesma potência (teoria do momento); hélice maior pesa um pouco mais |

Padrão seguro: b 2,8 m · c 0,40 m (AR 7) · N 2 · 550 W · hélice 14" · leve · balsa · trem baixo · asa alta · VH 0,45 · CG 30 % (margem ~11 %).

A prancheta mostra ao vivo o **multiplicador de pontuação** da configuração e a estimativa de desempenho. Com 2026 pontuando **eficiência estrutural (carga ÷ peso vazio)**, avião leve vale tanto quanto avião que carrega muito.

### 6.2 Valores reais vs estimados (o coração do jogo)

Cada avião tem valores **reais e escondidos**: peso vazio, carga máxima em função da altitude densidade, distância de decolagem e confiabilidade. A equipe vê **estimativas com margem de erro**:

```
Carga máxima estimada (alt. densidade 900 m):  11,8 kg ± 2,1 kg
Peso vazio estimado:                             3,4 kg ± 0,4 kg
Eficiência estrutural estimada:                  3,5   ± 0,7
```

- A margem diminui com **conhecimento** (Aerodinâmica e Desempenho → carga; Estruturas → peso vazio) e, muito mais, com **ensaios** (seção 7).
- No prazo do relatório (16/ago) a equipe **congela** no Portal da CT:
  - o **peso vazio previsto** (vira o FPV);
  - a **reta de previsão de carga** `carga = a × altitude densidade + b`, com patamar máximo opcional, exatamente como a regra 11.6 (vira o PAC).
- O jogo desenha essa reta com base nas estimativas da equipe; o jogador pode ajustá-la (ser conservador ou agressivo).

### 6.3 Fases físicas do avião

Protótipo (barato, pode ser incompleto) → avião oficial (o que compete) → reparos e alterações. Alterações comunicadas até 27/set têm penalidade menor; depois disso, maior (regra real).

### 6.4 Orçamento de massa **[PROPOSTA, Fase 5]**

O peso vazio é a soma de sete subsistemas (`massBudget`), cada um com a sua margem; a soma é o peso vazio da estimativa de desempenho. A estrutura (asa, fuselagem, empenagem, trem) é multiplicada pela filosofia (alta carga ×1,08 · estável ×1,00 · leve ×0,90); motor, bateria e eletrônica são comprados prontos.

| Subsistema | Fórmula (kg) | Padrão |
|---|---|---|
| Asa | casca × S + longarina × b² × (0,40 / c); asa voadora ×1,1. Casca: balsa 0,90 · misto 0,80 · compósito 0,72 kg/m². Longarina: 0,090 · 0,080 · 0,065 | 1,54 |
| Fuselagem | 0,40 + 0,24 × braço de cauda (lh = 2,5 c; asa voadora sem cone) | 0,58 |
| Empenagem | (1,05 × Sh + 0,04) × material (balsa 1 · misto 0,92 · compósito 0,85), Sh = VH × S / 2,5; N=3 soma o canard (15 % de S) | 0,23 |
| Trem de pouso | baixo 0,25 · alto 0,35 | 0,23 |
| Motor e hélice | 0,10 + 0,0003 × P + 0,035 × (D / 14)² | 0,30 |
| Bateria | 0,12 + 0,0004 × P (LiPo para ~2 min a 600 W) | 0,34 |
| Eletrônica | 0,20 (+0,03 com canard) | 0,20 |
| **Peso vazio** | | **3,41** |

Origem: asas de balsa entelada de aerodesign ficam em 0,8–1,2 kg/m² com longarina; o momento fletor cresce com b e a altura da longarina com c, daí o termo b²/c. Sustentação ao nível do mar = 18,9 × S × AR/(AR+2) × N × filosofia × trimagem (18,9 ≈ ½ ρ0 V² CLmax / g com V ≈ 13 m/s e CLmax ≈ 1,9 de perfil de alta sustentação; AR/(AR+2) é a perda da asa finita). A corrida usa S / 0,40 no lugar de b, então o avião de corda 0,40 m corre igual ao modelo da Fase 3. O padrão leva ~10,9 kg a Hρ 1000 m.

Escondido: cada subsistema tem um desvio sorteado no primeiro projeto (feito em casa ±6 %, comprado ±2 %), além do desvio do material sobre a estrutura.

### 6.5 Estabilidade: ponto neutro e margem estática **[PROPOSTA, Fase 5]**

`stabilityEstimate`: ponto neutro (% CMA) = 25 + 100 × 0,9 × VH × (at/aw) × (1 − dε/dα) − 3, com aw ∝ AR/(AR+2), cauda de AR 4 e downwash dε/dα ≈ 4/(AR+2). Asa voadora: 33 % (reflexo e enflechamento); canard (N=3): −8 %. Margem estática = ponto neutro − CG. Padrão: ponto neutro 41 %, margem 11 %.

| Faixa | Margem (% CMA) | Efeito |
|---|---|---|
| Ok | 5 a 20 | — |
| Risco | 0 a 5 (pouco estável) ou 20 a 30 (rígido) | Pouca margem: mais carga, mais chance de queda. Muita: corrida +1,5 % por ponto acima de 20 |
| Falha | < 0 (instável) ou > 30 | Instável: estabilidade do voo cai para 0,2 ou menos (risco alto) |

- Carga: margem abaixo de 12 % dá +0,4 % de sustentação por ponto (a cauda carrega menos para baixo), entre ×0,92 e ×1,06.
- Estabilidade 0–1 do voo: 0,15 + 0,04 × margem até 10 %, depois +0,02 por ponto até 20 %; + filosofia estável 0,10, asa alta +0,03 / baixa −0,03, asa voadora −0,10.
- A estimativa tem ±5 % CMA sem conhecimento nem ensaio; encolhe com Estabilidade e com voos. A margem real tem desvio escondido de ±3 % (onde o CG cai de fato).

### 6.6 Requisitos da missão e comparação **[PROPOSTA, Fase 5]**

`missionRequirements(state, design, Hρ, carga-alvo)`: cada requisito com valor ± margem e status. **Ok** = passa até no pior caso da margem; **risco** = passa no valor central; **falha** = não passa.

| Requisito | Alvo |
|---|---|
| Corrida com a carga-alvo | ≤ 55 m |
| Folga sobre a fita aos 55 m | ≥ 0 m (a mesma subida da competição, sem ruído) |
| Margem estática | 5–20 % CMA |
| Envergadura | ≤ 4,0 m (sem PD) |
| Potência de pico | ≤ 600 W (sem PP) |
| Peso vazio | ≤ min(sustentação estimada, 20 kg) − carga-alvo |

Carga-alvo padrão: a da reta de previsão, senão a carga máxima estimada. `compareDesigns` devolve, para dois projetos (gravado × rascunho), requisitos, orçamento de massa, estabilidade, multiplicador (7.5) e a nota estimada de uma bateria com a carga-alvo e previsões certeiras. Um rascunho diferente do gravado conta só metade dos ensaios na margem.

---

## 7. Fabricação, peças e ensaios

### 7.1 Peças **[PROPOSTA]**

Asa · Fuselagem e compartimento de carga · Empenagem / superfícies · Trem de pouso · Grupo motopropulsor (motor, hélice, ESC) · Eletrônica (servos, receptor, baterias, wattímetro).

Cada peça tem qualidade de fabricação (quem fabricou, material, equipamento) e condição.

### 7.2 Estados visíveis **[DECIDIDO]**

Internamente, condição de 0 a 100. Na tela:

| Estado | Condição | Efeito |
|---|---|---|
| Nova | 80–100 | — |
| Desgastada | 50–79 | Risco de quebra médio |
| Danificada | 20–49 | Risco alto; reparo recomendado |
| Quebrada | 0–19 | Não voa; substituir |

**Reparar** custa horas e créditos e recupera parte da condição. **Substituir** custa a fabricação inteira. Reparo em peça primária sem notificar a CT gera penalidade na competição (Apêndice 6).

### 7.3 Ensaios **[PROPOSTA]**

| Ensaio | Reduz incerteza de | Risco |
|---|---|---|
| Estrutural de bancada (asa carregada) | Peso vazio, limite estrutural | Quebrar a asa de teste |
| Motor e hélice em bancada | Tração, potência de pico | Baixo |
| Voo de protótipo | Estabilidade, decolagem | Dano / queda |
| Voo com carga incremental | Carga máxima (pontos da reta de previsão) | Dano / queda, cresce com a carga |
| Treino de retirada de carga | Tempo de retirada | Nenhum |
| Voo filmado (vídeo oficial) | — | Obrigatório até 27/set |

**Ensaio de voo como evento [PROPOSTA, Fase 5].** Bancada continua tarefa da oficina; o voo (com carga ou filmado) é agendado (`schedule-flight-test`): local, dia, piloto, tripulação e cargas planejadas (1 a 5 decolagens, 0 a 20 kg). Local e piloto contratado são pagos ao marcar.

| Local | ◆ | Antecedência | Dias | Estrada | Hρ típica às 8h |
|---|---|---|---|---|---|
| Aeroclube de Vila Serena | 120 | 7 dias | sáb e dom | 25 km | ~760 m |
| Pista do Clube Asas do Planalto | 60 | 3 dias | qua, sáb e dom | 12 km | ~860 m |
| Fazenda Boa Esperança (do Juca, ex-integrante) | 30 | 1 dia | todos | 60 km | ~670 m |

- **Piloto:** integrante com pilotagem ≥ 30 (treina pilotagem no ensaio) ou piloto contratado (◆ 150, pilotagem 80, não deixa conhecimento). Para um integrante chegar a 30 há a ação "Treino de pilotagem" (10 h, ◆ 20).
- **Recusa:** avião incompleto, caixa curto, dia fora da semana do local, antecedência curta, tripulação vazia ou acima de 6, alguém já em outro ensaio no mesmo dia, data depois da competição.
- **Cancelar:** devolve 50 % do pago.
- **No dia (evento, Fase 7):** a chamada vem 3 h antes da primeira decolagem (5h) e abre o modo evento; o agendamento não muda. Blocos: viagem (transporte), montagem e checagem, uma decolagem por carga planejada (a cada 30 min a partir das 8h) e desmontagem. Decisões: **peça com folga** na checagem (40% de chance, a peça de pior condição: trocar o parafuso gasta 1 h e ◆ 10 e melhora a peça em 15, ou voar assim, o que tira 15 de condição efetiva em todas as decolagens); **rajada de vento** antes de uma decolagem (35% por decolagem, 5 a 8 m/s de través: voar agora perde 20 de pilotagem efetiva, esperar 30 min a faz passar com 70% de chance, tirar 1 kg da carga perde 8 de pilotagem); e **depois de um pouso duro ou queda**, encerrar o dia (tira as decolagens que faltam) ou seguir. O histórico (`testLog`), a evidência, o conhecimento e o `FlightTest.takeoffs` só entram no fechamento (`close-event`); peças já se danificam durante o dia. Valores em `BALANCE.flightTests`, **[PROPOSTA]**. Abaixo, as regras que seguem iguais: Transporte: 0,2 % por km de chance de danificar uma peça (10–25 de condição). O clima é o da região com a pressão do campo (Apêndice 4 dá a Hρ). Cada carga, a cada 30 min, é uma decolagem do motor da competição (`resolveFlight`) com `FlightPlayback`; pouso duro e queda danificam como na competição, queda encerra o dia, toda decolagem desgasta 3 pontos de cada peça. Voo que sai do chão vira ponto (Hρ, carga) da reta. Evidência por decolagem: voo (carga 0,4 · decolagem 0,3 · estabilidade 0,5) ou no limite, sem decolar ou rompendo a fita (0,6 · 0,5 · 0,2). A tripulação ganha 6 h de Desempenho (meia taxa em Aerodinâmica e Estabilidade). Filmado com um voo limpo até 27/set vale como vídeo oficial.
- `upcomingEvents`: ensaios agendados e a competição, do mais próximo ao mais distante.

Cada ensaio gera **conhecimento tácito** para quem participou, desgasta as peças usadas e pode danificá-las ou quebrá-las. Ensaios em dias diferentes (frio/calor) dão pontos em altitudes densidade diferentes e melhoram a reta de previsão. Equipamentos (balança, bancada, telemetria) aumentam o aprendizado e reduzem o risco.

---

## 8. Custos: tempo, dinheiro ou os dois **[DECIDIDO: separar bem]**

### 8.1 As três moedas

Toda ação do jogo mostra o que custa, sempre com os mesmos ícones e na mesma ordem:

| Moeda | Ícone | O que é | De onde vem |
|---|---|---|---|
| **Horas** | ⏱ | Horas-pessoa da equipe. Recurso que se renova todo dia, mas se perde se não for usado | Integrantes × disponibilidade × calendário acadêmico × motivação × energia |
| **Créditos** | ◆ | Dinheiro do caixa. Acumula | Captação, prêmios |
| **Prazo** | ⌛ | Espera no calendário **sem ocupar ninguém** (entrega de compra, cura de resina, resposta de patrocinador) | — |

E um custo que não é moeda, mas aparece no mesmo cartão:

| Consequência | Ícone | O que é |
|---|---|---|
| **Desgaste / risco** | ⚠ | Condição das peças que se perde e chance de dano ou quebra |

A distinção entre **horas** e **prazo** é a que mais importa para a sensação de urgência: comprar um motor não ocupa ninguém, mas leva 10 dias para chegar; fabricar uma asa não espera entrega, mas ocupa duas pessoas por uma semana. Os dois atrasam o avião, de jeitos diferentes, e o jogador precisa ver isso de relance.

Exemplo de cartão de ação:

```
Fabricar asa (balsa)       ⏱ 60 h   ◆ 180   ⌛ —      ⚠ —
Comprar motor 600 W        ⏱ —      ◆ 420   ⌛ 10 d   ⚠ —
Voo com carga incremental  ⏱ 12 h   ◆ 30    ⌛ —      ⚠ médio
```

### 8.2 Classificação das ações **[PROPOSTA]**

**Só horas ⏱**

| Ação | Observação |
|---|---|
| Seletiva: divulgação, abertura e entrevistas | Tarefas com gente: divulgação e abertura (30 h-pessoa) e entrevistas (1,5 h por entrevistador, em dupla). Divulgação orgânica é grátis; a palestra e o dia da dinâmica não ocupam as tarefas |
| Estudo/projeto por disciplina | Gera conhecimento tácito e reduz incerteza |
| Escrever capítulo do relatório, plantas | |
| Documentar conhecimento, mentoria | |
| Ensaio de apresentação oral | |
| Treino de retirada de carga | |
| Ensaio de bancada com peças já existentes | Desgasta peças ⚠ |
| Captação: rifa, campanha, contato com patrocinador | **Gasta horas para gerar créditos**; patrocínio também tem ⌛ até a resposta |

**Só créditos ◆ (quase sempre com prazo ⌛)**

| Ação | Observação |
|---|---|
| Comprar componentes comerciais (motor, ESC, hélice, servos, receptor, baterias, wattímetro) | ⌛ de entrega; servos precisam ser comerciais pela regra real |
| Comprar equipamento (balança, bancada, gabaritos, telemetria) | ⌛ de entrega; efeito permanente |
| Comprar material em estoque (balsa, fibra, resina) | ⌛ de entrega; consumido depois na fabricação |
| Inscrição na competição | Prazo fixo do calendário |
| Frete expresso | Troca ◆ por menos ⌛: a válvula de escape da urgência |

**Horas + créditos ⏱◆**

| Ação | Observação |
|---|---|
| Fabricar peça | Consome material do estoque + horas de fabricação |
| Montar protótipo / avião oficial | Horas de integração + itens de consumo |
| Reparar peça | Mais barato que substituir, recupera só parte da condição |
| Voo de ensaio | Horas de equipe em campo + deslocamento; ⚠ desgaste e risco |
| Voo filmado (vídeo oficial) | Igual ao voo de ensaio, com mais pressão |
| Viagem para a competição | Créditos de viagem + a equipe fica dedicada ao evento |

### 8.3 Regras gerais **[DECIDIDO]** (ver ESPECIFICACAO_ANO_1)

- **Horas exigem gente [Fase 8].** Toda ação com horas pede o mínimo de pessoas livres para começar (§4.2). Ação só com créditos e prazo (pedidos, frete) não ocupa ninguém. Encerrar uma tarefa devolve a equipe na hora; créditos e material gastos não voltam, exceto a peça parcial, que continua no hangar.

- Caixa inicial: **0 créditos**. As primeiras ações possíveis são as "só horas", incluindo captação.
- Seletiva (divulgação, entrevistas e aprovação) e divulgação orgânica: grátis em créditos; custam só horas.
- **Captação de contingência** só abre depois de dano grave ou quebra.
- Nada compra atributo diretamente. Créditos compram coisas; horas fazem coisas.

Valores numéricos ficam para o balanceamento (testados no protótipo).

### 8.4 Compras pela internet do jogo **[PROPOSTA]**

Comprar não é um botão "Comprar motor": é abrir o **navegador do jogo** e escolher onde comprar, como os sites dentro do celular do GTA V. Cada loja é uma paródia de onde as equipes reais compram, com identidade visual própria (logo, cores, tom do texto) e o mesmo produto custando, demorando e falhando de jeitos diferentes. Quem já esperou um motor importado travado na alfândega a duas semanas do vídeo de voo vai reconhecer.

**Lojas:**

| Loja no jogo | Inspirada em | Vende | Preço | Prazo ⌛ | Risco |
|---|---|---|---|---|---|
| **HobbyKong** | HobbyKing | Motores, ESC, hélices, baterias, servos | Baixo | Longo (importação) | Taxação e retenção na alfândega; qualidade média |
| **AliExpresso** | AliExpress | Tudo, inclusive eletrônica genérica | Muito baixo | Muito longo, espalhado | Peça fora da especificação; servo "comercial" falsificado |
| **Mercado Solto** | Mercado Livre | Revendedores nacionais | Médio | Curto a médio | Depende da reputação do vendedor (estrelas) |
| **Hangar do Aeromodelista** | Lojas nacionais de aeromodelismo | Componentes originais, equipamento | Alto | Curto | Baixo; às vezes sem estoque |
| **Balsa Leve Madeiras** | Fornecedores de balsa | Balsa por densidade (leve, média, dura) | Médio | Médio | Lote leve é mais leve e mais frágil |
| **Compósitos do Vale** | Fornecedores de fibra e resina | Fibra de carbono, fibra de vidro, resina | Alto | Médio | Resina vence se ficar parada |
| **Desapega Aero** | OLX / grupos de veteranos | Peças usadas de equipes que se formaram | Muito baixo | Curto (retirada) | Condição desconhecida até chegar |

**Como funciona:**

- **Mesmo produto, várias lojas.** O motor de 600 W existe na HobbyKong, no AliExpresso e no Hangar do Aeromodelista. O jogador compara preço ◆, prazo ⌛ e risco ⚠ e decide. É o mesmo cartão de custo da seção 8.1, só que agora a escolha é onde comprar.
- **Prazo é faixa, nunca data.** A loja promete "chega em 12–20 dias"; o real é sorteado (regra "nada é garantido" da simulação). Importados têm faixa mais larga.
- **Frete é escolha do checkout.** Normal ou expresso, por loja (loja nacional tem expresso barato; importação quase não tem). Substitui a ação genérica "Frete expresso".
- **Rastreio pela caixa de entrada.** "Pedido enviado", "Retido na fiscalização: pague ◆ 180 de imposto", "Saiu para entrega". Na entrega, a peça aparece no hangar.
- **Qualidade de origem.** Peça comprada também tem qualidade (como a fabricada). Loja barata = mais variação. A equipe só descobre ao receber, e mais cedo se tiver balança ou bancada de motor.
- **Regra real amarrada:** servo precisa ser comercial. Servo falsificado do AliExpresso pode reprovar na inspeção de segurança (seção 9.2).
- **Estoque e promoções.** Itens esgotam e voltam; a HobbyKong tem promoção relâmpago de vez em quando. Cria a pergunta "compro agora ou espero?".
- **Avaliações como risco legível.** Estrelas e comentários de outras equipes (paródia) mostram o risco em linguagem clara, como pede o pilar 5.

**Fica de fora do Ano 1:** câmbio do dólar variando, vender peças no Desapega, patrocínio em produto (desconto numa loja).

---

## 9. A competição (o clímax)

Dois blocos, como na regra real: **Competição de Projeto** e **Competição de Voo**.

**A competição é um evento de vários dias (Fase 7) [PROPOSTA]:** no marco do calendário o relógio pausa e abre o modo evento, que dura 4 dias (`BALANCE.competition.flightDays` = 3 dias de voo): **dia 1** chegada (8h), exposição (9h), inspeção técnica (13h) e reunião técnica com a fila da bateria 1 (16h30); **dias 2 a 4** briefing com a previsão do tempo (6h30) e cinco janelas de voo de 2 h (7h às 17h, 10 decolagens por janela, uma equipe a cada 12 min); **no fim** placar e premiação (17h do último dia, ou antes se as baterias acabam). A fila, o clima, os rivais e a Tabela 10.1 são os da Fase 3. A tela Competição passa a ser só histórico e regulamento. Enquanto o evento roda o resto da equipe fica parado (o dia é contado como parado).

### 9.1 Competição de Projeto: 225 pontos

| Item | Máximo |
|---|---|
| Projeto conceitual e preliminar | 30 (20 relatório + 10 plantas) |
| Aerodinâmica | 25 |
| Desempenho | 25 |
| Estabilidade e controle | 25 |
| Cargas e aeroelasticidade | 25 |
| Estruturas e ensaios estruturais | 30 (20 + 10) |
| Projeto elétrico e safety assessment | 25 |
| **Relatório + plantas (NR)** | **185** |
| Apresentação oral (online, 17/out) | 40 |

A nota de cada capítulo depende de **conhecimento documentado + horas investidas + ensaios citados**. A apresentação depende de quem apresenta e de ensaios de apresentação. **[PROPOSTA]**

### 9.2 Inspeção de segurança **[PROPOSTA]**

Checklist com itens reais simplificados (fixação da carga, cablagem, servos comerciais, arm plug, identificação). Itens reprovados exigem correção na hora, com a fila esperando. Pode impedir de voar.

**No evento (Fase 7), cada pendência é uma decisão do bloco de inspeção** (`inspectionFindings`): *avião incompleto*: improvisar as peças na oficina móvel (10 h, ◆ 100, peças de qualidade 45) ou ficar de fora dos voos; *sem vídeo de voo*: pedir liberação condicional (15 pontos de penalidade) ou ficar no chão; *eletrônica falsificada*: comprar a certificada no pátio (3 h, ◆ 120) ou voar assim com 10 pontos de penalidade e a peça falsificada no avião. As horas das opções cansam a equipe (motivação). Sem avião não há decisão: a equipe só acompanha.

### 9.3 Baterias de voo: fórmulas reais da Classe Regular 2026

Por bateria:

```
EE   = CP / PV                                   (eficiência estrutural)
PEE  = 50 × EE
FPV  = 1,10 − 15 × ((PVprevisto − PVreal) / PVprevisto)²      mínimo 0,80
FPR  = min(1,00 ; 0,50 + 0,75 × NR / 185)        (o relatório multiplica o voo!)
PVOO = FPV × FPR × PEE × (0,185N² − 0,775N + 1,81) × 1,15^(−b)
PAC  = max(0 ; 30 − 830 × |(CPprevista − CPreal) / CPprevista|^1,75)
       CPprevista = reta de previsão avaliada na altitude densidade do momento
BPO  = 2,0 × EE           (parou dentro da pista)
BRC  = 20 se t ≤ 20 s ;  max(0 ; 20 − 6,324 × √(t − 20)) se t > 20 s
Bateria = PVOO + PAC + BPO + BRC − PD − PP
```

Uma vez na competição:

```
BCF = max(0 ; 20 × [1 − (5 × (PB1 − PB2) / PB1)²])     (duas boas baterias parecidas)
```

Vale a **melhor bateria** + BCF + Competição de Projeto − penalidades acumuladas.

Nota de leitura: no PDF, a fórmula do BRC aparece como `√t − 20`; a forma `√(t − 20)` é a única contínua em t = 20 s e zera exatamente em 30 s (20 ÷ √10 = 6,324), então é a adotada.

**Altitude densidade** (Apêndice 4), divulgada pela CT ao longo do dia:

```
Hρ = (T0 / 0,0065) × [1 − ((Plocal/P0) / (Tlocal/T0))^0,234959]
T0 = 288,15 K · P0 = 1013,25 hPa
```

**Classificação para as baterias** (Tabela 10.1, Regular): baterias 1 a 3 abertas; da 4ª em diante, ter voo válido com **EE ≥ 2,5 / 3,0 / 3,5 / 4,0** ou estar entre as 10 primeiras, com mínimo de 25 / 20 / 15 / 15 equipes.

### 9.4 A decisão de cada bateria (o momento "Into Space")

Tudo acontece dentro do evento (Fase 7): a fila anda a cada bloco de voo, o sol sobe, o ar fica menos denso. Antes de cada bateria o jogador vê:

- a **altitude densidade** do momento (manhã fria = ar denso = mais carga; tarde quente = menos);
- a estimativa de carga máxima **para essas condições**, com a margem de erro da equipe;
- o valor da sua reta de previsão nesse ponto (o PAC pune quem se afasta dela);
- o estado das peças.

E escolhe **quanta carga colocar**. No evento isso é **a decisão do bloco**: quando a bateria abre e você está nela, o cartão oferece seguir a previsão da reta, subir a carga (+8%) ou aliviar (−8%), com o limite estimado do dia e a margem de erro. A carga declarada fica valendo para a bateria; `set-battery-payload` continua existindo para revisar na fila, desde que haja pelo menos 3 equipes à frente (regra real R[10.1.5.3]); depois disso, é aquilo.

O voo é uma cena: corrida → obstáculo de 0,9 m aos 55 m → circuito padrão → pouso → **retirada rápida de carga cronometrada** (quadrado de 3×3 m, até duas pessoas). A física por trás é simplificada; a tensão é real.

Resultados possíveis: voo válido · não passou o obstáculo (inválido) · rompeu a fita · pouso fora da pista (sem BPO) · dano · queda (peças danificadas ou quebradas, talvez sem avião para a próxima bateria). Entre baterias, a equipe pode reparar no hangarete: depois de um voo seu com dano, o cartão oferece reparo completo (6 h, ◆ 60, peças a 85), remendo (2 h, ◆ 15, +25 de condição) ou seguir sem reparar.

---

## 10. Metas de estreia **[DECIDIDO]**

1. Realizar a seletiva e formar um núcleo funcional.
2. Construir e ensaiar pelo menos um protótipo.
3. Fabricar o avião oficial dentro do regulamento e entregar o vídeo de voo.
4. Completar pelo menos um voo válido na competição.
5. Bônus: ficar no top 10 da Classe Regular. **[PROPOSTA]**

---

## 11. Telas (notebook) **[PROPOSTA]**

| Tela | Tipo | Conteúdo |
|---|---|---|
| Central | Painel | Relógio e controles de velocidade, calendário com contagens regressivas, inbox (recados dos capitães, comunicados da CT) |
| Equipe | Painel | Elenco, alocação, conhecimento por disciplina, seletiva, escala da oficina (§5.5) |
| Prancheta | Painel | Decisões de projeto, multiplicadores de pontuação, estimativas com margem |
| Hangar | **Cena (Phaser)** | Oficina isométrica; integrantes trabalhando nas bancadas; tarefas e peças com barras de progresso e estados |
| Ensaios | Cena + painel | Escolher ensaio, ver acontecer, pontos da reta de previsão |
| Relatório | Painel | Capítulos por disciplina, nota estimada, reta de previsão e peso vazio a congelar |
| Finanças | Painel | Caixa, captação, gastos |
| Navegador | Painel (abas de sites) | Lojas da seção 8.4, cada uma com visual próprio: vitrine, carrinho, checkout, rastreio de pedidos |
| Regulamento | Painel | Regras do ano em linguagem acessível + aba **"Como é pontuado"** com as fórmulas reais **[DECIDIDO]** |
| Competição | **Cena (Phaser)** + painel | Pista, fila, altitude densidade ao vivo, escolha de carga, voo, placar |

Direção visual: imagens geradas pelo Gemini (painel escuro, ciano e laranja, ícones circulares).

---

## 12. Fora do escopo do Ano 1

- Classes Advanced e Micro.
- Anos 2 a 5 (sucessão, conhecimento entre anos, peças reaproveitadas, Torneio de Acesso).
- Balanceamento numérico final.
- Física de voo real: a simulação é plausível, não exata.
- Som, música, outros idiomas.
- Save com migrações (save incompatível é descartado durante o protótipo).

---

## 13. Decisões

### Fechadas em 31/10/2026

| # | Decisão |
|---|---|
| 1 | Mundo fictício, o mais parecido possível com o real |
| 2 | Calendário acadêmico genérico |
| 3 | ~30 equipes na Regular, 4–5 de destaque, nomes no padrão dos reais |
| 4 | Fórmulas reais visíveis na aba "Como é pontuado" |
| 5 | Tempo corrido com pausa e velocidades, não turnos |
| 6 | Prancheta com parâmetros reais (agora os de 2026: b, N, P) |
| 7 | Regulamento de referência: 2026 Rev01 |
| 8 | Organizadora e competição se chamam **Aerodesign Brasil** |
| 9 | Equipe nova **entra direto** na competição no Ano 1; Torneio de Acesso fica para a carreira |
| 10 | Escala de tempo (1 dia ≈ 10 s em 1×) será testada no protótipo |
| 11 | Custos separados em horas, créditos e prazo, com desgaste/risco à parte (seção 8) |

### Fechadas em 01/11/2026 (Fase 6)

| # | Decisão |
|---|---|
| 12 | O jogador é o **professor orientador**, permanente de ano para ano; o presidente é um aluno NPC com uma agenda |
| 13 | A temporada começa em **10/nov/2025**, com 4 fundadores que convidam o orientador; `found-team` é a eleição de fundação |
| 14 | Pré-temporada (nov a fev): seletiva em novembro, etapa trainee de dez a jan, férias de verão com horas reduzidas |
| 15 | A Prancheta e a leitura do regulamento abrem em 9/fev; sem a leitura, a penalidade por alteração tardia de projeto na inspeção é multiplicada (`BALANCE.season.unreadPenaltyFactor`, **[PROPOSTA]**) |
| 16 | Calendário anual no estilo FIFA com ações agendadas (seção 4.5) |

### Fechadas em 01/11/2026 (Fase 7, Simulação)

| # | Decisão |
|---|---|
| 17 | Dinâmica da seletiva, ensaio de voo e competição são **eventos imersivos** (modo evento): comandos `enter-event`, `advance-event`, `decide-event`, `close-event`; o relógio fica parado enquanto `activeEvent` existe |
| 18 | A competição tem 4 dias no evento (chegada e inspeção, 3 dias de voo), com a carga de cada bateria como decisão; o dia 1 e as janelas de 2 h são **[PROPOSTA]** |
| 19 | A equipe segue a proporção real da engenharia aeronáutica: `BALANCE.people.femaleShare` = 0,2 |
| 20 | A agenda do presidente vira prioridade com texto do efeito, no conteúdo; a duração da tarefa tem leitura `taskEta` |

### Ainda abertas

Nenhuma bloqueante. Os itens marcados **[PROPOSTA]** valem como decididos até que o Henrique peça mudança.

---

## Fontes

- Regulamento SAE BRASIL AeroDesign 2026 Rev01 (PDF fornecido pelo Henrique): seções 7.2, 7.6, 7.7, 7.8, 10.1.5, 10.1.12, 10.2, 11.1, 11.6, 11.11; Apêndices 4 e 8.
- Regulamento SAE BRASIL AeroDesign 2024 Rev00 (comparação): https://saebrasil.org.br/wp-content/uploads/2023/05/Regulamento_SAE_BRASIL_AeroDesign_2024_Rev00.pdf
- Nomes de equipes reais citados como padrão: matérias públicas sobre a competição (Tucano, Uai-Sô-Fly, Falcons, Draco Volans, EESC Open, Axe Fly).
- Premissas e especificação do protótipo: `Aerodesign-Simulation/PREMISSAS_DO_JOGO.md`, `Aerodesign-Simulation/ESPECIFICACAO_ANO_1.md`.
- Lista de equipes inscritas (61 equipes), fornecida pelo Henrique: base do Apêndice A.

---

## Apêndice A · Equipes do jogo

Uma paródia por equipe real. A coluna "Inspirada em" é só para referência de design e **não aparece no jogo**. Cidades e estados são reais; instituições são fictícias (antes de publicar, conferir se alguma sigla coincidiu com instituição real).

| Nº | Equipe no jogo | Instituição fictícia (sigla) | Cidade / UF | Inspirada em |
|---|---|---|---|---|
| 1 | EESC-UESP Alfa | Universidade Estadual de São Paulo – Escola de Engenharia de São Carlos (EESC-UESP) | São Carlos / SP | EESC-USP Alpha |
| 2 | Axé Voa | Universidade Federal de Salvador (UFSal) | Salvador / BA | Axé Fly |
| 3 | Uiraí AeroDesign | Instituto Federal de Engenharia de Itajubá (IFEI) | Itajubá / MG | Uirá AeroDesign |
| 4 | Uai, Sô! Voa!!! AeroDesign | Universidade Federal das Gerais (UFGe) | Belo Horizonte / MG | Uai, sô! Fly!!! |
| 5 | AeroFEGu | Universidade Estadual Paulista Prof. Mesquita – Fac. de Eng. de Guaratinguetá (FEG-UEPM) | Guaratinguetá / SP | AeroFEG |
| 6 | Keep Climbing | Universidade Estadual de São Paulo – Escola Politécnica (Poli-UESP) | São Paulo / SP | Keep Flying |
| 7 | Monteverde | Instituto Técnico de Aeronáutica (ITAe) | São José dos Campos / SP | Montenegro |
| 8 | Tucanuçu | Universidade Federal do Triângulo (UFTri) | Uberlândia / MG | Tucano |
| 9 | Hawks AeroDesign | Centro Universitário de Sorocaba (CEUSO) | Sorocaba / SP | Falcons AeroDesign |
| 10 | CEFETA AeroDesign | Centro Federal de Tecnologia de Minas (CEFTEM) | Belo Horizonte / MG | CEFAST AeroDesign |
| 11 | F-Carrancudo | Universidade Federal do Velho Chico (UFVC) | Juazeiro / BA | F-Carranca |
| 12 | AeroTambaú | Universidade Federal Paraibana (UFPb) | João Pessoa / PB | AeroJampa |
| 13 | Gigazord AeroDesign | Faculdade Tecnológica de São José dos Campos (FATESJ) | São José dos Campos / SP | Megazord AeroDesign |
| 14 | Harpia-Real AeroDesign | Universidade Federal do Grande ABC (UFGABC) | Santo André / SP | Harpia AeroDesign UFABC |
| 15 | Carcarás AeroDesign | Universidade Campineira de Engenharia (UCE) | Campinas / SP | Urubus AeroDesign |
| 16 | UTFalcão AeroDesign | Universidade Tecnológica do Paraná – Ponta Grossa (UTPR) | Ponta Grossa / PR | UTFalcon AeroDesign |
| 17 | Falcão Prateado Aerodesign | Centro Universitário de Araras (UniAraras) | Araras / SP | Falcão Branco Aerodesign |
| 18 | FEA Regular | Centro Universitário de Engenharia do ABC (CUEA) | São Bernardo do Campo / SP | FEI Regular |
| 19 | AeroEscorpião IFP Araraquara | Instituto Federal Paulista – Araraquara (IFP) | Araraquara / SP | AeroScorpion IFSP Araraquara |
| 20 | Nexus AeroDesign | Universidade Federal Catarinense – Joinville (UFCat) | Joinville / SC | Nisus AeroDesign |
| 21 | Atena AeroDesign | Universidade Federal da Guanabara – Escola Politécnica (Poli-UFGB) | Rio de Janeiro / RJ | Minerva AeroDesign |
| 22 | Skyward UFVôo | Universidade Federal da Zona da Mata (UFZM) | Viçosa / MG | Skywards UFVoa |
| 23 | Condores AeroDesign | Universidade Tecnológica do Paraná – Cornélio Procópio (UTPR) | Cornélio Procópio / PR | Abutres AeroDesign |
| 24 | Atalântida | Universidade Tecnológica do Paraná – Curitiba (UTPR) | Curitiba / PR | Acalântis |
| 25 | RedBird AeroDesign | Universidade Federal de Niterói (UFNit) | Niterói / RJ | BlackBird AeroDesign |
| 26 | Ocapi | Universidade Estadual Paulista Prof. Mesquita – Fac. de Eng. de Ilha Solteira (FEIS-UEPM) | Ilha Solteira / SP | Zebra |
| 27 | Flaming Duck | Universidade Federal de Curitiba (UFCuri) | Curitiba / PR | Burning Goose |
| 28 | Hipogrifo AeroDesign | Universidade Tecnológica do Paraná – Londrina (UTPR) | Londrina / PR | Grifo AeroDesign |
| 29 | U-Vuela AeroDesign | Universidad Aeronáutica del Bajío (UNAB) | Querétaro / México | U-Fly AeroDesign |
| 30 | Dragão Dourado AeroDesign | Universidade Federal do Centro Paulista (UFCP) | São Carlos / SP | Dragão Branco AeroDesign |
| 31 | Apolo | Universidade Estadual Maranhense (UEMar) | São Luís / MA | Zeus |
| 32 | Delta do Parnaíba AeroDesign | Universidade Federal de Teresina (UFTer) | Teresina / PI | Delta do Piauí AeroDesign |
| 33 | PégaSertão AeroDesign | Universidade Federal Rural do Sertão – Mossoró (UFRuS) | Mossoró / RN | PegAzuls AeroDesign |
| 34 | AeroGaudério UPG | Universidade do Planalto Gaúcho (UPG) | Passo Fundo / RS | Aerocócus UPF |
| 35 | Jacutinga AeroDesign | Universidade Federal do Pantanal Sul (UFPS) | Dourados / MS | Aracuã AeroDesign |
| 36 | Losango Aéreo AeroDesign | Universidade Federal do Triângulo de Minas (UFTMi) | Uberaba / MG | Triângulo Aéreo AeroDesign |
| 37 | Draco Alatus | Universidade do Planalto Central – Faculdade de Tecnologia (FT-UPC) | Brasília / DF | Draco Volans |
| 38 | Coxilha AeroDesign | Universidade Federal Gaúcha (UFGa) | Porto Alegre / RS | Pampa AeroDesign |
| 39 | Aeroaraucária UCP | Universidade Católica Paranaense (UCP) | Curitiba / PR | Aerocária PUCPR |
| 40 | EVA AeroDesign | Universidade Estadual Maringaense (UEMg) | Maringá / PR | ADAM AeroDesign |
| 41 | Voyager | Universidade Joseense do Vale (UJV) | São José dos Campos / SP | Enterprise |
| 42 | Jandaia AeroDesign | Universidade Federal Cearense – Russas (UFCe) | Russas / CE | Aratinga AeroDesign |
| 43 | Buteo Aerodesign | Instituto Federal Paulista – São Carlos (IFP) | São Carlos / SP | Accipiter Aerodesign |
| 44 | AeroDuque | Centro Universitário Morumbi Paulistano (CUMP) | São Paulo / SP | AeroDuca |
| 45 | Pteranodon AeroDesign | Universidade Federal do Cerrado (UFCer) | Goiânia / GO | Aerodactyl |
| 46 | EPAR AeroDesign | Universidade Tecnológica do Paraná – Pato Branco (UTPR) | Pato Branco / PR | EPAER AeroDesign |
| 47 | Skyfleet | Centro Universitário ENIEC (ENIEC) | Guarulhos / SP | Skyforce |
| 48 | IMA Aerodesign | Instituto Mário de Tecnologia (IMA) | São Caetano do Sul / SP | IMT Aerodesign |
| 49 | AeroSerra | Universidade da Serra Gaúcha (USG) | Caxias do Sul / RS | AeroSul |
| 50 | AURA CAELIQUE GENEROSA | Centro Universitário ETAP (ETAP) | São José dos Campos / SP | AURA TERRAQUE GENEROSA |
| 51 | Arribaçã Aeromec Aerodesign | Universidade Federal Cearense – Fortaleza (UFCe) | Fortaleza / CE | Avoante Aeromec Aerodesign |
| 52 | FAMA Aerodesign | Instituto Federal Capixaba – São Mateus (IFCap) | São Mateus / ES | FAM Aerodesign |
| 53 | Borboremasas Aerodesign | Universidade Federal da Borborema (UFBor) | Campina Grande / PB | Parahyasas Aerodesing |
| 54 | Japiim AeroDesign | Universidade Federal Amazônica do Pará (UFAmP) | Belém / PA | Uirapuru AeroDesign |
| 55 | White Stork | Politechnika Wielkopolska (fictícia) | Poznań / Polônia | White Eagle |
| 56 | Maritaca Aerodesign | Instituto Federal Cearense – Maracanaú (IFCe) | Maracanaú / CE | Maracanã Aerodesign |
| 57 | AeroInspire | Inspire – Instituto de Ensino Superior | São Paulo / SP | AeroInsper |
| 58 | SuzanAERO | Instituto Federal Paulista – Suzano (IFP) | Suzano / SP | ItaquAERO |
| 59 | Quetzalcóatl AeroDesign | Instituto Politécnico Mexicano – Ticomán (IPM) | Cidade do México / México | Kukulcán AeroDesign |
| 60 | IVoa AeroDesign | Instituto Federal da Zona da Mata Mineira – Juiz de Fora (IFZM) | Juiz de Fora / MG | IFly AeroDesign |
| 61 | Ararajubas AeroDesign | Universidade Federal Sergipana (UFSe) | Aracaju / SE | Araras AeroDesign |

Cidades de alguns campi foram inferidas pelo nome da instituição real (ex.: FEI em São Bernardo do Campo, Instituto Mauá em São Caetano do Sul, ENIAC em Guarulhos, ETEP em São José dos Campos). Ajustar se estiver errado.
