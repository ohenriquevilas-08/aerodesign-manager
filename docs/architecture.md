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
- Entrega à cena: `flightReplay.play(playback)` (`src/scenes/flight/replayChannel.ts`).
- Do store (`src/scenes/flight/results.ts`): a `FlightScene` toca sozinha o seu último `BatteryResult` com `playback` (`teamId === PLAYER_TEAM_ID`) quando ele aparece em `competition.results`, uma vez só (a chave do último tocado fica fora da cena, então trocar de tela não repete; um voo que aconteceu com outra tela aberta toca ao entrar na Competição). Para tocar sob demanda, a UI usa `playResult(result)` com um item de `rivalReplays(state)` (rivais de destaque com replay) ou de `competition.results`.
- O replay tem velocidade própria (`flightReplay.setSpeed`), independente de `clock.speed`.
- Em dev, a tela Competição tem um painel que toca cada desfecho com `MOCK_PLAYBACKS`, e `window.__flightScene.seek(t)` pula o replay.

### Fila da competição: `QueueScene`

`src/scenes/QueueScene.ts` (chave `"queue"`), vista de lado como o voo: a taxiway com as equipes esperando, a cabeceira com a próxima a voar, a sua destacada em laranja com uma seta, o sol no arco do céu pela hora do relógio (manhã fria → tarde quente) e a biruta pelo vento. Quando `queueIndex` avança, o avião que estava na cabeceira corre e sai voando (só animação; o voo de verdade é a `FlightScene`) e a fila taxia um lugar. Cabeçalho: bateria, hora, temperatura, pressão, Hρ (`currentDensityAltitude`), vento, quantas equipes já voaram e quantas estão à sua frente. Fase `inspection`, `finished` ou `competition` nulo: cenário sem fila e um aviso no meio.

- A cena só anima; a UI monta, como as outras: `<PhaserStage scene={QueueScene} sceneKey="queue" />` (ela recebe `{ store }` em `init`). Cada `PhaserStage` é um `Phaser.Game` próprio, então fila e voo podem ficar lado a lado ou alternar na tela Competição.
- Lógica pura em `src/scenes/queue/queueView.ts` (testada em `tests/scenes/queueView.test.ts`): `queueViewFromState(state, maxShown)` (cabeceira primeiro, `hidden` além da janela, `playerAhead`), `hourOfDay`, `sunElevation`, `sunProgress`, `windsock`.
- Tweens seguem `clock.speed` (pausa junto); o céu é redesenhado a cada minuto de jogo.

### Hangar: `BenchView`

Definido em `src/scenes/hangar/benchView.ts` (funções puras, testadas em `tests/scenes/benchView.test.ts`). Cada bancada (asa, fuselagem, eletrônica, relatório) mostra uma tarefa com barra de progresso e as peças com estado (design §7.2).

- `benchForTask(state, task)`: relatório e ensaios de bancada pelo id (`ACTION_BENCH`); peça fabricada ou comprada pelo `effect.part` do catálogo; reparo pela peça alvo; por último o nome da ação (`wing` → asa; `fuselage`/`gear`/`tail` → fuselagem; `motor`/`servo`/`electronic` → eletrônica). O resto (estudo, rifa, divulgação, voos) não aparece em bancada.
- `PART_BENCH`: asa → asa; fuselagem, empenagem e trem → fuselagem; motor e eletrônica → eletrônica.
- `benchViewsFromState(state)`: por bancada, a primeira tarefa ativa (senão a primeira esperando) e quantas outras há (`queued`); até 4 peças e o resto em `moreParts`. Progresso = `hoursDone / hoursTotal`; na espera ⌛, tempo passado sobre o prazo **prometido**, travado em 99% (o `readyAt` real não vaza).
- `aircraftViewFromState(state)`: o avião no cavalete usa a melhor peça de cada `PartType` (maior condição, depois qualidade); `null` se não existe. A cena pinta danificada em amarelo e quebrada em vermelho.
- `workerViewsFromState(state)`: cada integrante vai para a bancada da tarefa em que está em `assignees`; trabalha se a tarefa está ativa, fica de pé se ela espera prazo. Presidente, quem está sem tarefa ou numa tarefa fora do hangar fica na área livre, na frente. Quem entra na equipe aparece; quem sai some.
- Escala da oficina (`src/scenes/hangar/workshop.ts`, design §5.5): só quem está em `workshopNow(state).present` aparece no hangar; fora de turno ele fica vazio, escuro e com a placa "FECHADA". `lightingFor(slot, open, hora)`: manhã e tarde com luz do dia; noite com luminárias acesas (cor `lamp`) e janelas escuras (cor `night`); madrugada mais escura, com pizza e café no piso e o primeiro presente fora das bancadas cochilando no canto (`overnightNapper`). Com `blocked` preenchido, a placa no portão vira "OFICINA PARADA" com o motivo.
- Ações novas: `build-fuselage`, `build-tail` e `build-gear` vão para a fuselagem; `drawings` e `oral-rehearsal`, para o relatório; `test-structural`, para a asa; `test-thrust`, para a eletrônica (`ACTION_BENCH`). Peça com `counterfeit` ganha um anel amarelo no ponto de estado do cartão.
- Pacotes (`src/scenes/hangar/packages.ts`, design §8.4): `packagesAtDoor(state)` lista os pedidos `in-transit` e `held-customs`, que viram caixas ao lado do portão (até 6; retido ganha faixa amarela) com a legenda "N A CAMINHO · N RETIDO". `recentDeliveries(state)` lista os `delivered` com `deliveredAt` no último dia de jogo (`OPENING_WINDOW_HOURS`); a cena abre cada um uma vez ("Chegou: …"). A abertura anda em tempo real, mesmo com o relógio pausado, para não congelar se a entrega pausar o jogo.

### Blueprint da Prancheta: `BlueprintScene`

`src/scenes/BlueprintScene.ts` (chave `"blueprint"`): vista de cima e lateral em traço branco sobre azul técnico (`palette.blueprint`, espelhado em `--blueprint`), cotas da envergadura (laranja) e da folga da hélice ao solo (vermelha quando a hélice bate no chão). Só desenha; a escala é fixa (cabe o maior avião), então o desenho cresce e encolhe com os controles. Envergadura e potência deslizam até o valor novo; o resto troca na hora.

- Geometria pura em `src/scenes/blueprint/geometry.ts`, `blueprintGeometry(design)` (testada em `tests/scenes/blueprintGeometry.test.ts`), usa só `AircraftDesign` e `DESIGN_LIMITS`. Eixos: x do nariz para a cauda, y lateral, z altura. Devolve superfícies (`wing`/`canard`/`tail` com raiz, corda, enflechamento e afilamento), fuselagem, deriva, motor, hélice, trem, `propClearance`, `sparWidth`, `hatch` (`ribs` balsa, `weave` compósito, `mixed`) e `ribs`.
- N = 1 vira asa voadora (enflechada), 2 convencional, 3 ganha canard. A filosofia muda corda e longarina; o trem alto sobe a fuselagem e dá folga à hélice; a potência escala motor e hélice.
- Entrega: o rascunho ainda não é estado, então a Prancheta chama `blueprintChannel.show(design)` (`src/scenes/blueprint/channel.ts`, no molde do `flightReplay`) a cada mudança; a cena lê `blueprintChannel.current` ao criar. A tela monta `<PhaserStage scene={BlueprintScene} sceneKey="blueprint" />` no centro, entre as decisões e as estimativas.
- O carimbo com o resumo do projeto só aparece com o painel largo (760 px ou mais).

### Ensaios: voo e bancada

Entrada tipada localmente em `src/scenes/tests/testEntry.ts`: `TestEntry = BenchTestEntry | FlightTestEntry`. A cena só anima; resultado, medida e texto chegam prontos. **Ponto de troca:** quando a Simulação entregar `testHistory(state)` (Fase 4, S6), a UI deriva as entradas de lá e a tipagem local some.

- `playTest(entry)`: ensaio de voo chama `flightReplay.play(playback)` e reaproveita a `FlightScene`; ensaio de bancada vai para `benchTestChannel.run(entry)`, que o `HangarScene` assina.
- Bancada (`BenchTestEntry`: `kind` `structural` · `thrust` · `scale`, `outcome`, `gauge` 0–1, `result`): estrutural na asa, tração na eletrônica, pesagem na fuselagem (`TEST_BENCH`). Um mostrador com ponteiro sobe sobre a bancada, a asa flexiona (e rompe com faíscas se `fail`), a hélice gira ou o prato pesa, e o texto de `result` aparece em `RESULT_AT` (2,6 s). Dura `BENCH_TEST_SECONDS` (5 s) em tempo real, como a abertura das caixas, mesmo com o relógio pausado.
- Quadro puro em `src/scenes/hangar/benchTest.ts`, `benchTestFrame(entry, t)` (testado em `tests/scenes/benchTest.test.ts`).
- Em dev, `window.__hangarScene.seekBenchTest(t)` pula a animação; `playTest` pode ser chamado do console com `await import('/src/scenes/tests/testEntry.ts')`.
- Falta (UI, U5): a tela Ensaios que escolhe o ensaio e chama `playTest`; hoje nada na interface dispara a animação.

## Convenções

- Identificadores, arquivos e commits em inglês; textos do jogo e comentários em PT-BR.
- Cores só via `tokens.css` (UI) ou `scenes/palette.ts` (Phaser). Os dois devem continuar espelhados.
- Custos de ações sempre como `Cost { hours, credits, leadDays, risk }` e exibidos nessa ordem (design §8).
- Toda fórmula do regulamento cita a seção ou equação no comentário e tem teste.
- `useGame` deve selecionar valores pequenos (números, strings ou objetos que mudam pouco): o relógio dispara atualizações a cada quadro.
- Save: um slot em `localStorage` (Fase 4). `GameState.version` sobe a cada mudança incompatível e saves antigos são descartados durante o protótipo (sem migrações).

## Contratos por fase

Este arquivo é o núcleo. O contrato e as regras de cada fase vivem em `docs/phases/`; leia só a fase em que for mexer:

- [`docs/phases/fase-2.md`](phases/fase-2.md): equipe, tarefas, peças, ensaios e loop de preparação.
- [`docs/phases/fase-3.md`](phases/fase-3.md): avião, relatório, lojas, competição e escala da oficina.
- [`docs/phases/fase-4.md`](phases/fase-4.md): save, correções do playtest (madrugada, escalação, blueprint, relatório, navegador), telas Ensaios e Finanças.

## Comandos

```bash
npm install
npm run dev        # http://localhost:5173
npm test
npm run typecheck
npm run build      # gera dist/ com base /aerodesign-manager/
```
