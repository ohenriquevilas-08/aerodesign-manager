# Arquitetura

Contrato técnico do Aerodesign Manager. Todo agente ou sessão que trabalhar no repositório lê este arquivo e o [design do Ano 1](design/ano-1.md) antes de escrever código.

## Stack

TypeScript + Vite · Preact (painéis) · Phaser 4 (cenas) · Vitest (testes) · GitHub Pages (deploy). Feito para notebook (mínimo 1280 px de largura); não há layout de celular.

## Camadas

```
src/
  sim/       regras do jogo: puro, sem DOM, sem Preact, sem Phaser, 100% testável
    types.ts       contrato de dados (GameState e afins)
    commands.ts    Command + applyCommand: a única forma de mudar o estado
    time.ts        relógio contínuo, calendário, contagem regressiva
    scoring.ts     fórmulas da Classe Regular 2026
    state.ts       estado inicial do Ano 1
    rng.ts         aleatoriedade com estado serializável
    content/       dados: regulamento, calendário, equipes, catálogo de ações
    index.ts       API pública; o resto do app importa só daqui
  app/       cola entre sim e apresentação
    store.ts       store único, dispatch de comandos, loop do relógio
    useGame.ts     hook Preact para ler fatias do estado
  ui/        painéis Preact (telas do design §11)
  scenes/    cenas Phaser (hangar, ensaios, competição)
  styles/    tokens.css (cores, fontes, espaços) + app.css
tests/       espelha src/ (tests/sim/...)
scripts/     geradores (ex.: generate_teams.py)
```

### Regras de dependência

| Camada | Pode importar | Não pode importar |
|---|---|---|
| `sim/` | só `sim/` | `app/`, `ui/`, `scenes/`, DOM, `Math.random`, `Date.now` |
| `app/` | `sim/` (via `sim/index.ts`) | `ui/`, `scenes/` |
| `ui/` | `app/`, `sim/index.ts`, `scenes/` (para montar cenas) | arquivos internos de `sim/` |
| `scenes/` | `app/store` (tipo), `sim/index.ts`, `scenes/palette.ts` | `ui/` |

### Fluxo de dados

```
teclado/mouse ──► ui/ ou scenes/ ──dispatch(Command)──► store ──applyCommand──► novo GameState
                                                             │
                                  subscribe/getState ◄───────┘
```

- **Estado só muda por comando.** UI e cenas nunca alteram objetos do estado; chamam `store.dispatch(...)`.
- **`applyCommand` é puro.** Mesmo estado + mesmo comando = mesmo resultado. Aleatoriedade usa `rngState` do estado.
- **O relógio é um comando** (`tick`), disparado por `startClock` a cada quadro. Velocidade 0 = pausado.
- **Cenas espelham o relógio:** `HangarScene` pausa e acelera tweens e timers junto com `clock.speed`.

## Cenas

As cenas Phaser só animam; nunca decidem regra nem mudam o estado. O que elas mostram chega pronto.

### Voo da competição: `FlightPlayback`

Tipo em `src/sim/types.ts` (reexportado por `src/scenes/flight/playback.ts`). Descreve uma bateria **já resolvida** pela simulação; a `FlightScene` só toca o replay. A simulação produz este objeto (serializável, sem Phaser):

| Campo | Significado |
|---|---|
| `battery`, `teamName` | Número da bateria e nome da equipe (cabeçalho) |
| `payloadKg` | Carga embarcada |
| `densityAltitudeM` | Altitude densidade do momento (Apêndice 4) |
| `headwindMs` | Vento: + de proa, − de cauda (biruta e nuvens) |
| `rotationDistanceM` | Onde a roda sai do chão; `null` se não decolou |
| `obstacleClearanceM` | Folga sobre o topo do obstáculo de 0,9 m aos 55 m; negativa = rompeu a fita; `null` se não chegou voando |
| `outcome` | `valid` · `no-takeoff` · `tape-break` · `landing-out` · `damage` · `crash` |
| `stopDistanceM` | Distância de parada desde o toque; `null` sem pouso |
| `unloadTimeS` | Tempo da retirada rápida de carga; `null` se não houve |
| `crashPhase?` | Onde cai (`climb`, `circuit`, `approach`); só para `crash` |
| `damagedParts?` | Rótulos das peças afetadas, para o cartão final |

Coerência esperada da simulação: `no-takeoff` → rotação, folga, parada e retirada `null`; `tape-break` → folga < 0; `crash` → sem parada nem retirada.

- `script.ts` (puro, testado em `tests/scenes/`) converte o playback em poses e eventos. A cena posiciona a cabeceira para o desfecho ficar legível (parada dentro ou fora); não interpreta distâncias.
- Entrega à cena: `flightReplay.play(playback)` (`src/scenes/flight/replayChannel.ts`). Na Fase 3 as baterias ficam em `GameState.competition.results[].playback`.
- O replay tem velocidade própria (`flightReplay.setSpeed`), independente de `clock.speed`.
- Em dev, a tela Competição tem um painel que toca cada desfecho com `MOCK_PLAYBACKS`, e `window.__flightScene.seek(t)` pula o replay.

### Hangar: `BenchView`

Definido em `src/scenes/hangar/benchView.ts` (funções puras, testadas em `tests/scenes/benchView.test.ts`). Cada bancada (asa, fuselagem, eletrônica, relatório) mostra uma tarefa com barra de progresso e as peças com estado (design §7.2).

- `benchForTask(state, task)`: relatório para `report-chapter` e `document`; peça fabricada ou comprada pelo `effect.part` do catálogo; reparo pela peça alvo; por último o nome da ação (`wing` → asa; `fuselage`/`gear`/`tail` → fuselagem; `motor`/`servo`/`electronic` → eletrônica). O resto (estudo, rifa, divulgação, voos) não aparece em bancada.
- `PART_BENCH`: asa → asa; fuselagem, empenagem e trem → fuselagem; motor e eletrônica → eletrônica.
- `benchViewsFromState(state)`: por bancada, a primeira tarefa ativa (senão a primeira esperando) e quantas outras há (`queued`); até 4 peças e o resto em `moreParts`. Progresso = `hoursDone / hoursTotal`; na espera ⌛, tempo passado sobre o prazo **prometido**, travado em 99% (o `readyAt` real não vaza).
- `aircraftViewFromState(state)`: o avião no cavalete usa a melhor peça de cada `PartType` (maior condição, depois qualidade); `null` se não existe. A cena pinta danificada em amarelo e quebrada em vermelho.
- `workerViewsFromState(state)`: cada integrante vai para a bancada da tarefa em que está em `assignees`; trabalha se a tarefa está ativa, fica de pé se ela espera prazo. Presidente, quem está sem tarefa ou numa tarefa fora do hangar fica na área livre, na frente. Quem entra na equipe aparece; quem sai some.

## Convenções

- Identificadores, arquivos e commits em inglês; textos do jogo e comentários em PT-BR.
- Cores só via `tokens.css` (UI) ou `scenes/palette.ts` (Phaser). Os dois devem continuar espelhados.
- Custos de ações sempre como `Cost { hours, credits, leadDays, risk }` e exibidos nessa ordem (design §8).
- Toda fórmula do regulamento cita a seção ou equação no comentário e tem teste.
- `useGame` deve selecionar valores pequenos (números, strings ou objetos que mudam pouco): o relógio dispara atualizações a cada quadro.
- Save: ainda não existe. Quando existir, `GameState.version` sobe a cada mudança incompatível e saves antigos são descartados durante o protótipo (sem migrações).

## Fase 2: frentes de trabalho em paralelo

Cada frente mexe só nas suas pastas. Mudança em `sim/types.ts` ou `sim/commands.ts` é mudança de contrato: avisa o coordenador antes.

| Frente | Pastas | Entrega |
|---|---|---|
| Simulação | `src/sim/`, `tests/sim/` | Equipe e horas, tarefas, peças e ensaios, relatório, rivais, competição |
| Interface | `src/ui/`, `src/styles/` | Telas Equipe, Prancheta, Relatório, Finanças, Regulamento |
| Cenas | `src/scenes/` | Hangar completo, ensaios, competição (voo e fila) |
| QA | só leitura | Roda testes, joga o Ano 1 no navegador, reporta bugs |

## Simulação: loop de preparação (contrato para a UI)

`GameState.version` = **2**. Arquivos: `sim/loop.ts` (tick), `sim/tasks.ts` (tarefas e efeitos), `sim/team.ts` (horas, motivação, conhecimento), `sim/parts.ts`, `sim/selection.ts`, `sim/crew.ts` (equipe por tarefa e duração), `sim/outcome.ts` (rendimento). Números de balanceamento em `sim/content/balance.ts` (`BALANCE`) e `sim/content/selection.ts`.

### Comandos

| Comando | Efeito | Recusa (gera `warning`) |
|---|---|---|
| `{ type: "tick", realSeconds }` | Avança o relógio em passos de até 1 h de jogo: esperas ⌛, horas da equipe, motivação, conclusões, calendário. Para no passo de um evento que pausa. | — |
| `{ type: "set-speed", speed }` | Muda a velocidade. `0` grava `pause = { reason: "manual" }`; qualquer outra limpa `pause`. | — |
| `{ type: "read-message", id }` | Marca mensagem como lida. | — |
| `{ type: "start-action", actionId, targetId?, dedication? }` | Debita ◆ e consome estoque na hora; cria `Task`. Com `leadDays > 0` nasce `waiting` até `readyAt` (sorteado; ver Regras); senão `active`. Sem horas e sem prazo conclui na hora (sem pausar). | Ação desconhecida, alvo inválido, falta estoque, caixa insuficiente |
| `{ type: "assign-member", memberId, taskId }` | Aloca (tira da tarefa anterior). Pode alocar em tarefa `waiting`: a pessoa espera sem trabalhar. | Presidente (`canWork` falso), tarefa concluída/inexistente, tarefa sem horas (compra), equipe já no `crew.max` |
| `{ type: "unassign-member", memberId }` | Libera o integrante. | — |
| `{ type: "cancel-task", taskId }` | Remove a tarefa e libera quem estava nela. ◆ e material **não** voltam. | Tarefa concluída/inexistente |
| `{ type: "hire-candidate", candidateId }` | Convite gratuito: candidato vira `Member` (`role: "member"`). | Candidato inexistente |
| `{ type: "dismiss-candidates" }` | Descarta os candidatos restantes. | — |

`targetId` por ação (`ActionDef.target`): `document` → disciplina (`"aerodynamics"` etc.); `recruitment` → formato da seletiva (`SELECTION_FORMATS`: `broad`, `technical`, `referral`, `challenge`); `repair-part` → id da peça; `express-shipping` → id de tarefa `waiting` que ainda não chegou.

### Campos novos

- `GameState.pause: PauseInfo | null`: não nulo enquanto pausado. `reason`: `"start" | "manual" | "task-done" | "deadline-soon" | "deadline-passed"`; `messageId` aponta para a mensagem da inbox que causou a pausa automática.
- `GameState.warning: { id, at, text } | null`: último comando recusado. Mostrar quando `id` mudar (o estado não tem "dispensar aviso").
- `GameState.stock: Record<string, number>` (consumíveis, ex.: `balsa`) e `GameState.equipment: string[]` (ex.: `"scale"`).
- `GameState.candidates: Candidate[]`: candidatos da seletiva, com `focus`, atributos e `opinion` (parecer de capitão, PT-BR).
- `GameState.nextId`: contador interno para ids (`task-N`, `part-N`, `msg-N`, `cand-N`, `member-N`).
- `Member.communication` (0–100, também em `Candidate`): habilidade de captação (rifa, patrocínio) e seletiva.
- `Member.workStreakHours`: horas seguidas em tarefa ativa (sobrecarga acima de `BALANCE.motivation.overloadAfterHours`).
- `Task.dedication`: `"rush" | "normal" | "careful"`, escolhida no `start-action` (padrão `"normal"`; compras sempre `"normal"`).
- `Task.expectedReadyAt`: data **prometida** (prazo nominal do catálogo), a que a UI mostra. `Task.readyAt` é a data real sorteada e não deve ser exibida.
- `GameState.outreach`: alcance de divulgação acumulado. Sobe com as ações `outreach-*`, decai `BALANCE.outreach.decayPerDay` (3%) por dia e é zerado quando uma seletiva termina.
- `Task.contributions` (horas por integrante), `Task.targetId`, `Task.doneAt`. Tarefas concluídas ficam em `tasks` com `status: "done"` e `assignees: []` (histórico).
- `ActionDef.crew: { min, ideal, max }`: pessoas por tarefa. Abaixo de `min` não avança; acima de `ideal` cada pessoa extra (as de menor rendimento) rende `BALANCE.crew.extraEfficiency` (0,5); `max` é o teto do `assign-member`. Compras: `{ 0, 0, 0 }`.
- `ActionDef.skill`: `"fabrication" | "agility" | "piloting" | "communication" | "knowledge"`. `knowledge` usa a disciplina da ação, ou a escolhida no alvo (`document`).
- `ActionDef.effect`, `ActionDef.requires` (estoque consumido ao iniciar; `build-wing` exige 1 balsa), `ActionDef.target`.

### Regras

- O presidente é o jogador e não faz trabalho operacional: `canWork(member)` = `role !== "president"`. Ele continua em `members` (a tela Equipe mostra o card), mas `memberHoursPerDay` dá 0, `hoursPerDay` inicial é 0, `assign-member` recusa e a motivação e `workStreakHours` dele não mudam com o relógio.
- Horas/dia de um integrante = `hoursPerDay × academicFactor × motivationFactor(motivation)` (`memberHoursPerDay`). `motivationFactor` vai de 0,5 (motivação 0) a 1 (100).
- Estimativas para a UI (assumem motivação constante e seguem o calendário acadêmico): `estimateTaskDays(state, actionId, memberIds)` = dias de prazo ⌛ + trabalho se iniciar agora com essas pessoas; `estimateRemainingDays(state, taskId)` = o que falta com quem está alocado. Ambas devolvem `null` quando a tarefa não anda (ninguém, ou abaixo do `crew.min`). `crewRates(members, crew, date)` dá o rendimento por pessoa.
- **Rendimento** (`sim/outcome.ts`): qualidade da equipe = habilidade da ação × `motivationFactor`, média ponderada pelas horas de cada um (`Task.contributions`; na estimativa, o rendimento de hoje). Multiplicador = curva linear de 0,5 (qualidade 0) a 1,5 (100), com variação ± que vai de 40% (qualidade 0) a 0% (100), sorteada com `rngState` na conclusão. Afeta: rifa (◆ base 500), patrocínio (chance de 30% a 90% pela qualidade, e valor base 800 × multiplicador), peça fabricada (qualidade = 60 × multiplicador + equipamento), reparo (condição base 30) e documentar (fração convertida). Números em `BALANCE.outcome`.
- `estimateOutcome(state, actionId, memberIds, targetId?)` → `{ quality, min, expected, max, chance?, text } | null`. `text` vem pronto para o cartão (ex.: `"◆ 310–520"`, `"Qualidade 38–51"`, `"62% de chance de ◆ 600–900"`, `"Acervo de Aerodinâmica +8–12"`). `null` quando a ação não tem resultado variável, a equipe não faz a tarefa andar ou falta o `targetId` (em `document`).
- **Dedicação** (`DEDICATIONS`, em `content/dedication.ts`): `{ id, label, hoursFactor, qualityBonus }`.
  - Rápido: 0,6× horas, −15 de qualidade.
  - Normal: 1×, 0.
  - Caprichado: 1,6× horas, +15 de qualidade.
  - `hoursTotal` já sai multiplicado. O bônus entra na qualidade da equipe (limitada a 0–100) na conclusão.
  - Mais horas também ensinam mais a quem trabalha.
  - `estimateTaskDays(state, actionId, memberIds, dedication?)` e `estimateOutcome(state, actionId, memberIds, targetId?, dedication?)` aceitam a dedicação para comparar as opções.
- **Nada é garantido antes de acontecer.**
  - Prazos ⌛: o real é prometido × fator sorteado entre `BALANCE.lead.minFactor` e `maxFactor` (0,8 a 1,4). `leadDaysRange(actionId)` → `{ min, promised, max }` em dias, para o cartão mostrar "⌛ 8–14 d".
  - `estimateTaskDays` e `estimateRemainingDays` usam o prazo prometido.
  - Patrocínio: chance e valor (já eram faixa).
  - Seletiva: número de inscritos sorteado.
- **Divulgação e seletiva.** Ações só de horas, habilidade comunicação, com alcance base × multiplicador de rendimento:
  - `outreach-posters` (2 h, 1 pessoa, alcance 4);
  - `outreach-social` (1 h, 1 pessoa, alcance 2);
  - `outreach-classroom` (3 h, 1–2 pessoas, alcance 6);
  - `outreach-freshers` (6 h, 2–3 pessoas, alcance 12).
  - Inscritos esperados = `baseApplicants + applicantsPerReach × outreach` do formato (`SELECTION_FORMATS`; o campo fixo `candidates` saiu). Esse número vai × multiplicador de rendimento de quem conduz × incerteza ±30% (`BALANCE.outreach.applicantSpread`).
  - Com zero de alcance, a ampla rende 0–2 pessoas. Por indicação não depende de alcance.
  - `estimateOutcome(state, "recruitment", ids, formato)` → `"Inscritos estimados 3–9"`, com o alcance de agora. O alcance ainda esfria durante a seletiva, então o resultado tende ao lado baixo da faixa.
  - `estimateOutcome` das ações `outreach-*` → `"Alcance +3–5"`.
- Ainda sem rendimento variável: estudo e treino (o ganho é por pessoa, pelas horas), capítulo do relatório (não há relatório ainda), voos.
- Motivação cai `idleDecayPerDay` por dia sem tarefa e `overloadDecayPerDay` quando sobrecarregado; sobe `completionBoost` para quem está na tarefa ao concluir. Quem está alocado em tarefa `waiting` não perde motivação e descansa a sequência.
- Conhecimento: ações com `discipline` ensinam quem trabalhou, proporcional às horas, com retorno decrescente. `effectiveKnowledge(member, documented, d)` = máximo entre tácito e documentado.
- Peças: `partState(condition)` → `new` (80–100), `worn` (50–79), `damaged` (20–49), `broken` (0–19); rótulos em `PART_STATE_LABELS`.
- Inbox: mensagens novas vão para o **fim** do array (ordem cronológica). Eventos que pausam: tarefa concluída pelo relógio, marco `deadline`/`event` a 7 dias, e qualquer marco do `OFFICIAL_CALENDAR` no dia.
- O store não precisou mudar: `togglePause` retoma na última velocidade escolhida também depois de pausa automática.

## Fase 3: contrato (avião, relatório, lojas, competição)

`GameState.version` = **3**. Tipos em `sim/types.ts`; cada assunto tem um módulo dono. O que está marcado **stub** existe com a assinatura final, mas devolve `null`, `[]` ou um `warning` "ainda não disponível" até a frente de Simulação implementar. UI e cenas programam contra a assinatura e mostram "—" ou estado vazio enquanto isso.

### Campos novos no `GameState`

| Campo | Tipo | Dono |
|---|---|---|
| `aircraft` | `Aircraft \| null`: `design` (b, N, P, filosofia, material, trem), `hidden` (desvios reais, **nunca mostrar**), `lateChanges` | `sim/aircraft.ts` |
| `report` | `ReportState`: horas e ensaios citados por capítulo, horas de plantas, rascunho das previsões (peso vazio, `PayloadLine`), `submittedAt`, `score` (NR), `oralScore` | `sim/report.ts` |
| `orders` | `Order[]`: loja, itens, frete, `expectedAt` (prometido, mostrar), `arrivesAt` (real, **não mostrar**), status, imposto devido | `sim/shop.ts` |
| `shops` | `ShopsState`: estoque e promoções por anúncio (`listingId(shopId, productId)`) | `sim/shop.ts` |
| `competition` | `CompetitionState \| null`: fase, bateria, fila, carga planejada, clima da pista, resultados (`BatteryResult` com `points` e `playback`), notas de projeto, penalidades, pendências da inspeção | `sim/competition.ts` |

`FlightPlayback`, `FlightOutcome` e `CrashPhase` agora moram em `sim/types.ts` (a simulação produz); `scenes/flight/playback.ts` reexporta e continua dono de `FLIGHT_RULES` e `OUTCOME_LABEL`. A sua equipe aparece nas filas e resultados como `PLAYER_TEAM_ID` (`"player"`).

### Comandos novos

| Comando | Efeito | Estado |
|---|---|---|
| `{ type: "set-design", design }` | Grava o projeto da prancheta. No primeiro, sorteia `aircraft.hidden`. Recusa envergadura ou potência fora de `DESIGN_LIMITS` | pronto (desvio provisório ±10%) |
| `{ type: "set-predictions", emptyWeightKg?, payloadLine? }` | Rascunho das previsões. Recusa depois do envio | pronto |
| `{ type: "submit-report" }` | Congela previsões e sorteia NR. Também automático em 16/ago (com penalidade até 23/ago) | stub |
| `{ type: "place-order", shopId, lines, shipping }` | Checkout: debita ◆ (itens + frete), baixa estoque, cria `Order`. Recusa sem estoque, frete indisponível ou sem caixa | stub |
| `{ type: "pay-customs", orderId }` | Paga o imposto de pedido retido; ele volta a andar | stub |
| `{ type: "set-battery-payload", payloadKg }` | Carga da próxima decolagem. Recusa com menos de `MIN_TEAMS_AHEAD_TO_REVISE` (3) equipes à frente, R[10.1.5.3] | stub |
| `{ type: "dev-start-competition" }` | Só em dev: pula para o dia da competição com equipe, avião, relatório e previsões prontos | stub |

### Leituras para UI e cenas

| Função | Devolve | Estado |
|---|---|---|
| `estimatePerformance(state, Hρ)` | `PerformanceEstimate`: peso vazio, carga máxima, EE e corrida de decolagem, cada um `{ value, margin }` | stub |
| `estimateReportScore(state)` | NR esperada `{ value, margin }` | stub |
| `listingPrice` / `listingStock` | Preço da vitrine (com promoção) / unidades (`null` = sem limite) | pronto |
| `currentDensityAltitude(state)` | Hρ da pista agora (Apêndice 4) | pronto |
| `teamsAhead(state)` | Equipes à sua frente na fila | stub |
| `standings(state)` | `Standing[]` ordenado: melhor bateria + BCF + projeto − penalidades | stub |

Catálogo das lojas em `sim/content/shops.ts` (design §8.4): `SHOPS` (frete normal e expresso por loja, taxa de imposto), `PRODUCTS` (o que cada produto vira ao chegar: peça, estoque ou equipamento) e `LISTINGS` (preço, prazo prometido, qualidade de origem, chance de taxação e de falsificação, condição de usado, estoque inicial, avaliações). Novos consumíveis: `balsa-light`, `balsa` (média), `balsa-hard`, `carbon-fiber`, `resin`; novo equipamento: `thrust-stand`.

### Regras que a Simulação precisa respeitar

- **Avião:** o desempenho real sai do projeto × `hidden` × peças. A margem de `estimatePerformance` encolhe com conhecimento (Aerodinâmica e Desempenho → carga; Estruturas → peso vazio) e, mais, com ensaios. Coerência: com margem zero, a estimativa é o real.
- **Lojas:** prazo real sorteado a partir da faixa prometida (pode passar do máximo, como `BALANCE.lead`); expresso multiplica pelo `leadFactor` da loja. Importado pode ficar `held-customs` (inbox pede o imposto e pausa). Na entrega: peça com qualidade sorteada pela loja (usado: condição sorteada), estoque ou equipamento; falsificado marca a peça e reprova na inspeção (§9.2). As ações `buy-*` e `express-shipping` saem do catálogo quando o checkout estiver pronto.
- **Competição:** começa sozinha no marco `competition` do calendário. O clima segue o relógio (manhã fria, tarde quente); as rivais voam pelas mesmas fórmulas de `scoring.ts`, a partir de um avião gerado pelo arquétipo; classificação para a 4ª bateria em diante pela Tabela 10.1 (`REGULAR_2026.batteryCutoffs`). Cada voo seu vira `BatteryResult` com `playback` coerente com o contrato da cena; voo seu pausa o relógio para o replay.

## Fase 3: frentes de trabalho em paralelo

| Frente | Pastas | Entrega |
|---|---|---|
| Simulação | `src/sim/`, `tests/sim/` | Modelo de desempenho e estimativas, relatório e envio, checkout e entregas, competição (fila, clima, rivais, baterias, placar), `dev-start-competition` |
| Interface | `src/ui/`, `src/styles/` | Prancheta gravando o projeto, tela Relatório (capítulos, previsões, reta de carga), Navegador (abas por loja com identidade própria, carrinho, checkout, rastreio), painel da Competição (fila, Hρ ao vivo, escolha de carga com margem, placar) |
| Cenas | `src/scenes/` | Hangar lendo tarefas e peças reais (e pacotes chegando), `FlightScene` tocando os `BatteryResult` do store, cena da fila |

Mudança em `sim/types.ts` ou `sim/commands.ts` continua sendo mudança de contrato: avisa o coordenador antes.

## Comandos

```bash
npm install
npm run dev        # http://localhost:5173
npm test
npm run typecheck
npm run build      # gera dist/ com base /aerodesign-manager/
```
