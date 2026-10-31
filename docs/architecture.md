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

Definido em `src/scenes/flight/playback.ts`. Descreve uma bateria **já resolvida** pela simulação; a `FlightScene` só toca o replay. A simulação produz este objeto (serializável, sem Phaser):

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
- Entrega à cena: `flightReplay.play(playback)` (`src/scenes/flight/replayChannel.ts`). Quando as baterias estiverem no `GameState`, a cena pode passar a ler do store.
- O replay tem velocidade própria (`flightReplay.setSpeed`), independente de `clock.speed`.
- Em dev, a tela Competição tem um painel que toca cada desfecho com `MOCK_PLAYBACKS`, e `window.__flightScene.seek(t)` pula o replay.

### Hangar: `BenchView`

Definido em `src/scenes/hangar/benchView.ts`. Cada bancada (asa, fuselagem, eletrônica, relatório) mostra uma tarefa com barra de progresso e as peças com estado (design §7.2). A cena lê `benchViewsFromState(state)`; hoje ela devolve dados simulados a partir do relógio. Quando a simulação tiver tarefas e peças por bancada, basta trocar o corpo dessa função.

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

## Comandos

```bash
npm install
npm run dev        # http://localhost:5173
npm test
npm run typecheck
npm run build      # gera dist/ com base /aerodesign-manager/
```
