# Fase 9: contrato e regras

Parte do [núcleo da arquitetura](../architecture.md). Nasce do playtest da Fase 8 (02/11/2026).

Escopo: **seletiva imersiva**, um funil de cerca de 6 semanas em que inscrito não é membro e a informação chega aos poucos. **Fora:** lado business, mapa da cidade e árvore do orientador (Fase 10), balanceamento (por último).

`GameState.version` = **10** (entra `selection: SelectionCampaign | null`; candidato vira inscrito com etapas). Saves de versão diferente são descartados.

## Decisões do Henrique

- **Inscrito é diferente de membro.** O jogo mostra a multidão afinando a cada etapa.
- **O número de inscritos é grande:** dezenas, não unidades.
- **Um processo seletivo dura cerca de 1 mês e meio.**
- A seleção tem de ser imersiva: informação incompleta, escolhas com custo e surpresas depois.

## O funil

| Etapa | Duração (**[PROPOSTA]**, em `BALANCE`) | Números no Ano 1 | O que o jogador vê |
|---|---|---|---|
| 1. Divulgação e abertura | ~1 semana, tarefa com gente | — | — |
| 2. Inscrições abertas | ~3 semanas, espera no calendário (ninguém ocupado) | **40–120 inscritos**, conforme alcance, época e formato | Formulário: nome, curso, período e uma frase "por que quero entrar" |
| 3. Palestra de apresentação | 1 noite | ~80% comparecem (70% a 90% pela motivação; cai um pouco perto de provas); quem falta sai | Presença |
| 4. Dinâmica (evento da Fase 7) | 1 dia | Grupos de 5–6; o jogador acompanha só alguns | Anotações dos grupos observados |
| 5. Entrevistas | ~1 semana, tarefa com gente (capitães) | Horas por entrevista; dá para ~15–20 | Respostas às perguntas escolhidas |
| 6. Aprovação | 1 dia | O jogador define as vagas de trainee | Lista final; aprovados recebem e-mail |
| 7. Trainee (já existe) | dez–jan | 30–50% desistem | Progresso do treinamento |

Contagem esperada num Ano 1 bem divulgado: ~90 inscritos → ~72 na palestra → ~30 na dinâmica → ~16 entrevistados → ~10 trainees → ~6 membros.

## Status

| Item | Estado |
|---|---|
| S1 campanha e inscritos (`SelectionCampaign`, `Applicant`, `applicantView`, `open-selection`, `tag-applicant`) | **feito** (branch de Simulação; falta revisão do Henrique e merge) |
| S2 palestra com faltas | **feito** |
| S3 dinâmica em grupos de 5–6, grupos acompanhados, `advance-applicants` | **feito** |
| S4 entrevistas (`schedule-interviews`, `set-interview-questions`, `content/interviewQuestions.ts`) | **feito** |
| S5 aprovação (`approve-applicants`), janelas de novembro e março | **feito** |
| C1 palestra e dinâmica cheias (Cenas) | outra frente |
| U1–U4 UI | pendente (há só um painel provisório na aba Seletiva da Equipe) |

### Como ficou (Simulação)

- **Estado:** `GameState.selection: SelectionCampaign | null` e `version` 10. Etapas da campanha: `promotion` · `open` · `lecture` · `dynamic` · `shortlist` · `interview` · `interviewing` · `decision`. Datas na campanha (`openedAt`, `closesAt`, `lectureAt`, `dynamicDayAt`); `vacancies` fica `null` (as vagas são quantos o jogador aprova).
- **Leitura da UI:** `applicantView(state, id)`, `applicantViews(state)` (só o revelado), `selectionView(state)` (etapa, funil, próxima data, tetos), `funnelCounts`, `interviewQuestionList`. O perfil escondido (`Applicant.profile`) nunca sai da simulação.
- **Comandos:** `open-selection { format, memberIds }`, `tag-applicant { applicantId, tag }` (`null` limpa), `advance-applicants { ids }`, `schedule-interviews { applicantIds, memberIds }`, `set-interview-questions { applicantId, questionIds }`, `approve-applicants { ids }`. Saíram `hire-candidate`, `dismiss-candidates`, a ação `recruitment`, `Candidate`, `GameState.candidates` (veja o desvio) e `GameState.selectionDay`.
- **Tarefas:** a ação `selection-open` (30 h-pessoa, soma alcance enquanto anda; ao terminar ou ser encerrada abre as inscrições) e `selection-interviews` (`internal`, só por `schedule-interviews`; horas = entrevistas × 1,5 h × 2 entrevistadores; uma entrevista entregue por vez).
- **Números** em `BALANCE.selection` e `BALANCE.selectionDay` (**[PROPOSTA]**): inscrições 21 dias, palestra 2 dias depois (19h), dinâmica 3 dias depois (9h), teto de 36 convidados (10% faltam), 2 grupos acompanhados, até 24 para a entrevista, até 20 aprovados, ruído das respostas ±18 pontos (reduz até 55% com comunicação 100).
- **Resultado medido** (seed 7, novembro, alcance 25, formato ampla): 86 inscritos → 64 na palestra → 34 na dinâmica → 16 entrevistados → 10 trainees, em 44 dias (6,3 semanas) da divulgação à aprovação.

### Desvios do contrato

- `GameState.candidates` continua existindo, **deprecado**, como espelho `{ id, name, look }` dos participantes da dinâmica: `src/scenes/event/source.ts` ainda lê `state.candidates` e a frente de Cenas está fora do escopo desta. Fica vazio fora do evento. **Remover quando a C1 passar a ler `state.selection`.**
- `SelectionDayContext` ganhou `watchedGroupIds` e `watchDone`; `watchedGroupId` (o primeiro grupo acompanhado) continua para as cenas. `yourPick`, `followed` e `verdicts` saíram (não há mais decisão de lista no evento). O bloco "entrevistas rápidas" do evento saiu (agora são a etapa 5): o evento tem 4 blocos.
- Aprovados depois de 1/fev (campanha de março) entram como `member`, não `trainee`: a etapa trainee acaba em 1/fev.
- Nova razão de pausa `selection` (palestra aconteceu). Marco de março no calendário (`selection-march`); `SELECTION_END` saiu.
- Entrevistas: o contrato diz ~1 semana; no teste da campanha completa elas levaram ~12 dias porque caíram em dezembro/janeiro (férias de verão a 50% das horas). A duração total (6,3 semanas) fica no alvo.
- Treinamento de trainees: já escala (as 8 h-pessoa da tarefa se dividem entre mais trainees, então cada um treina menos); há teste em `tests/sim/selection.test.ts`.

## Frentes

| Frente | Itens | Depende de |
|---|---|---|
| Simulação | S1–S5 | nada |
| Cenas | C1 | tipos de S1 (stub local até o merge) |
| UI | U1–U4 | Simulação e Cenas integradas |

Ordem: Simulação e Cenas juntas; UI depois do merge.

## Simulação

Atualizar o design §5.2 (seletiva) e §8 (custos) junto.

### S1. Campanha e inscritos

- `selection: SelectionCampaign | null`: `{ id, format, stage, openedAt, closesAt, lectureAt, dynamicDayAt, applicants: Applicant[], vacancies: number | null }`. Uma campanha por vez.
- `Applicant` é leve no começo e ganha camadas: `{ id, name, course, semester, motivationText, stage: "applied" | "lecture" | "dynamic" | "interview" | "approved" | "rejected" | "absent", tag: "call" | "maybe" | "no" | null, notes: string[], revealed: {...} }`. O perfil completo (o atual `Candidate`) é sorteado na hora da inscrição e guardado **escondido**; a UI só recebe o que foi revelado, por leitura (`applicantView`).
- **Cursos:** engenharia aeronáutica (maioria) e mecânica, depois elétrica, computação e produção. Proporção em `content/`. O curso puxa levemente o conhecimento de partida e a fabricação. Gênero com `femaleShare` por curso (aeronáutica ~0,2).
- **Frase do formulário:** banco de frases por perfil escondido (empolgado, curioso, "meu primo era da equipe", "quero algo no currículo"...), com ruído: a frase dá pista e às vezes engana.
- Inscritos chegam **aos poucos** durante as inscrições (marcos diários), mais nos dias de divulgação. Total sorteado na abertura a partir do alcance, da época (março, com calouros, rende mais; novembro, menos), do formato e da reputação do orientador. Divulgação feita durante as inscrições ainda soma.
- Comandos: `open-selection { format, memberIds }` (etapa 1, tarefa com gente), `tag-applicant { applicantId, tag }`.

### S2. Palestra

- Na data, sorteia quem compareceu (chance pela motivação escondida e pela tag não importa); quem falta vira `absent`. Gera mensagem "55 de 92 vieram".

### S3. Dinâmica

- O evento `selection-day` da Fase 7 passa a usar os presentes da palestra, em grupos de 5–6 (`BALANCE`), com um limite de quantos grupos o jogador acompanha de perto. Grupos acompanhados geram anotações para todos os membros; os outros geram só uma anotação geral do grupo.
- Ao fim, quem passa para entrevista é escolha do jogador (`advance-applicants { ids }`), com um teto.

### S4. Entrevistas

- `schedule-interviews { applicantIds, memberIds }`: tarefa com gente; cada entrevista custa horas (`BALANCE`, ~1,5 h-pessoa por entrevistador).
- Para cada entrevistado o jogador escolhe até 3 perguntas de uma lista (`content/interviewQuestions.ts`): disponibilidade real, o que diz gostar, como lida com pressão, experiência prática, por que aerodesign... Cada pergunta revela um atributo com ruído; a comunicação de quem entrevista reduz o ruído.
- Comando `set-interview-questions { applicantId, questionIds }`; a revelação acontece quando a entrevista daquela pessoa é feita, aos poucos na tarefa.

### S5. Aprovação e duração

- `approve-applicants { ids }`: vagas = quantos aprovar. Cada aprovado vira `trainee` (o perfil escondido vira o `Member`; preferências reais e facilidade continuam escondidas, como na Fase 8). Mais trainees consomem mais horas de capitão no treinamento (já existe; conferir que escala).
- A campanha some ao aprovar; os não aprovados recebem e-mail (só mensagem).
- O `recruitment` atual e o convite grátis (`hire-candidate`) saem; `dismiss-candidates` sai.
- Datas padrão da temporada: campanha de novembro (Ano 1, fundação) e uma de março (calouros). Fora dessas janelas é possível abrir, com menos inscritos.

## Cenas

### C1. Palestra e dinâmica cheias

- **Palestra:** auditório do campus com a plateia de inscritos (pixel art, `scenes/people/sprite/`), um fundador no palco com slides. A ocupação da plateia reflete os presentes.
- **Dinâmica:** usa a cena da Fase 7, agora com grupos de 5–6 e mais gente na sala; os grupos acompanhados ganham destaque.

## UI

### U1. Planilha de inscritos (no Navegador)

- Site paródia de formulários no Navegador (ex.: "Formulários Goggle" ou equivalente paródia), aberto como aba quando a campanha começa.
- As respostas chegam como linhas: nome, curso, período, frase, etapa, tag. Ordenar e filtrar; marcar "chamar", "talvez" e "não" com um clique e por teclado.
- Contador no topo: inscritos, presentes, na dinâmica, entrevistados e aprovados (o funil afinando).

### U2. Funil na tela Equipe

Aba "Seletiva" na Equipe: o funil desenhado com as contagens por etapa, a data da próxima etapa e o botão da ação da etapa (abrir, avançar para entrevista, agendar entrevistas, aprovar).

### U3. Entrevistas

Lista dos chamados; para cada um, escolher até 3 perguntas e ver as respostas aparecendo conforme a tarefa anda. Ficha do inscrito acumulando tudo o que já foi revelado (formulário, presença, anotações, respostas).

### U4. Aprovação

Tela de decisão: os entrevistados com o resumo de cada um, as vagas escolhidas e o custo em horas de treinamento. Confirmação antes de enviar.

## Verificação

- `npm run check` verde em cada frente.
- No navegador, uma campanha inteira de novembro com divulgação:
  - inscritos chegando aos poucos na planilha;
  - triagem com tags;
  - palestra com faltas;
  - dinâmica acompanhando 2 grupos;
  - entrevistas com perguntas escolhidas;
  - aprovação de 10;
  - o trainee começando.
- Conferir que a campanha toda dura cerca de 6 semanas e que os números batem com o funil.
- Recarregar no meio da campanha (save).
