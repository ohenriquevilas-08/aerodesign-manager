# Fase 3: contrato e regras

Parte do [núcleo da arquitetura](../architecture.md).

## contrato (avião, relatório, lojas, competição)

`GameState.version` = **3**. Tipos em `sim/types.ts`; cada assunto tem um módulo dono. Todos os itens abaixo estão **prontos** (Fase 3, frente de Simulação).

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
| `{ type: "set-design", design }` | Grava o projeto da prancheta. No primeiro, sorteia `aircraft.hidden` (material e filosofia). Mudar depois mantém `hidden`, perde metade dos ensaios e, depois de 27/set, soma `lateChanges`. Recusa envergadura ou potência fora de `DESIGN_LIMITS` | pronto |
| `{ type: "set-predictions", emptyWeightKg?, payloadLine? }` | Rascunho das previsões. Recusa depois do envio | pronto |
| `{ type: "submit-report" }` | Congela previsões e sorteia NR. Automático em 16/ago se as previsões estão completas; senão, manual com penalidade até 23/ago, quando é forçado. Recusa depois de enviado ou de 23/ago | pronto |
| `{ type: "place-order", shopId, lines, shipping }` | Checkout: debita ◆ (itens + frete), baixa estoque, cria `Order`. Recusa sem estoque, frete indisponível, produto que a loja não vende, carrinho vazio ou sem caixa | pronto |
| `{ type: "pay-customs", orderId }` | Paga o imposto de pedido retido; ele volta a andar (liberação de 2–5 dias). Grava `customsPaid` | pronto |
| `{ type: "set-battery-payload", payloadKg }` | Carga da próxima decolagem (fica valendo nas seguintes). Recusa com menos de `MIN_TEAMS_AHEAD_TO_REVISE` (3) equipes à frente, R[10.1.5.3], ou fora de 0–20 kg. Sem escolha, voa com a reta de previsão | pronto |
| `{ type: "dev-start-competition" }` | Só em dev: equipe, avião completo, vídeo, relatório enviado e oral prontos; relógio pausado 15 min antes da primeira decolagem | pronto |

### Leituras para UI e cenas

| Função | Devolve | Estado |
|---|---|---|
| `estimatePerformance(state, Hρ)` | `PerformanceEstimate`: peso vazio, carga máxima (sustentação), EE e corrida até a rotação com essa carga, cada um `{ value, margin }`. Corrida acima de ~47 m = não passa a fita | pronto |
| `estimateReportScore(state)` | NR esperada `{ value, margin }` (com a penalidade se enviar agora); depois do envio, a nota com margem 0 | pronto |
| `listingPrice` / `listingStock` | Preço da vitrine (com promoção) / unidades (`null` = sem limite) | pronto |
| `currentDensityAltitude(state)` | Hρ da pista agora (Apêndice 4) | pronto |
| `installedParts(state)` / `missingParts(state)` / `PART_TYPE_LABELS` | Peça em uso por tipo (melhor condição não quebrada) / o que falta para voar | pronto |
| `inspectionIssues(state)` / `COMPETITION_START` | Pendências da inspeção (§9.2) / início da competição (horas de jogo) | pronto |
| `teamsAhead(state)` | Equipes à sua frente na fila; `null` fora da fila ou depois de voar na bateria | pronto |
| `standings(state)` | `Standing[]` ordenado: melhor bateria + BCF + projeto − penalidades | pronto |

Catálogo das lojas em `sim/content/shops.ts` (design §8.4): `SHOPS` (frete normal e expresso por loja, taxa de imposto), `PRODUCTS` (o que cada produto vira ao chegar: peça, estoque ou equipamento) e `LISTINGS` (preço, prazo prometido, qualidade de origem, chance de taxação e de falsificação, condição de usado, estoque inicial, avaliações). Novos consumíveis: `balsa-light`, `balsa` (média), `balsa-hard`, `carbon-fiber`, `resin`; novo equipamento: `thrust-stand`.

### Motivos de pausa novos (`PauseReason`)

| Motivo | Quando | `messageId` aponta para |
|---|---|---|
| `"order"` | Pedido retido na fiscalização ou entregue | "Retido na fiscalização: …" / "Pedido entregue: …" |
| `"flight"` | Seu voo na competição: a UI toca o replay (último `BatteryResult` de `PLAYER_TEAM_ID`) | "Bateria N: seu voo com X kg" |
| `"competition"` | Início da competição, vez perdida por pendência da inspeção, resultado final | Mensagem da CT correspondente |

### Campos opcionais novos

| Campo | Significado | Mostrar? |
|---|---|---|
| `Part.counterfeit?` | Veio fora da especificação de uma loja. Servo falsificado instalado reprova na inspeção (§9.2); o resultado final lista as peças | Só depois da inspeção ou no resultado final |
| `Aircraft.evidence?` | Ensaios acumulados `{ emptyWeight, payload, takeoff }`; estreitam as margens | Pode (ex.: "3 ensaios de voo") |
| `Aircraft.flightVideoAt?` | Momento do voo filmado válido; sem ele não voa na competição | Sim |
| `AircraftHidden.bias?` | Erro da opinião da equipe (−1 a 1, em frações da margem) | **Nunca mostrar**, como o resto de `hidden` |
| `ReportState.oralPracticeHours?` | Horas de ensaio da apresentação oral | Sim |
| `Order.customsPaid?` | Imposto já pago | Sim |
| `CompetitionState.suspended?` | Equipe fora de uma bateria (id → bateria): rival que caiu, ou você abortando com trem alto | Sim |

### Ações novas e o que exigem

Sem a exigência, `start-action` recusa com `warning`. Peça quebrada (condição < 20) conta como faltando. Avião incompleto dá texto nomeando as peças: "Avião incompleto para voar. Falta o trem de pouso."

| Ação | Custo ⏱ ◆ | Equipe | Exige | Efeito |
|---|---|---|---|---|
| `report-chapter` (mudou) | 30 h | 1 | `targetId` = disciplina | Horas no capítulo (até o envio) |
| `drawings` | 20 h | 1–2 | — | Horas de plantas (10 pts em Conceitual e 10 em Estruturas) |
| `oral-rehearsal` | 6 h | 1–3 | — | Horas de ensaio da oral (até 17/out) |
| `build-fuselage` | 40 h, ◆ 120 | 1–3 | 1 `balsa-hard` | Peça `fuselage` |
| `build-tail` | 24 h, ◆ 60 | 1–2 | 1 `balsa-light` | Peça `tail` |
| `build-gear` | 16 h, ◆ 80 | 1–2 | 1 `carbon-fiber` | Peça `landingGear` |
| `test-structural` | 8 h, ◆ 20 | 2–3 | Projeto + asa utilizável | Evidência de peso vazio; cita em Estruturas e Cargas; desgasta a asa ou a danifica |
| `test-thrust` | 4 h, ◆ 10 | 1–2 | Projeto + grupo motopropulsor | Evidência de decolagem (mais com `thrust-stand`, que também mede a potência); cita em Elétrico e Desempenho |
| `test-flight` (mudou) | 12 h, ◆ 30 | 2–4 | Avião completo | Evidência de carga e decolagem; cita em Desempenho, Aerodinâmica e Estabilidade; ensina pilotagem; pode danificar uma peça |
| `flight-video` (mudou) | 12 h, ◆ 30 | 2–4 | Avião completo | Sem incidente e até 27/set, grava `flightVideoAt` |

Avião completo = asa, fuselagem, trem de pouso, grupo motopropulsor, eletrônica e, com N ≥ 2, empenagem. `buy-*` e `express-shipping` saíram: compras só pelo navegador (`place-order`). O tipo `"waiting-task"` continua no union de `ActionTarget`, sem ação que o use.

### `BALANCE.competition` (provisório)

| Chave | Valor | Uso |
|---|---|---|
| `realSecondsPerGameHour` | 20 | Nas janelas de voo, 1 h de jogo = 20 s reais em 1× (fora delas, o ritmo normal) |
| `flightDays`, `windowStartHour`, `windowEndHour` | 3, 7, 17 | Voos nos 3 dias depois do marco (23–25/out), das 7h às 17h |
| `slotMinutes` | 12 | Uma decolagem a cada 12 min |
| `maxBatteries` | 7 | Teto de baterias (a Tabela 10.1 tem 7 linhas) |
| `weather` | 945 hPa ± 2; 16 °C às 6h a 29 °C às 15h, ± 2 °C por dia; vento de proa 1,5 ± 2 m/s, +1 à tarde | Clima de São José dos Campos; Hρ ~750 m de manhã a ~1200 m à tarde |
| `climbBase`, `climbGain` | 0,08; 0,2 | Altura aos 55 m = (55 − corrida) × gradiente; abaixo de 0,9 m rompe a fita (~47 m de corrida) |
| `rotationNoise`, `clearanceNoise` | 5%; 0,1 m | Sorteio na corrida e na folga |
| `stopBase`, `stopPerKg`, `stopPerHeadwind`, `stopNoise` | 20 m; 1,2; 3; 6 | Parada desde o toque |
| `landingZoneM` | 60 | Parar depois disso = `landing-out` (sem BPO) |
| `unloadBase`, `unloadGain`, `unloadNoise` | 34 s; 20; 3 | Retirada com as 2 pessoas mais ágeis |
| `crashChance`, `damageChance`, `landingOutChance` | 2%; 5%; 8% | × risco (piloto, estabilidade, condição das peças; 1 ≈ equipe mediana) |
| `stallPerExcess` | 4 | Acima da sustentação: chance de queda = 4 × excesso relativo de massa |
| `lateChangePenalty` | 5 | Pontos por alteração de projeto depois de 27/set (Apêndice 6) |

Piloto: o melhor `piloting` da equipe ou o piloto da CT (`BALANCE.tests.ctPilot` = 55), o que for maior.

### Regras que a Simulação precisa respeitar

- **Avião:** o desempenho real sai do projeto × `hidden` × peças. A margem de `estimatePerformance` encolhe com conhecimento (Aerodinâmica e Desempenho → carga; Estruturas → peso vazio) e, mais, com ensaios. Coerência: com margem zero, a estimativa é o real.
- **Lojas:** prazo real sorteado a partir da faixa prometida (pode passar do máximo, como `BALANCE.lead`); expresso multiplica pelo `leadFactor` da loja. Importado pode ficar `held-customs` (inbox pede o imposto e pausa). Na entrega: peça com qualidade sorteada pela loja (usado: condição sorteada), estoque ou equipamento; falsificado marca a peça e reprova na inspeção (§9.2). As ações `buy-*` e `express-shipping` saem do catálogo quando o checkout estiver pronto.
- **Competição:** começa sozinha no marco `competition` do calendário (22/out: exposição e inspeção; voos de 23 a 25/out, 7h–17h, uma decolagem a cada 12 min). Nas janelas de voo 1 h de jogo dura 20 s reais em 1× (`BALANCE.competition`). O clima segue o relógio (manhã fria, tarde quente); as rivais voam pelas mesmas fórmulas de `scoring.ts`, a partir de um avião gerado pelo arquétipo; classificação para a 4ª bateria em diante pela Tabela 10.1 (`REGULAR_2026.batteryCutoffs`). Cada voo seu vira `BatteryResult` com `playback` coerente com o contrato da cena; voo seu pausa o relógio para o replay.

## frentes de trabalho em paralelo

| Frente | Pastas | Entrega |
|---|---|---|
| Simulação | `src/sim/`, `tests/sim/` | Modelo de desempenho e estimativas, relatório e envio, checkout e entregas, competição (fila, clima, rivais, baterias, placar), `dev-start-competition` |
| Interface | `src/ui/`, `src/styles/` | Prancheta gravando o projeto, tela Relatório (capítulos, previsões, reta de carga), Navegador (abas por loja com identidade própria, carrinho, checkout, rastreio), painel da Competição (fila, Hρ ao vivo, escolha de carga com margem, placar) |
| Cenas | `src/scenes/` | Hangar lendo tarefas e peças reais (e pacotes chegando), `FlightScene` tocando os `BatteryResult` do store, cena da fila |

Mudança em `sim/types.ts` ou `sim/commands.ts` continua sendo mudança de contrato: avisa o coordenador antes.

## Escala da oficina (design §5.5)

- **Tipos:** `ShiftId` ("morning" | "afternoon" | "evening" | "overnight"; 8–12, 13–18, 19–22, 22–3; a madrugada pertence ao dia em que começa), `Weekday` (0 = domingo), `SlotKey` (`${Weekday}-${ShiftId}`). Helpers: `slotKey`, `SHIFTS`, `WEEKDAYS`.
- **Estado:** `GameState.workshop = { capacity, keyHolders, nightAccess: "none" | "requested" | "granted", schedule }`; inicia com `capacity` 4 e `keyHolders` = capitães. `Member.classSlots` e `Candidate.classSlots`: fim de semana e madrugada nunca têm aula. `GameState.version` = 4.
- **Ações:** `ActionDef.workshop?` (só anda nos turnos escalados, com chave e lotação) e `needsPair?` (duas pessoas no turno). Acesso noturno: ação `night-access-request` (horas + ⌛).
- **Comandos:** `set-shift { memberId, slot, on }`, `apply-suggested-schedule`, `grant-key { memberId }`. `set-shift` recusa manhã D+1 para quem está na madrugada D (e o inverso): "vai estar dormindo depois da madrugada"; `suggestSchedule` evita o mesmo.
- **Leituras:** `slotStatus(state, memberId, slot)` → "free" | "class" | "exam" | "locked"; `suggestSchedule(state)` → `{ schedule, notes }`; `currentShift(state)` → `{ day, shift } | null`; `workshopNow(state)` → `{ slot, present, open, blocked }`.
- **Regras:** o tick quebra nas horas cheias; madrugada tira motivação (sobe na semana de prazo) e qualidade (`Task.overnightHours`, dobra depois da 1h); estimativas de prazo contam só os turnos escalados (escala vazia = `null`).
