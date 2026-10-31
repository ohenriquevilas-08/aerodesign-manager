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
| `{ type: "start-action", actionId, targetId? }` | Debita ◆ e consome estoque na hora; cria `Task`. Com `leadDays > 0` nasce `waiting` até `readyAt` (sorteado; ver Regras); senão `active`. Sem horas e sem prazo conclui na hora (sem pausar). | Ação desconhecida, alvo inválido, falta estoque, caixa insuficiente |
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

## Comandos

```bash
npm install
npm run dev        # http://localhost:5173
npm test
npm run typecheck
npm run build      # gera dist/ com base /aerodesign-manager/
```
