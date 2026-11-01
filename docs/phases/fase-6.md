# Fase 6: contrato e regras

Parte do [núcleo da arquitetura](../architecture.md). Nasce das notas do Henrique depois da Fase 5 (01/11/2026).

Escopo: o jogador vira **professor orientador**, a temporada começa em **novembro**, com a abertura dos fundadores, e entra o **calendário anual** no estilo FIFA, com ações agendadas. **Fora:** mapa da cidade para patrocínio (Fase 7), balanceamento e simulador de ano (por último), eleição de fim de ano e Ano 2.

`GameState.version` = **7** (relógio começa em nov/2025, sai o integrante "Você", entram orientador, perfil do presidente e ações agendadas). Saves de versão diferente são descartados.

## Decisões do Henrique

- O jogador é o **professor orientador**. Ele é permanente, ano após ano, como o técnico no modo carreira. Não é integrante: não tem horas, área nem carta.
- O **presidente é um aluno (NPC)**. Ele trabalha, ocupa uma área na escalação e tem um **perfil** que dá o tom do ano.
- **Abertura:** um grupo pequeno de alunos propõe criar a equipe e convida o jogador para orientar. O primeiro presidente sai desse grupo.
- **A temporada real** começa quando a competição anterior acaba, na 2ª semana de novembro: processo seletivo, etapa trainee, eleições e leitura do novo regulamento.

## Frentes

| Frente | Itens | Depende de |
|---|---|---|
| Simulação | S1–S4 | nada |
| Cenas | C1 | `MemberLook` (já existe) |
| UI | U1–U5 | Simulação e Cenas integradas |

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

### U5. Elenco como central do elenco (referência: Central do Elenco do modo carreira do FIFA)

Refaz a aba Elenco. Hoje ela é uma grade de cartões grandes; passa a ser:

- **Topo:** resumo da equipe, com a contagem por área e uma média geral num anel.
- **Abas:** **Status** (motivação, tarefa atual, turno, sobrecarga), **Conhecimento** (as 7 disciplinas em colunas), **Disponibilidade** (h/dia, aulas no semestre, formatura) e **Desenvolvimento** (evolução recente; vai receber preferências e facilidades na Fase 7).
- **Tabela à esquerda:** uma linha por aluno, com retrato pequeno (`Avatar.tsx`), nome, área e as colunas da aba. Ordenar clicando no cabeçalho. A linha selecionada fica destacada.
- **Painel à direita:** ficha do selecionado, com o nome grande, a área, a "nota" geral, os números da aba e o boneco **de corpo inteiro e grande** (mesma geometria de `avatar.ts`, em escala maior).
- Teclado: setas mudam a seleção.

Usa `rosterMembers`. O conhecimento documentado sai desta aba e vai para a Central ou para o Relatório.

## Verificação

- `npm run check` verde em cada frente.
- No navegador:
  - Novo jogo começando em 10/nov/2025 com a abertura completa.
  - Fundação com presidente e capitães.
  - Seletiva e etapa trainee.
  - Agendar uma ação no calendário, arrastá-la e vê-la começar sozinha.
  - Prancheta bloqueada até 9/fev.
  - Recarregar a página com ações agendadas (save).
