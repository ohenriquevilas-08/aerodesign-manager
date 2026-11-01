# Fase 4: contrato e regras

Parte do [núcleo da arquitetura](../architecture.md). Nasce do primeiro playtest do Ano 1 (versão do Pages, 01/11/2026).

Escopo: save, as correções do playtest (madrugada, escalação, blueprint, relatório, navegador) e as telas Ensaios e Finanças. **Fora:** simulador de ano e balanceamento (Fase 5), dependências entre tarefas e integração como evento (§5.4), redes sociais.

`GameState.version` = **5** (sai `nightAccess`, entra `area` no integrante). Saves de versão diferente são descartados.

## Frentes

| Frente | Itens | Depende de | Status |
|---|---|---|---|
| Simulação | S1–S6 | nada | **pronto** (branch `claude/sim-phase4-1c342e`) |
| Cenas | C1–C2 | só tipos que já existem (`AircraftDesign`) | em andamento |
| UI | U1–U7 | contratos da Simulação | pendente |

Ordem sugerida: Simulação e Cenas juntas; UI depois que a Simulação for integrada.

## Simulação

### S1. Save

- `sim/save.ts`: `serializeState(state): string` e `deserializeState(json): GameState | null` (`null` se a versão não bate ou o JSON é inválido). Puro, testado (ida e volta preserva `rngState`, relógio, pedidos e competição).
- `app/save.ts` (camada app): um slot em `localStorage` (`aerodesign-manager:save`). Salva sozinho a cada virada de dia de jogo e ao pausar. `loadSave()` / `clearSave()`.
- Sem migrações: versão diferente = save descartado com aviso.

### S2. Madrugada sem autorização

A oficina é da equipe, fora do bloco de aulas; a equipe tem a chave. A madrugada fica **sempre disponível** na grade.

- Remover `NightAccess`, `workshop.nightAccess`, o efeito `night-access` do catálogo e o bloqueio `locked` da madrugada em `sim/workshop.ts`.
- `grant-key` continua (quem pode abrir a oficina).
- Custos da madrugada inalterados: perde a manhã seguinte, motivação cai (sobe na semana de prazo), cansaço baixa a qualidade.
- Atualizar o design §5.5 junto.

### S3. Áreas e formação (base da escalação)

Equipe de aerodesign se organiza por área, com capitão e membros. Nada de banco ou reserva.

- `Member.area: Discipline | null` (`null` = novato sem área, recém-chegado da seletiva). `Role` ganha ou mantém `captain` / `member`; o presidente continua existindo no estado mas **não** entra na formação.
- `content/formations.ts`: `FORMATIONS[category]` = lista de áreas, cada uma com 1 vaga de capitão e N de membros. Classe Regular: Aerodinâmica, Estruturas, Elétrica, Desempenho, Estabilidade e controle, Cargas (ajustar contagem de vagas com o design). Nova categoria = nova formação, mesmo formato.
- Comando `{ type: "set-area", memberId, area: Discipline | null, captain?: boolean }`. Recusa: área cheia, dois capitães na mesma área, presidente. Trocar de área custa motivação (valor em `BALANCE`, citar no design); o tácito fica na disciplina antiga, como já é.
- Leitura `formationView(state)`: por área, capitão, membros, vagas livres e o aviso do que para sem ela (ex.: "Elétrica sem ninguém: capítulo de safety parado").
- Estado inicial: os dois capitães já nas suas áreas.

### S4. Relatório: correção e checklist

- **Bug:** `submit-report` é aceito no 1º dia com o rascunho padrão das previsões (playtest: "Enviado ao Portal da CT em dom, 1 mar 2026"). Exigir projeto gravado (`aircraft !== null`) e pelo menos 1 hora em algum capítulo; a UI pede confirmação (U3).
- Leitura `reportChecklist(state)`: por capítulo, estado (`not-started` / `writing` / `ready`), horas, ensaios citados, nota esperada e o que falta; mais as duas previsões (peso vazio, reta de carga) com estado e a contagem regressiva até 16/ago.

### S5. Navegador dinâmico

- Notícias: `news: NewsItem[]` gerado por eventos (promoção começando, estoque acabando, prazo do regulamento chegando, resultado de rival). Determinístico pelo `rngState`.
- Avaliações de vendedor por loja (conteúdo fixo em `content/`, com nota e 2–3 comentários paródia) ligadas ao risco real da loja (falsificado, atraso), sem revelar o número.
- Promoções relâmpago já existem: expor `promoEndsAt` para a contagem regressiva.

### S6. Leituras para Ensaios e Finanças

- `testHistory(state)`: ensaios feitos com data, Hρ do dia, resultado e peças afetadas; pontos (Hρ, carga) para a reta de previsão.
- `ledger: LedgerEntry[]` no estado (`{ at, credits, kind: "order" | "customs" | "raffle" | "sponsor" | ..., label }`), preenchido por todo comando ou evento que mexe em ◆. Leitura `financeSummary(state)`: caixa, entradas e saídas por categoria e por mês.

### Contratos entregues pela Simulação (S1–S6)

Tudo exportado por `src/sim/index.ts`. `GameState` ganhou `news`, `ledger` e `testLog`; `Member` ganhou `area`.

| Item | Contrato | Valores escolhidos |
|---|---|---|
| S1 | `serializeState`, `deserializeState`, `SAVE_VERSION`; em `app/save.ts`: `loadSave()` → `{ state, discarded }`, `writeSave`, `clearSave`, `hasSave`, `startAutosave(store)`; `store.replace(state)` para carregar ou começar de novo | Chave `aerodesign-manager:save`. `discarded: true` quando havia save antigo ou corrompido (já apagado): a UI avisa |
| S2 | Sem `NightAccess`, `workshop.nightAccess`, efeito `night-access` nem ação `night-access-request`. `slotStatus` só devolve `locked` para turno ou integrante inválido | Custos da madrugada inalterados |
| S3 | `Member.area`, `FORMATIONS`, `set-area`, `formationView(state)` → `{ areas[{ discipline, label, captainId, memberIds, openSlots, captainOpen, warning }], unassigned, presidentId }` | Vagas de integrante: Aerodinâmica 2, Estruturas 3, Elétrica 2, Desempenho 1, Estabilidade 1, Cargas 1 (Projeto conceitual não é área). Trocar de área: −8 de motivação (`BALANCE.formation.changeAreaMotivation`); novato sem área → área é grátis. `set-area` sem `captain` vira integrante (tirar o capitão de uma área o rebaixa). `area: null` tira da formação. Capitão não perde a chave ao mudar |
| S4 | `submit-report` exige `aircraft !== null` e ≥ 1 h de escrita somada (`BALANCE.report.minWrittenHours`); `submitBlocker(state)`; `reportChecklist(state)` → capítulos (`not-started`/`writing`/`ready`, horas, ensaios citados, nota esperada, `missing[]`), plantas, previsões (`missing`/`ready`/`sent`), `deadline` (contagem até 16/ago), `expected`, `blocker` | Capítulo "pronto" com ≥ 25 h (`BALANCE.report.chapterHours`); aviso de acervo baixo abaixo de 30. O envio automático de 16 e 23/ago não passa pela regra nova |
| S5 | `state.news`, `newsFeed(state)`, `promoEndsAt(state, shopId, productId)` (horas de jogo ou `null`), `sellerReview(shopId)` / `SELLER_REVIEWS` | Notícias de: promoção (diária), estoque (última unidade ou esgotado, anúncios limitados), prazo (7 dias antes de cada marco), rival de destaque voando. Guarda as últimas 60; não repete a mesma por 72 h. Notas: Hangar 4,8 · Compósitos 4,7 · Balsa Leve 4,6 · Mercado Solto 4,1 · Desapega 3,7 · HobbyKong 3,5 · AliExpresso 2,6 (testado: mais risco nunca tem nota maior) |
| S6 | `state.ledger`, `LedgerEntry { at, credits, kind, label }` com `kind` `order`/`customs`/`raffle`/`sponsor`/`action`/`dev`; `financeSummary(state)` → `{ cash, income, expense, byKind, byMonth[{ month: "2026-03", … }] }`; `state.testLog`, `testHistory(state)` → `{ entries, points }` (`entries` do mais recente ao mais antigo, com `label`, `densityAltitudeM`, `ok`, `summary`, `affectedParts`, `payloadKg`) | Hρ do dia vem de `weatherAt(seed, hora)`. O ponto de carga do voo de ensaio é a carga real (`maxPayloadKg`) naquele Hρ ± 4% (`BALANCE.tests.flight.measureSpread`), sem consumir `rngState`. Só voos de ensaio (`flight`) geram ponto |

## Cenas

### C1. Blueprint na Prancheta (estilo oficina do C.A.T.S)

- `scenes/BlueprintScene.ts` (chave `"blueprint"`): vista de cima e de lado, traço branco sobre azul técnico, cotas da envergadura. Redesenha ao vivo quando o rascunho da prancheta muda (antes de gravar).
- Geometria pura em `scenes/blueprint/geometry.ts` (`blueprintGeometry(design)`), testada: envergadura escala a asa; N = 1 asa voadora, 2 convencional, 3 com canard; potência escala motor e diâmetro da hélice; trem alto ou baixo muda a altura e a folga da hélice; material muda a hachura (balsa, compósito, misto); filosofia muda espessura de longarina e corda.
- A UI entrega o rascunho por um canal, como o `flightReplay` (`blueprintChannel.show(design)`), porque o rascunho ainda não está no estado.

### C2. Cena de Ensaios

- Ensaio de voo reaproveita a `FlightScene` com o `FlightPlayback` do ensaio.
- Ensaios de bancada (estrutural, tração, balança): animação curta na bancada do hangar com o resultado no fim. Só anima; o resultado vem pronto da simulação.

## UI

### U1. Equipe: escalação

Campo no estilo escalação do FIFA, com uma coluna por área de `formationView`: vaga de capitão no topo, membros embaixo, vaga vazia como buraco com o aviso. Novatos sem área ficam numa faixa "Sem área"; arrastar a carta para a coluna chama `set-area`. O presidente (você) fica no cabeçalho, fora do campo. A aba "Escala da oficina" continua.

### U2. Madrugada

Painel da madrugada sem botão de autorização; o texto explica só os custos (S2).

### U3. Relatório como checklist de entrega

Contagem regressiva até 16/ago no topo; um cartão por capítulo (estado, o que falta, botão "Escrever", que abre a ação no catálogo); as duas previsões como itens da lista. Fórmulas (NR, FPR) descem para um "Como funciona" recolhido. Enviar pede confirmação mostrando a NR esperada.

### U4. Navegador

- Abas só para sites abertos; cada aba com ✕; a página inicial vira favoritos + busca (busca por produto em todas as lojas).
- Estado das abas é de apresentação: fica na UI (persistir em `localStorage` é opcional).
- Portal de notícias como um site (S5); avaliações na página da loja; contagem regressiva nas promoções.
- Estrutura de "site" genérica, para receber redes sociais depois.

### U5. Tela Ensaios

Escolher ensaio (custos em `Cost`), ver acontecer (C2), histórico (S6) e o gráfico Hρ × carga com os pontos medidos e a reta do rascunho.

### U6. Tela Finanças

Caixa, entradas e saídas por categoria e por mês, extrato (`ledger`), pedidos com imposto pendente.

### U7. Save

Na abertura: "Continuar" (se há save) ou "Novo jogo". No menu: "Novo jogo" com confirmação. Aviso quando um save antigo é descartado.

## Verificação

- `npm run check` verde em cada frente.
- No navegador: escala com tarefa de oficina real e madrugada (pendente desde a Fase 3); arrastar integrante entre áreas; blueprint mudando com cada controle; recarregar a página e continuar do save.
