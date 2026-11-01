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
