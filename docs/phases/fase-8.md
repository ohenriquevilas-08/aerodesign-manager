# Fase 8: contrato e regras

Parte do [núcleo da arquitetura](../architecture.md). Nasce do playtest da Fase 7 (01/11/2026).

Escopo: o coração do jogo (tarefas, pessoas e tempo). Tarefas sempre com gente e com resultado aos poucos, sem limite rígido de pessoas onde não faz sentido, energia por aluno, alunos que não vêm "determinados", tela de Ações por objetivo, escalação que cabe na tela e correções da abertura. **Fora:** lado business, mapa da cidade e árvore do orientador (Fase 9), balanceamento (por último).

`GameState.version` = **9** (tarefa ganha resultado parcial, integrante ganha energia, preferência e facilidade). Saves de versão diferente são descartados.

## Decisões do Henrique

- **Uma tarefa nunca fica parada sem gente.** Só começa com gente suficiente; quem entra fica ocupado até ela terminar ou o jogador encerrar.
- **O resultado sai aos poucos**, enquanto a tarefa roda. Encerrar antes fica com o parcial.
- **Sem limite rígido de pessoas** em tarefas de organização. Mais gente rende mais, com retorno decrescente. Limite só onde há espaço físico.
- **Aluno não vem determinado:** nada de afinidade inata clara. O que ele diz gostar pode estar errado; a facilidade aparece trabalhando.
- **Ações por objetivo**, mostrando o que faz sentido agora. Poluição não é liberdade de escolha.

## Frentes

| Frente | Itens | Depende de |
|---|---|---|
| Simulação | S1–S5 | nada |
| UI | U1–U5 | Simulação integrada |

Sem frente de Cenas nesta fase (só um ajuste de cor de cabelo, que vai junto com a Simulação). Ordem: Simulação, depois UI.

## Status

| Item | Estado |
|---|---|
| S1 tarefas sempre com gente (`memberIds`, `close-task`) | **feito** (branch de Simulação; falta revisão do Henrique e merge) |
| S2 resultado aos poucos (`yield`, `Task.yielded`, peça parcial) | **feito** |
| S3 sem limite rígido (`Crew.max` pode ser `null`, `crewEfficiency`) | **feito** |
| S4 energia por aluno (`Member.energy`) | **feito** |
| S5 alunos não determinados e correções | **feito** |
| U1–U5 UI | pendente (a UI atual só ganhou o ajuste mínimo para compilar) |

### Contrato como implementado (Simulação)

Valores e regras completos no design (§4.2, §5.1, §5.5, §8.3); números em `BALANCE` (`crew`, `energy`, `aptitude`, `yield`, `people`).

- **Comandos:** `start-action { …, memberIds }`; `close-task { taskId }` (substitui `cancel-task`, que saiu); `assign-member` segue para pôr mais gente (sem limite onde `max` é `null`); `unassign-member` recusa deixar a tarefa abaixo de `crew.min`.
- **Tipos:** `Crew.max` pode ser `null`; `ActionDef.yield: "continuous" | "milestones" | "at-end"`; `Task.yieldTotal` (quanto entrega ao todo, sorteado ao iniciar) e `Task.yielded`; `Part.partial?` (0–1); `Member.energy`, `statedLikes`, `likes`, `dislikes`, `aptitude`, `revealedAptitude`, `studyHours` (e os mesmos campos de preferência no `Candidate`); `workStreakHours` saiu. `GameState.version` = 9.
- **Leituras novas (todas por `src/sim/index.ts`):** `crewEfficiency(ação, n)`, `positionShare`, `taskKeeps(estado, tarefa)` (texto do que fica ao encerrar), `energyOutlook(estado, integrante)`, `energyFactor`, `isExhausted`, `isAptitudeRevealed`, `revealAptitude` (gancho da Fase 9), `APTITUDE_LABELS`, `DEFAULT_ADVISOR_NAME`.
- **Valores escolhidos:** extras além do ideal rendem 70%, 50%, 35%, 25%, 18%, 12%; energia gasta 5 por hora trabalhada (madrugada ×1,6 e ×2,2 depois da 1h; disciplina detestada ×1,4), recupera 0,5/h acordado e 1,5/h dormindo, ×1,5 no fim de semana; cansaço abaixo de 40, para sozinho abaixo de 15; facilidade 0,6/1/1,5, revelada com 10 horas na disciplina; conhecimento inicial 8 ± 3; declarado bate com o real em 60%; seletiva entrega a cada 25%, fabricação em terços.

### Desvios e decisões do contrato

- **Aprendizado hora a hora.** Conhecimento, fabricação, agilidade e pilotagem passaram a subir a cada passo do relógio (antes, na conclusão): é o que faz o parcial valer. Tarefa encerrada no meio mantém o que aprendeu, mesmo quando o resultado só sai no fim.
- **Divulgação sem sorteio no fim.** O total do alcance é sorteado ao iniciar (com a equipe escolhida) e entregue proporcional às horas; o sorteio na conclusão saiu. O mesmo vale para os inscritos da seletiva (`yieldTotal`).
- **`sleeping`/perder a manhã saiu** do turno da oficina, no lugar da energia. A escala ainda recusa madrugada e manhã seguinte da mesma pessoa (aviso ao montar), só não há mais o bloqueio automático.
- **Espera de calendário com horas.** A única ação com horas e prazo (`sponsor-pitch`) mantém a equipe escolhida ocupada durante a espera; as ações só com prazo (pedidos) não ocupam ninguém e não são tarefas.
- **`cancel-task` não é alias:** saiu. Encerrar apaga a tarefa e avisa na caixa de entrada; não fica no histórico de concluídas.
- **UI mínima:** o painel da ação passa `memberIds` e só libera "Iniciar" com o mínimo; o cartão da tarefa ganhou "Encerrar agora" com o texto do que fica. A tela de Ações por objetivo, a escalação, as barras de energia e as preferências são das frentes de UI (U1–U5).

## Simulação

Atualizar o design §4.2 (tarefas), §5 (equipe) e §8 (custos) junto.

### S1. Tarefas sempre com gente

- `start-action` exige `memberIds` com pelo menos `crew.min` pessoas livres. Não existe mais tarefa `idle`/"parada" por falta de gente.
- `unassign-member` recusa se deixar a tarefa abaixo do mínimo; o caminho é encerrar a tarefa.
- Comando novo `{ type: "close-task", taskId }`: encerra antes do fim, aplica o resultado parcial e libera a equipe. `cancel-task` sai (ou vira alias de `close-task`).
- Quem é desligado da equipe ou se forma sai da tarefa; se ela ficar abaixo do mínimo, encerra sozinha com o parcial e avisa.
- Tarefas com espera de calendário (`readyAt`, como pedidos ou cura de resina) continuam: a espera não ocupa gente.

### S2. Resultado aos poucos

- Cada ação declara como entrega: `yield: "continuous" | "milestones" | "at-end"`.
  - **continuous:** o efeito acontece proporcional às horas (alcance da divulgação, conhecimento do estudo, horas de capítulo do relatório).
  - **milestones:** entrega em marcos. Ex.: a seletiva traz candidatos a cada ~25% (os inscritos vão chegando); a fabricação avança a peça em etapas (corte, montagem, acabamento) e uma peça encerrada no meio fica como `partial` (não voa, mas pode ser terminada depois por uma nova tarefa com as horas restantes).
  - **at-end:** só no fim, onde não há parcial que faça sentido (ex.: ensaio de bancada, envio de pedido).
- `Task.yielded` guarda o que já foi entregue, para não entregar duas vezes. Teste: a soma do parcial mais o restante é igual ao resultado de rodar a tarefa até o fim.

### S3. Sem limite rígido de pessoas

- `Crew` passa a `{ min, ideal, max: number | null }`. `max: null` para organização (seletiva, divulgação, captação, estudo, relatório, documentação). Fabricação, laminação e bancada mantêm um `max` físico.
- Rendimento: até `ideal`, cada pessoa soma 100%; acima, cada pessoa extra rende menos (ex.: 70%, 50%, 35%...). Valores em `BALANCE`. Leitura `crewEfficiency(action, n)` para a UI mostrar o ganho de mais uma pessoa.

### S4. Energia por aluno

- `Member.energy` (0–100). Trabalhar gasta por hora; descansar, dormir e o fim de semana recuperam. A madrugada gasta mais, e quem virou a noite acorda com pouca energia (substitui "perde o turno da manhã" por uma consequência contínua).
- Rendimento e qualidade caem abaixo de ~40 de energia; abaixo de ~15 a pessoa para sozinha e a motivação cai. Substitui `workStreakHours` e a sobrecarga escondida.
- Leituras: energia atual, tendência (sobe/desce) e quando chega ao limite no ritmo atual. Valores em `BALANCE`, citados no design.
- Horas por dia continuam: disponibilidade × calendário acadêmico × motivação, agora também × energia.

### S5. Alunos não determinados e correções

- **Conhecimento inicial baixo e parecido** para todos (fundadores, candidatos, trainees), com variação pequena. Nada de "mais forte em X" com diferença grande.
- **Preferência declarada:** `Member.statedLikes: Discipline[]` (o que a pessoa diz gostar; 1–2 itens, pode ser vazio). **Preferência real:** `likes` / `dislikes` escondidos, que batem com o declarado só em parte (ex.: 60%). Fazer o que gosta de verdade sobe a motivação; o que detesta gasta mais energia.
- **Facilidade escondida:** `aptitude: Record<Discipline, "slow" | "normal" | "fast">`, que multiplica o ganho de conhecimento. Revelada depois de N horas na disciplina (`revealedAptitude`), com uma mensagem ("Enzo pegou rápido o cálculo de cargas").
- O texto dos fundadores troca afirmações por intenções ("Diz que quer mexer com aerodinâmica").
- **Orientador:** nome padrão masculino. **Cabelo:** sem cinza para alunos (ajustar a paleta de `src/scenes/people/sprite/`).
- Mais tarde a árvore do orientador (Fase 9) terá um ramo que revela preferência e facilidade mais cedo; deixar o campo de revelação pronto para isso.

## UI

### U1. Iniciar e encerrar tarefas

- O painel da ação escolhe as pessoas e só libera "Começar" com o mínimo. Mostra o ganho de cada pessoa a mais (`crewEfficiency`) e o resultado esperado.
- O cartão da tarefa mostra quem está nela (sem "+ pessoa" vazio), o percentual, quando termina, o que já entregou ("3 candidatos até agora") e o botão **Encerrar agora**, com o parcial que fica.

### U2. Ações por objetivo

- Grupos: **Equipe** (seletiva, trainee, documentação), **Divulgação**, **Projeto**, **Fabricação**, **Ensaios**, **Relatório**, **Captação**.
- Só aparece o que está disponível agora; o que destrava depois aparece apagado numa linha "Mais adiante" com o motivo ("depois do regulamento, 9/fev").
- Grupos recolhidos, com um resumo por grupo. Custo e equipe só no detalhe da ação. Busca por nome.
- Sai a divisão por tipo de custo e o "Alcance atual" solto no cabeçalho (vai para Divulgação).

### U3. Escalação na tela

- O avião e as vagas cabem na área visível, sem rolagem, em 1280 px ou mais.
- Além de arrastar: clicar na carta e depois na vaga (ou na vaga e escolher numa lista). Teclado também.

### U4. Energia e preferências

- Energia como barra em cartas, Elenco (coluna ordenável e na ficha) e escala da oficina.
- No Elenco: "Diz que gosta de", e a facilidade aparece só depois de revelada ("? " antes disso). Aba Desenvolvimento mostra as revelações.

### U5. Abertura

- Rótulo e nome padrão do orientador; textos dos fundadores como intenções.

## Verificação

- `npm run check` verde em cada frente.
- No navegador:
  - Tentar começar uma tarefa sem o mínimo (bloqueado).
  - Seletiva com 4 pessoas, candidatos chegando aos poucos, encerrar no meio e ficar com eles.
  - Fabricar e encerrar uma peça no meio (fica parcial), depois terminá-la.
  - Energia caindo numa semana pesada e voltando no fim de semana.
  - Tela de Ações em novembro sem fabricação; escalação inteira à vista em 1280 px.
  - Novo jogo com orientador de nome masculino e fundadores sem especialidade.
