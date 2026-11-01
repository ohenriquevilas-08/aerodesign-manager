# Fase 6: contrato e regras

Parte do [núcleo da arquitetura](../architecture.md). Nasce das notas do Henrique depois da Fase 5 (01/11/2026).

Escopo: o jogador vira **professor orientador**, a temporada começa em **novembro**, com a abertura dos fundadores, e entra o **calendário anual** no estilo FIFA, com ações agendadas. **Fora:** mapa da cidade para patrocínio (Fase 7), balanceamento e simulador de ano (por último), eleição de fim de ano e Ano 2.

`GameState.version` = **7** (relógio começa em nov/2025, sai o integrante "Você", entram orientador, perfil do presidente e ações agendadas). Saves de versão diferente são descartados.

## Decisões do Henrique

- O jogador é o **professor orientador**. Ele é permanente, ano após ano, como o técnico no modo carreira. Não é integrante: não tem horas, área nem carta.
- O **presidente é um aluno (NPC)**. Ele trabalha, ocupa uma área na escalação e tem um **perfil** que dá o tom do ano.
- **Abertura:** um grupo pequeno de alunos propõe criar a equipe e convida o jogador para orientar. O primeiro presidente sai desse grupo.
- **A temporada real** começa quando a competição anterior acaba, na 2ª semana de novembro: processo seletivo, etapa trainee, eleições e leitura do novo regulamento.

## Status

- **Simulação S1 a S4: feita** (branch `claude/sim-phase6-f4681d`, sem merge). Cenas C1 e UI U1 a U4: pendentes.

### Como ficou a Simulação (contrato e desvios)

Tudo exportado por `src/sim/index.ts`. `GameState.version` = 7.

- **S1.** `SEASON_START` = 10/nov/2025; `content/calendar2026.ts` virou `content/season2026.ts` (também `REGULATION_DATE`, `SELECTION_END`, `TRAINEE_START`, `TRAINEE_END`). `OFFICIAL_CALENDAR` ganhou os marcos da pré-temporada; os de pré-temporada têm `quiet: true` (avisam na caixa de entrada, não pausam o relógio). Prancheta: `set-design` recusa antes de 9/fev com "Aguardando regulamento" (`regulationPublished`, `daysToRegulation`). `read-regulation` (12 h, conhecimento conceitual) só depois de 9/fev e uma vez (`GameState.regulationRead`). Sem ela, a penalidade por alteração tardia de projeto na inspeção é multiplicada (leitura **minha** do "risco maior": `BALANCE.season.unreadPenaltyFactor` = 2, aplicado em `lateChangePenalty`). `recruitment` só até 30/nov.
- **S2.** `Role` ganhou `"trainee"`. `Member.agenda?`, `Member.flair?` (a "cara") e `Member.trainingHours?`. `GameState.advisor`, `GameState.founding`, `GameState.agendaLog`. 4 fundadores fixos (`content/founders.ts`: Marina, Caio, Bia, Rafa), sem cargo. `found-team { presidentId, captains, teamName? }`: **desvio:** `captains` é `Partial<Record<Discipline, string>>` (4 alunos não cobrem as 6 áreas); só áreas da formação e um cargo por fundador (capitães opcionais, ver "Ajuste de contrato"). A agenda mora no fundador (perfil que ele traz se for eleito); `presidentView`/`advisorView` leem. `canWork` agora é sempre `true` e `rosterMembers` inclui o presidente e os trainees; `formationView` ganhou `trainees` e o presidente pode ocupar área (não a vaga de capitão). Enquanto `founding`, `set-speed` > 0 é recusado. Seletiva: `hire-candidate` cria `trainee` antes de 1/fev; ação nova `trainee-training` (8 h, mín. 2 pessoas). Em 1/fev cada trainee vira `member` ou desiste.
- **S3.** `schedule-action`, `reschedule-action`, `unschedule-action`; `startAt` é em **horas de jogo** (`dateToHours`). Falha na hora (sem gente livre, caixa, material ou pré-condição): a ação sai da lista, avisa na caixa e pausa com `PauseReason` `"scheduled"` (novo; `ui/format.ts` ganhou o rótulo). `Task.startedAt` é campo novo. `calendarMonth(state, ano, mês 1–12)` e `seasonOverview(state)` (13 meses). Tarefa sem previsão de fim aparece do início até hoje.
- **S4.** `dev-start-competition` funciona na abertura (faz a `found-team` padrão, `defaultFounding()`, e põe o relógio em 9/fev para abrir a Prancheta). Save v6 descartado.

### Ajuste de contrato (decidido pelo Henrique depois da entrega)

- O organograma de fundação não é rígido: em `found-team`, `captains` (`Partial<Record<Discipline, memberId>>`) pode vir vazio ou parcial; só o presidente é obrigatório (antes exigia Aerodinâmica e Estruturas). Cada fundador ainda assume um só cargo.
- `FounderFlair` ganhou `"management"` e `"marketing"` (inclinação de gestão, sem efeito no Ano 1). Nenhum fundador usa ainda; áreas de negócio e árvore de habilidades ficam para a Fase 7.

### Nomes de pessoa (segundo ajuste do Henrique)

Todo aluno tem nome e sobrenome brasileiros, nunca o cargo. `content/names.ts` (`FIRST_NAMES`, `LAST_NAMES`) e `naming.ts` (`drawPersonName`) sorteiam pelo `rngState`, sem repetir o nome completo na equipe e, quando dá, sem repetir o primeiro nome. Valem para os fundadores (sorteados em `createGame`; `FounderDef` não tem mais `name`, e os ids `founder-*` são só chaves estáveis de perfil), os candidatos da seletiva (que viram trainees) e os trainees. `CANDIDATE_NAMES` saiu de `content/selection.ts`. O cargo é rótulo à parte (`Member.role`). O orientador tem nome padrão "Helena Prado"; `createGame({ advisorName })` aceita outro para a UI deixar editar na abertura.

### Valores **[PROPOSTA]** em `BALANCE`

`season.summerFactor` 0,5 · `season.unreadPenaltyFactor` 2 · `trainee.hoursRequired` 24, `knowledgePerHour` 0,6, `withoutCaptainShare` 0,5, `stayChanceAtZero` 0,4, `stayChanceAtFull` 0,95 · `agenda.alignedBoost` 1, `idleDays` 3, `idlePenalty` 3, `logDays` 30 · `advisor.startReputation` 10, `reportSubmitted` 3, `competitionBase` 2, `competitionPerPlaceFromLast` 0,25.

### Provisório na UI

`app/store.ts` e `app/session.ts` despacham `found-team` com `defaultFounding()` (Bia preside; Marina, Caio e Rafa capitaneiam) para o jogo abrir sem a tela de fundação (U2). A Prancheta ainda não mostra o aviso "Aguardando regulamento" (U4): ela só devolve o aviso ao confirmar. Os testes das fases antigas usam `tests/sim/helpers.ts` (`startedGame`: fundada em 19/fev/2026; `foundedGame`: fundada em 10/nov/2025).

## Frentes

| Frente | Itens | Depende de |
|---|---|---|
| Simulação | S1–S4 | nada |
| Cenas | C1 | `MemberLook` (já existe) |
| UI | U1–U4 | Simulação e Cenas integradas |

Ordem: Simulação e Cenas juntas; UI depois do merge.

## Simulação

Atualizar o design §4 (tempo e calendário), §5 (equipe) e §13 (decisões) junto.

### S1. Temporada desde novembro

- O relógio começa em **seg, 10/nov/2025**. `SEASON_START` muda, e o conteúdo vira `content/season2026.ts` (calendário da temporada 2025–26). As datas oficiais de 2026 continuam iguais.
- Pré-temporada (nov–fev), como marcos de calendário com efeito:

| Quando | Marco | Efeito |
|---|---|---|
| 10/nov | Convite dos fundadores | Abertura (S2, C1) |
| nov | Processo seletivo | A seletiva que hoje acontece em mar–mai passa para cá |
| dez–jan | Etapa trainee | Novatos treinam (S2) |
| meados de dez a fev | Férias de verão | Horas por integrante baixam (muitos viajam). Valor **[PROPOSTA]** em `BALANCE` |
| 9/fev | Regulamento 2026 publicado | Libera a tarefa "Leitura do regulamento" e o projeto na Prancheta |
| 1/mar | Revisão 01 | Como hoje |

- Antes de 9/fev, a Prancheta mostra "Aguardando regulamento". Estudo, seletiva, trainee, captação e compras já são permitidos.
- Tarefa nova `read-regulation`: custa horas, dá conhecimento conceitual, e sem ela as mudanças de projeto têm risco maior de penalidade na inspeção (valor em `BALANCE`).
- `ACADEMIC_PERIODS` cobre nov/2025–nov/2026 (provas de nov e dez, férias de verão, carnaval, férias de julho).

### S2. Orientador, fundadores e presidente

- Sai o `Member` com `role: "president"` que representava o jogador. Entra `advisor: { name, reputation }` no estado. A reputação começa baixa e sobe com resultados (ainda sem efeito no Ano 1, só exibida).
- `Role` passa a ser `"president" | "captain" | "member" | "trainee"`. O presidente é um aluno comum (horas, área, carta) com um campo a mais: `agenda: "report" | "flight" | "funding" | "balanced"`.
- **Fundadores:** o estado inicial tem 3 ou 4 alunos com `look` e um conhecimento inicial baixo, cada um com uma "cara" (o que gosta de fazer). Nenhum começa capitão nem presidente.
- **Comando `{ type: "found-team", presidentId, captains: Record<Discipline, memberId> }`:** o jogador, como orientador, sugere quem preside e quem capitaneia o quê. É a eleição de fundação. Só é válido no estado `founding` (antes dele, o relógio fica pausado na abertura). O nome da equipe pode ser escolhido aqui (`teamName`).
- **Perfil do presidente** (leve, **[PROPOSTA]**):
  - Tarefas alinhadas com a `agenda` dão um bônus pequeno de motivação para a equipe.
  - Por 3 dias seguidos sem nenhuma tarefa da agenda, o presidente perde motivação.
  - Nada é bloqueado: o controle continua direto.
- **Trainee:** quem entra pela seletiva chega como `trainee`. Na etapa trainee (dez–jan), treinar vira tarefa (horas do trainee e de um capitão) e dá conhecimento. No fim da etapa, cada trainee vira `member` ou desiste, com chance pela motivação. A seletiva antiga de mar–mai deixa de existir no Ano 1.
- `rosterMembers` passa a incluir o presidente (agora é aluno). Leituras para o cabeçalho: `advisorView(state)` (nome, reputação) e `presidentView(state)` (nome, agenda, como o mês está para a agenda).

### S3. Calendário e ações agendadas

- Comando `{ type: "schedule-action", actionId, startAt, targetId?, dedication?, memberIds? }`: entra em `plannedActions` e vira tarefa sozinho no `startAt`. Se faltar gente, caixa ou pré-condição nessa hora, não começa e avisa.
- Comandos `reschedule-action { plannedId, startAt }` e `unschedule-action { plannedId }`.
- Leitura `calendarMonth(state, year, month)`: por dia, os marcos oficiais, o período acadêmico, as ações agendadas, os ensaios de voo agendados (Fase 5), as tarefas em andamento (com início e fim previstos) e os prazos de pedidos.
- Leitura `seasonOverview(state)`: os 13 meses da temporada com os marcos principais, para a faixa do topo do calendário.

### S4. Ajustes que a mudança de data exige

- Tudo o que usa `SEASON_START`, os testes de calendário e o `dev-start-competition` continuam funcionando com a data nova.
- O save da versão 6 é descartado.

## Cenas

### C1. Abertura: o convite

- `scenes/IntroScene.ts` (chave `"intro"`): a sala do orientador em isométrico, no mesmo estilo do hangar (mesa, estante, janela com o campus). Os fundadores entram (bonecos de `scenes/people/avatar.ts`), param em frente à mesa e cada um ganha um balão curto.
- A cena só anima. O texto e as escolhas vêm da UI (U2). Ela recebe a lista de fundadores com `look` e o índice de quem está falando.

## UI

### U1. Calendário

- Tela nova **Calendário** no menu (atalho `L`).
- No topo, a faixa da temporada (nov a nov) com os marcos.
- Embaixo, a grade do mês, no estilo do calendário anual do FIFA: dias com os marcos, o período acadêmico como cor de fundo e chips de ações agendadas, ensaios e tarefas.
- Arrastar um chip para outro dia chama `reschedule-action`. Clicar num dia vazio abre o catálogo para agendar ali.
- A Central ganha um resumo "Próximos 14 dias".

### U2. Abertura e fundação

- Fluxo em tela cheia antes do jogo, em 3 passos:
  1. **Convite:** cena C1 e o texto dos fundadores. Aceitar o convite.
  2. **Conhecer a turma:** a carta de cada fundador.
  3. **Fundar a equipe:** escolher o nome, o presidente e os capitães, e ver a agenda do presidente escolhido.
- Termina com `found-team`.
- "Novo jogo" passa por aqui.

### U3. Orientador e presidente

- O cabeçalho mostra "Prof. <nome>" com a reputação.
- O presidente aparece na escalação como qualquer aluno, com uma faixa "Presidente" e a agenda.
- A Central ganha um cartão do presidente: a agenda e como o mês está para ela.

### U4. Trainee e pré-temporada

- Na Equipe, os trainees ficam numa faixa própria, com o progresso do treinamento.
- A Prancheta mostra "Aguardando regulamento (9/fev)" até a publicação.
- O cartão da tarefa "Leitura do regulamento" ganha destaque nessa data.

## Verificação

- `npm run check` verde em cada frente.
- No navegador:
  - Novo jogo começando em 10/nov/2025 com a abertura completa.
  - Fundação com presidente e capitães.
  - Seletiva e etapa trainee.
  - Agendar uma ação no calendário, arrastá-la e vê-la começar sozinha.
  - Prancheta bloqueada até 9/fev.
  - Recarregar a página com ações agendadas (save).
