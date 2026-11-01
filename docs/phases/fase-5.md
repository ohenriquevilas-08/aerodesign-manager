# Fase 5: contrato e regras

Parte do [núcleo da arquitetura](../architecture.md). Nasce do segundo playtest (Pages da Fase 4, 01/11/2026).

Escopo: escalação sobre o avião, personagens isométricos, Prancheta com engenharia de sistemas e ensaio de voo como evento. **Fora:** simulador de ano e balanceamento (Fase 6, porque esta fase mexe nas fórmulas de desempenho), voo controlado pelo jogador (decidido: só gestão), dependências entre tarefas (§5.4), redes sociais.

`GameState.version` = **6** (projeto ganha campos, integrante ganha aparência, entram ensaios agendados). Saves de versão diferente são descartados.

Decisões do Henrique nesta fase: escalação com cartas **sobre o avião**; personagens **isométricos 2.5D** (estilo Habbo, iguais no hangar e nas cartas), não 3D; voo continua **simulado**; o presidente (você) não aparece em nenhuma lista de integrantes.

## Frentes

| Frente | Itens | Depende de |
|---|---|---|
| Simulação | S1–S4 | nada |
| Cenas | C1–C3 | tipos novos de S1 e S3 (combinar os nomes abaixo; usar stub local até o merge) |
| UI | U1–U4 | Simulação e Cenas integradas |

Ordem: Simulação e Cenas juntas; UI depois do merge das duas.

## Simulação

### S1. Projeto com engenharia de sistemas

**Status: feito (branch `claude/sim-phase5`).** `massBudget(design, state?)` e `stabilityEstimate(design, state?)` aceitam o estado como opcional (sem ele, o nominal); `missionRequirements` e `compareDesigns` aceitam a carga-alvo como último argumento opcional. Extras exportados: `estimateDesign`, `designProblem`, `maxPropDiameterIn`, `staticMarginStatus`, `MASS_ITEMS`, `MASS_ITEM_LABELS`, `defaultTargetPayload`, `wingAreaM2`, `aspectRatio`.

Atualizar o design §6 junto. Fórmulas de pontuação (b, N, P, FPV, EE) continuam as do regulamento; o que muda é como o projeto chega ao peso vazio, à carga e à corrida.

- `AircraftDesign` ganha: `chordM` (corda média; alongamento = b / corda, derivado), `wingPosition: "high" | "low"`, `tailVolume` (volume de cauda horizontal, ~0,3–0,7), `cgPercentMac` (posição do CG em % da CMA), `propDiameterIn` (limitado pela altura do trem: trem baixo corta o máximo). Limites em `DESIGN_LIMITS`; `DEFAULT_DESIGN` com valores seguros.
- `massBudget(design)`: peso estimado por subsistema (asa, fuselagem, empenagem, trem, motor + hélice, bateria, eletrônica), cada um `Estimate`; a soma é o peso vazio de `estimatePerformance`. Filosofia e material entram aqui.
- `stabilityEstimate(design)`: ponto neutro e margem estática (`Estimate`, % CMA). Margem baixa = mais carga e mais risco de perda de controle nos voos; negativa = instável (risco alto). Cauda maior = mais estável e mais peso.
- `missionRequirements(state, design, hRho)`: lista de requisitos com `{ id, label, target, value: Estimate, status: "ok" | "risk" | "fail" }`: corrida ≤ 55 m com a carga-alvo, folga sobre a fita, margem estática na faixa, envergadura ≤ limite sem penalidade, potência ≤ limite, peso vazio dentro do orçamento. Carga-alvo é escolha do jogador (rascunho, na UI).
- `compareDesigns(state, a, b, hRho)`: para o trade-off, devolve requisitos, orçamento de massa, multiplicador e nota de voo estimada dos dois lado a lado.
- O `hidden` do avião ganha desvios para as massas e para a margem estática (sorteio no primeiro `set-design`, como hoje).

### S2. Ensaio de voo como evento

**Status: feito.** `test-flight` e `flight-video` saíram do catálogo; entrou `pilot-training`. Estado novo: `flightTests: FlightTest[]`; pausa `"flight-test"`; `FlightPlayback.venueId`; `TestRecord.playback` e `flightTestId`. Cancelar: `{ type: "cancel-flight-test", testId }`. Leituras extras: `flightTestCost` (formato `Cost`), `scheduleProblem`, `venueDensityAltitude`.

Atualizar o design §7.3 junto. Os ensaios de bancada continuam tarefas da oficina; só o voo (`test-flight` e o voo filmado) vira evento.

- `content/testVenues.ts`: locais paródia (ex.: campo do aeroclube, pista de aeromodelismo, fazenda de um ex-integrante), cada um com custo ◆, antecedência mínima, dias disponíveis, distância (risco de transporte) e Hρ típica.
- Piloto: um integrante com `piloting` mínimo ou um piloto contratado (custo ◆, pilotagem alta, sem ganho de conhecimento para a equipe).
- Comando `{ type: "schedule-flight-test", venueId, day, pilot: { memberId } | { hired: true }, crew: memberId[], payloadPlanKg: number[], filmed?: boolean }`. Debita na hora o que é pago adiantado; recusa sem avião completo, sem caixa, fora dos dias do local, com antecedência curta ou com tripulação já em outro evento.
- `cancel-flight-test` (reembolso parcial).
- No dia: o relógio pausa e avisa; o clima do dia define a Hρ; transporte pode danificar peça; cada carga planejada vira uma decolagem resolvida pelo mesmo motor da competição, com `FlightPlayback`. Resultado em `testHistory` (pontos Hρ × carga para a reta), conhecimento para a tripulação e desgaste/dano nas peças.
- Leitura `upcomingEvents(state)`: ensaios agendados e a competição, para a Central e para a tela Ensaios.

### S3. Aparência dos integrantes

**Status: feito.** `MemberLook = { skin: 0–5, hair: 0–4, hairColor: 0–5, shirt: 0xRRGGBB, accessory?: "glasses" | "cap" | "headband" }` (índices nas paletas das cenas, combinado com Cenas); camiseta = `TEAM_SHIRT_COLOR` (espelha `palette.highlight`). Contagens em `LOOK_OPTIONS`, sorteio em `drawLook`. O presidente também tem `look` (cabeçalho).

- `Member.look: MemberLook` (`skin`, `hair`, `hairColor`, `shirt`, `accessory?`), sorteado pelo `rngState` ao criar o integrante (inicial e seletiva). Candidato também tem `look`.
- Camiseta usa a cor da equipe.

### S4. Presidente fora das listas

**Status: feito** (`rosterMembers`; `formationView` já usa). Trocar as telas para a leitura fica com U2.

- Leitura `rosterMembers(state)`: integrantes sem o presidente. Elenco, escalação, escala da oficina e seletiva usam essa leitura; o presidente aparece só no cabeçalho como "Você".

## Cenas

### C1. Blueprint com três vistas e estabilidade

- Vista frontal nova (diedro fixo, posição da asa alta ou baixa, trem, diâmetro da hélice).
- Vista lateral marca CG e ponto neutro com a margem estática entre eles (cor pela faixa: ok, risco, instável).
- Vista superior reflete corda e alongamento; cauda escala com `tailVolume`.
- Modo comparação: o projeto gravado em traço apagado por baixo do rascunho.
- Geometria pura em `scenes/blueprint/geometry.ts`, testada.

### C2. Personagens isométricos

- `scenes/people/avatar.ts`: geometria pura do boneco isométrico (polígonos e cores) a partir de `MemberLook` e pose (`stand`, `work`, `nap`), testada.
- O hangar (`Worker.ts`) desenha a partir dela; `ui/components/Avatar.tsx` desenha os mesmos polígonos em SVG para retratos de carta, de modo que hangar e carta mostram o mesmo boneco.

### C3. Cena do ensaio de voo

- A `FlightScene` aceita um cenário de local (campo do aeroclube, pista, fazenda: céu, chão e fundo diferentes) e toca as decolagens do ensaio em sequência.
- Antes dos voos, uma vinheta curta de chegada (van, equipe descarregando o avião) usando os bonecos de C2.

## UI

### U1. Escalação sobre o avião

O campo é o blueprint do avião visto de cima. Cada área tem a sua posição na parte que cuida: Aerodinâmica na asa, Estruturas na fuselagem, Elétrica no motor, Estabilidade e controle na empenagem, Cargas na longarina, Desempenho no trem. Cartas no estilo FIFA: retrato (C2), overall da área, nome, motivação. Capitão com faixa. Área vazia = parte do avião apagada; o aviso ("Elétrica sem ninguém: ...") vira tooltip, nada de parede de avisos. Faixa "Sem área" só aparece quando há novatos. Arrastar continua chamando `set-area`.

### U2. Elenco sem presidente

Elenco usa `rosterMembers` (S4), com os retratos de C2.

### U3. Prancheta de engenharia

Três colunas: decisões (com os parâmetros novos, agrupados por subsistema), blueprint (C1) e, à direita, abas **Requisitos** (carga-alvo + lista com ok/risco/falha e margem), **Massa** (orçamento por subsistema, barras somando ao peso vazio) e **Comparar** (gravado × rascunho via `compareDesigns`, com botão Gravar). A estimativa de desempenho e o multiplicador continuam.

### U4. Ensaio de voo como evento

Na tela Ensaios: botão "Agendar ensaio de voo" abre um fluxo de 3 passos (local e dia, piloto e tripulação, cargas planejadas), com custo total no formato `Cost`. Lista de eventos agendados com contagem regressiva e cancelar. No dia, a cena C3 toca e o gráfico Hρ × carga recebe os pontos. Bancada continua como hoje.

**Status da UI: feito (branch `claude/ui-phase5-2666f9`).** Stubs de `scenes/phase5.ts` trocados pelos tipos reais (arquivo removido).

- U1: `ui/team/Formation.tsx` (cartas FIFA sobre o avião em SVG; área vazia apaga a parte; aviso só em tooltip; "Sem área" só com novatos; estilos em `styles/phase5.css`).
- U2: `Team.tsx` usa `rosterMembers` e `Avatar`; o presidente aparece só como "Você" no cabeçalho.
- U3: `Drafting.tsx` passa a ter **rascunho local** (o projeto só vira estado em "Gravar projeto", via `set-design`); abas Requisitos (carga-alvo, Hρ), Massa e Comparar (`compareDesigns`, gravado em traço apagado no blueprint). Trocar para trem baixo encolhe a hélice ao máximo permitido.
- U4: `FlightTestPlanner.tsx` (3 passos, custo no formato `Cost`, validação por `scheduleProblem`); `Tests.tsx` ganhou "Próximos eventos" (`upcomingEvents`, cancelar), "Rever voos" e toca a sessão C3 (`flightReplay.playSession`) quando o ensaio acontece ou ao entrar na tela. `entryFromHistory` usa o `playback` real quando o registro tem.

## Verificação

- `npm run check` verde em cada frente.
- No navegador: arrastar carta para a asa; retrato igual no hangar e na carta; mudar CG e cauda e ver a margem mudar no blueprint e nos requisitos; comparar e gravar; agendar um ensaio, avançar até o dia e ver os voos e os pontos no gráfico; recarregar a página com um ensaio agendado (save).
- Pendências da Fase 4 que entram na verificação da UI: confirmação de envio do relatório e madrugada com tarefa de oficina real.
