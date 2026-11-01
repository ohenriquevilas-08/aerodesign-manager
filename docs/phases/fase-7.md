# Fase 7: contrato e regras

Parte do [núcleo da arquitetura](../architecture.md). Nasce do playtest da Fase 6 (01/11/2026).

Escopo: **modo evento** (dinâmica da seletiva, dia de ensaio de voo e competição como eventos imersivos de tela cheia, fora da gestão) e três correções do playtest (proporção realista de gênero, rótulo da agenda do presidente, duração das tarefas). **Fora:** arte nova dos personagens (aguarda a referência visual do Henrique), lado business, mapa da cidade, árvore do orientador e individualidade dos alunos (Fase 8), balanceamento (por último).

`GameState.version` = **8** (entra `activeEvent`; a seletiva ganha o dia da dinâmica). Saves de versão diferente são descartados.

## Decisões do Henrique

- Competição, dia da dinâmica da seletiva e ensaio de voo **não são abas**: são eventos com tela própria, imersão e começo, meio e fim, como o dia de jogo no FIFA ou no Football Manager.
- O voo continua **simulado** (sem controle). A imersão vem do cenário, do ritmo do dia e das decisões nos momentos certos.
- A equipe segue a proporção real da engenharia aeronáutica (cerca de 20% mulheres), sem diversidade forçada.

## Frentes

| Frente | Itens | Depende de |
|---|---|---|
| Simulação | S1–S5 | nada |
| Cenas | C1–C3 | tipos de S1 (nomes abaixo; stub local até o merge) |
| UI | U1–U5 | Simulação e Cenas integradas |

Ordem: Simulação e Cenas juntas; UI depois do merge.

## Status

| Item | Estado |
|---|---|
| S1 motor de eventos | **feito** (branch de Simulação; falta revisão do Henrique e merge) |
| S2 dia da dinâmica | **feito** |
| S3 dia de ensaio de voo | **feito** |
| S4 competição em vários dias | **feito** |
| S5 correções (gênero, prioridade do presidente, `taskEta`) | **feito** |
| C1–C3 Cenas | em outra frente |
| U1–U5 UI | pendente; há um painel provisório em `src/ui/ProvisionalEvent.tsx` para jogar os eventos até lá |

### Contrato como implementado (Simulação)

Tipos em `src/sim/types.ts`, leitura e comandos exportados por `src/sim/index.ts`. Nomes do contrato mantidos: `ActiveEvent`, `EventBlock`, `EventDecision`, `EventLogEntry`, `EventSummary`, comandos `enter-event`, `advance-event`, `decide-event { optionId }`, `close-event`, leitura `eventView(state)`, `taskEta(state, taskId)`, `BALANCE.people.femaleShare`.

Acréscimos ao contrato (campos novos, nada renomeado):

- `ActiveEvent` ganhou `title`, `venueId?`, `entered` (false = só a chamada), `totalDays`, `startsAtDay` (meia-noite do dia 1, horas de jogo) e `context` (dados do tipo de evento: `SelectionDayContext`, `FlightTestContext`, `CompetitionEventContext`). `day` vai de 1 a `totalDays`; `blocks` são os blocos **do dia atual** e trocam a cada dia.
- `EventDecision.options[]` ganhou `blocked?` (motivo; a opção não pode ser escolhida). `Cost.hours` nas opções são horas de trabalho do dia e cansam a equipe (`FATIGUE_PER_HOUR`).
- `EventSummary = { title, lines, points, damage, knowledge, creditsSpent }`; o resumo preenchido marca o fim do dia, e `close-event` só vale com ele.
- `EventView` (leitura): `stage` (`call` · `running` · `summary`), `dayLabel`, `blocks` com `status` (`done` · `current` · `upcoming`), `currentBlock`, `hourOfDay` (para o céu), `decision`, `log`, `summary`, `canAdvance`, `presentIds`, `lastPlayback` (seu último voo no evento, para a `FlightScene`) e `headline`.
- `GameState.selectionDay: { at, format } | null` (dia da dinâmica marcado) e `GameState.activeEvent`. `PauseReason` ganhou `"selection-day"`. `Candidate` ganhou `observations?` e `verdict?` (`strong` · `promising` · `unclear`). `MemberLook.female?`. `CompetitionState` ganhou `waivedIssues?` e `payloadDeclaredFor?`.
- Agendas: `AgendaDef` e `PresidentView` ganharam `priority`, `effect` e `text` (`priorityText` na view); `label` agora é curto e sem prefixo ("Fazer o avião voar").
- `taskEta` devolve `{ finishesAt, daysLeft, percent, workHoursLeft }` (`finishesAt` e `daysLeft` são `null` com a tarefa parada).

Regras do motor (`src/sim/events.ts`):

- A chamada abre sozinha no `step` do relógio (`loop.ts`): ensaio 3 h antes da primeira decolagem (pausa `flight-test`), dinâmica no dia seguinte à conclusão da seletiva às 9h (pausa `selection-day`), competição no marco de 22/out (pausa `competition`). Com `activeEvent` aberto, `tick` não anda e `set-speed` diferente de 0 é recusado.
- `advance-event` resolve o bloco atual; um bloco pode parar no meio (decisão pendente, ou **seu voo na competição**, para a cena tocar o replay), e o próximo `advance-event` continua dele. Eventos de vários dias trocam `blocks` e `day` ao acabar o último bloco do dia.
- O relógio da gestão acompanha a hora do bloco durante o evento (sem andar sozinho); ao fechar fica pausado (`pause.reason` = `manual`) e o resumo vai para a inbox. Tarefas, motivação e pedidos não rendem durante o evento (o dia é contado como parado).
- `dev-start-competition` abre o evento da competição (chamada, relógio em 22/out).

### Desvios do contrato

- **Competição com 4 dias no evento** (1 de chegada e inspeção + 3 de voo, `BALANCE.competition.flightDays` = 3), não "dias 2 e 3": com 2 dias de voo as 7 baterias da Tabela 10.1 não cabem (a fila da bateria 1 tem 31 equipes).
- O gatilho do ensaio é a chamada 3 h antes da primeira decolagem (5h), não às 8h, para caber a viagem e a montagem; o horário das decolagens (8h, a cada 30 min) e o agendamento não mudam. Esperar o vento atrasa as decolagens seguintes em 30 min.
- O dia da dinâmica **não adia** (a spec dizia "onde a regra permitir"; aqui nenhum evento permite adiar).
- Na seletiva os candidatos continuam sendo sorteados quando a tarefa conclui (como na Fase 6); a dinâmica é o que os revela melhor. Convidar antes da dinâmica continua possível.
- Efeitos do fechamento: ensaio (histórico, evidência, conhecimento, vídeo) e dinâmica (anotações, parecer) só entram em `close-event`; a competição aplica resultados e peças ao longo do dia (a fila precisa) e o fechamento dá a reputação do orientador e o conhecimento tácito.
- `clockPace` e a lentidão do relógio nas janelas de voo foram removidos (o evento no lugar); `inFlightWindow` continua exportado só para consulta.

## O modo evento

Um evento é um dia (ou vários) que tira o jogador da gestão:

1. **Chamada:** na data, o relógio pausa e aparece "Hoje: ensaio de voo no Aeroclube". Entrar é obrigatório. Adiar só é possível onde a regra permitir.
2. **Chegada:** vinheta curta (a equipe chega, descarrega, monta).
3. **Programação do dia:** uma linha do tempo com os blocos do dia (ex.: 8h briefing, 9h inspeção, 10h bateria 1...). O relógio do evento anda em blocos, não no relógio da gestão.
4. **Momentos de decisão:** em pontos fixos ou sorteados, um cartão com 2 ou 3 escolhas e o custo de cada uma (ex.: "O vento virou para 6 m/s de través. Voar agora / Esperar 30 min / Tirar 1 kg da carga").
5. **Fechamento:** resumo do dia (o que aconteceu, pontos, dano, conhecimento ganho, dinheiro gasto) e volta à gestão.

Enquanto o evento roda, o resto da equipe não trabalha (todos estão no evento ou o dia é contado como parado, conforme o evento).

## Simulação

### S1. Motor de eventos

- `activeEvent: ActiveEvent | null` no estado. `ActiveEvent = { id, kind: "selection-day" | "flight-test" | "competition", day, blocks: EventBlock[], blockIndex, pendingDecision: EventDecision | null, log: EventLogEntry[], summary: EventSummary | null }`.
- `EventBlock = { id, startsAt (hora do dia), label, kind }`; `EventDecision = { id, prompt, options: { id, label, cost: Cost, hint }[] }`.
- Comandos: `{ type: "enter-event" }` (aceita a chamada), `{ type: "advance-event" }` (resolve o bloco atual e vai para o próximo; recusa com decisão pendente), `{ type: "decide-event", optionId }`, `{ type: "close-event" }` (aplica o resumo ao estado da gestão e devolve o relógio).
- O relógio da gestão fica parado com `activeEvent` aberto; `tick` não avança.
- Tudo determinístico pelo `rngState`. Leitura `eventView(state)` para UI e cenas.

### S2. Dia da dinâmica da seletiva

- A seletiva passa a ter duas partes: a divulgação e a inscrição como tarefa (como hoje), e no fim um **dia da dinâmica** agendado, que vira evento.
- Blocos: recepção, apresentação da equipe, desafio prático em grupos (ex.: construir um planador de balsa), entrevistas rápidas, deliberação.
- Decisões: de que grupo você chega perto (revela mais sobre aqueles candidatos), dar ou não uma segunda chance a quem travou, e quem os capitães recomendam versus quem você acha.
- Fechamento: a lista de candidatos com o que foi observado. Convidar continua sendo `hire-candidate`.

### S3. Dia de ensaio de voo

- O ensaio agendado da Fase 5 (`schedule-flight-test`) vira evento no dia, sem mudar o agendamento.
- Blocos: viagem e chegada (risco de transporte), montagem e checagem, uma decolagem por carga planejada, desmontagem.
- Decisões: vento ou rajada antes de uma decolagem (voar, esperar, reduzir a carga), peça com folga na checagem (trocar e gastar o tempo ou voar assim) e, depois de um dano, encerrar o dia ou seguir.
- Cada decolagem usa o motor de voo atual e gera `FlightPlayback`; o fechamento alimenta `testHistory`.

### S4. Competição como evento de vários dias

- A competição atual vira um evento de vários dias: **dia 1** chegada, inspeção técnica e exposição; **dias 2 e 3** baterias de voo; **fim** placar e premiação.
- Os blocos usam a fila, o clima e os rivais que já existem. As decisões cobrem pendências da inspeção (corrigir agora com horas ou aceitar penalidade), a carga de cada bateria (`set-battery-payload` vira uma decisão do bloco) e reparo entre baterias.
- A tela Competição deixa de ser o lugar onde se joga a competição: fica só como histórico e regulamento da prova.

### S5. Correções do playtest

- **Gênero:** o sorteio de nomes e aparência segue `BALANCE.people.femaleShare` = 0,2. Vale para fundadores, candidatos e trainees. Teste com a semente fixa e a proporção numa amostra grande.
- **Agenda do presidente:** os rótulos viram prioridades com texto explicando o efeito. Ex.: `flight` → "Prioridade: fazer o avião voar · tarefas de fabricação e ensaio animam a equipe". O mesmo para `report`, `funding` e `balanced`. O texto fica no conteúdo, não na UI.
- **Duração da tarefa:** leitura `taskEta(state, taskId)` → `{ finishesAt, daysLeft, percent, workHoursLeft }`. A UI mostra o prazo e o percentual; as horas de trabalho ficam no detalhe.

## Cenas

### C1. Moldura de evento

- `scenes/event/EventStage.ts`: cena de fundo para eventos, com o cenário do local (pista do aeroclube, campus para a seletiva, pátio da competição com tendas e a pista), a hora do dia no céu e os bonecos da equipe presentes.
- Recebe `eventView` pelo store, como as outras cenas. Lógica pura (cenário por evento e bloco, posição da equipe) testada.

### C2. Dinâmica da seletiva

- Pátio ou sala do campus com os candidatos em grupos montando planadores. Destaca o grupo que você observa. Ao fim do desafio, cada grupo lança o seu planador (animação curta, distância vem pronta da simulação).

### C3. Competição e ensaio dentro da moldura

- A `FlightScene` e a `QueueScene` existentes passam a rodar dentro da moldura do evento (voo e fila no bloco certo). Inspeção técnica: bancada com fiscais olhando o avião.

## UI

### U1. Modo evento

- Tela cheia própria, fora do menu lateral: cena C1 ao fundo, linha do tempo do dia no topo, o cartão de decisão no centro quando houver, o log do dia de lado e o botão "Seguir" para avançar.
- Chamada do evento como modal que bloqueia a gestão. O fechamento é uma tela de resumo com "Voltar à equipe".

### U2. Seletiva

Fluxo da dinâmica com C2; os candidatos observados ganham anotações nas fichas.

### U3. Ensaio de voo

O dia do ensaio dentro do modo evento. A tela Ensaios fica com o agendamento e o histórico.

### U4. Competição

Os dias da competição dentro do modo evento. A tela Competição vira histórico.

### U5. Correções

O rótulo da prioridade do presidente (com o texto do efeito) na abertura, na Central e na escalação; a duração da tarefa via `taskEta` em todo lugar que hoje mostra "~1,9 d" junto de "22/32 h".

## Verificação

- `npm run check` verde em cada frente.
- No navegador:
  - Seletiva com o dia da dinâmica, incluindo uma decisão e o resumo.
  - Ensaio de voo do agendamento até o fechamento, com uma decisão de vento.
  - Competição pelos dias, com uma pendência de inspeção e a carga decidida na bateria.
  - Recarregar a página no meio de um evento (save).
  - Novo jogo com fundadores na proporção certa.
  - A prioridade do presidente legível e a duração da tarefa sem confusão.
