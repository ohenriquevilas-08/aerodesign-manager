# Aerodesign Manager · Design do Ano 1 (fatia vertical)

> **Status:** rascunho v3 para revisão (31/10/2026), atualizado com o **Regulamento SAE BRASIL AeroDesign 2026 Rev01**, o modelo de custos (seção 8) e a lista de equipes (Apêndice A).
> Marcações: **[DECIDIDO]** = escolha confirmada pelo Henrique · **[PROPOSTA]** = sugestão do Claude, aguardando OK · **[ABERTO]** = precisa de decisão.

Este documento é o contrato de design da primeira fatia jogável: **a temporada de fundação, do primeiro dia da equipe até o fim da competição**. Tudo que for implementado na Fase 2 (simulação, interface, cenas) segue o que está aqui. O que não estiver aqui não entra no Ano 1.

---

## 1. Visão

**Fantasia:** você é presidente de uma equipe universitária de aerodesign recém-fundada e precisa formar gente, projetar, fabricar, ensaiar e levar um avião à competição nacional, sob regras que espelham as da SAE.

**Referências:** Football Manager / modo carreira do FIFA (gestão, calendário, inbox) · Into Space! (o voo como espetáculo) · Hero Zero / C.A.T.S (progresso visível, peças, montagem) · Habbo (o hangar como lugar vivo, com a equipe trabalhando) · Polytopia (clareza visual, leitura imediata).

**Pilares:**

1. **Fidelidade à SAE.** Calendário, prazos, pontuação e regras de voo espelham o regulamento real. Quem é de aerodesign deve reconhecer a própria temporada. **[DECIDIDO]**
2. **Pessoas importam tanto quanto o avião.** Profundidade equilibrada entre equipe, projeto e competição. **[DECIDIDO]**
3. **Incerteza é o recurso central.** A equipe nunca sabe o desempenho real do avião, só uma estimativa com margem de erro. Conhecimento e ensaios estreitam a margem, e a competição pontua exatamente isso (previsão de carga e de peso vazio). **[PROPOSTA]**
4. **Urgência.** O tempo corre sem parar; prazos se aproximam enquanto você decide. **[DECIDIDO]**
5. **Risco legível.** Toda decisão arriscada mostra a chance em linguagem clara (baixo/médio/alto). **[DECIDIDO]**
6. **Feito para notebook.** Mouse, teclado, telas de 1366×768 a 1920×1080. Sem celular. **[DECIDIDO]**

---

## 2. Mundo fictício, "ao máximo parecido" **[DECIDIDO: fictício e parecido]**

Nada usa marca real; tudo deve soar familiar para quem é do meio.

| Real | No jogo |
|---|---|
| SAE BRASIL | **Aerodesign Brasil** (organizadora) **[DECIDIDO]** |
| Competição SAE BRASIL AeroDesign | **Competição Aerodesign Brasil** **[DECIDIDO]** |
| Comissão Técnica (CT) | Comissão Técnica (CT) |
| Portal aeroct | **Portal da CT** (dentro do jogo, onde se entregam relatório, vídeo e previsões) |
| DCTA, São José dos Campos | **CTAe, São José dos Campos** (taxiway do Centro Técnico Aeroespacial) |
| Classes Regular, Advanced, Micro | iguais |

### 2.1 Equipes rivais **[DECIDIDO: nomes parecidos com os reais]**

O **Apêndice A** traz as 61 equipes do jogo, uma paródia para cada equipe da lista real de inscritas (fornecida pelo Henrique). Regras da paródia:

- **Mesmo espírito do nome:** ave vira ave parecida (Tucano → Tucanuçu), regionalismo vira regionalismo (Uai, sô! Fly!!! → Uai, Sô! Voa!!!), mitologia vira mitologia (Zeus → Apolo), inglês vira inglês (Keep Flying → Keep Climbing).
- **Instituição fictícia, mesma cidade e estado:** a cidade é real; a universidade não (USP → UESP, ITA → ITAe, UFU → UFTri).
- **Mesmo tipo de instituição:** federal continua federal, instituto federal continua IF, privada continua privada, estrangeira continua estrangeira.
- Exibição no jogo: **"Tucanuçu · UFTri"**.

**Campo da Classe Regular no Ano 1:** ~30 equipes sorteadas do Apêndice A (as estrangeiras ficam para a carreira). **[PROPOSTA]**

**Rivais de destaque (4 ou 5):** têm filosofia, história e personalidade (aproveitando o sistema de filosofias do jogo atual). **[PROPOSTA]**

| Arquétipo | Equipe |
|---|---|
| A tradicional, multicampeã | EESC-UESP Alfa |
| A que aposta tudo em carga | Uai, Sô! Voa!!! |
| A obcecada por relatório | Keep Climbing |
| A do instituto de aeronáutica, técnica e fria | Monteverde |
| A novata ambiciosa (como você) | Gigazord AeroDesign |

---

## 3. Regulamento de referência: 2026, Classe Regular

Base: **Regulamento SAE BRASIL AeroDesign 2026 Rev01** (cap. 7, 10 e 11; Apêndices 4, 6 e 8). O Ano 1 usa os valores de 2026 sem alteração. Nos anos seguintes, o regulamento anual do jogo varia coeficientes, como na vida real.

- **Classe do Ano 1:** só Regular. **[PROPOSTA]**

### 3.1 Restrições da Classe Regular (2026)

| Regra | Valor | Se violar |
|---|---|---|
| Envergadura (B) | ≤ 4,0 m | `PD = 100 × excesso` (+20 se excesso > 5 cm), por bateria |
| Potência de pico em voo (P) | ≤ 600 W, motor elétrico | `PP = 0,5 × excesso em W`, por bateria |
| Altura (H) | sem limite | Se romper a fita do obstáculo numa decolagem abortada, voo inválido e perde as próximas tentativas |
| Peso máximo de decolagem | 20 kg (vazio + carga) | Carga acima disso não conta |
| Decolagem válida | passar obstáculo de **0,9 m** a **55 m** do início da corrida | Voo inválido |
| Voo válido | carga ≥ 5,0 kg e pontuação da bateria > 0 | Voo inválido |

A mudança grande de 2026: **não existe mais a fórmula de "custo"** de 2024. O compromisso de projeto agora está dentro da pontuação: eficiência estrutural, número de superfícies e envergadura (seção 9.3).

---

## 4. Tempo: tempo corrido **[DECIDIDO]**

### 4.1 Relógio contínuo

Não há turnos. O tempo corre como em jogos de gestão em tempo real (Two Point Hospital, Football Manager em "jogo ao vivo"):

- Controles: **⏸ pausa · ▶ 1× · ▶▶ 2× · ▶▶▶ 4×** (barra de espaço pausa).
- **Pausa automática** em eventos importantes (configurável): peça quebrou, ensaio terminou, prazo a 7 dias, alguém pediu para sair.
- Escala **[PROPOSTA]**: em 1×, **1 dia de jogo ≈ 10 segundos**. Fevereiro a outubro (~250 dias) dá ~40 min em 1×; acelerando nos períodos calmos, o Ano 1 completo (com competição) fica nos 60–90 min.
- Prazos aparecem como **contagem regressiva**: `Relatório: 12d 04h`.

### 4.2 Trabalho como tarefas em andamento

Todo trabalho é uma **tarefa com duração em horas-pessoa** que avança em tempo real conforme quem está alocado nela:

```
Fabricar asa (v1)       ████████░░░░  64%   Ana, Caio      ~3d restantes
Capítulo Aerodinâmica   ███░░░░░░░░░  25%   Bia            ~6d restantes
Rifa de março           ██████████░░  85%   Davi           +420 cr
```

- Cada integrante tem **horas disponíveis por dia** = disponibilidade × calendário acadêmico × motivação.
- O jogador monta a fila de tarefas e aloca gente; as barras andam sozinhas. No hangar (cena), dá para ver as pessoas trabalhando em cada bancada.
- Gente sem tarefa desmotiva. Gente sobrecarregada também.
- Isso substitui as "ações flexíveis" da premissa 3B: o volume de trabalho depende da equipe, não de um limite de ações.

### 4.3 Calendário oficial 2026

| Data | Marco | Efeito no jogo |
|---|---|---|
| 9/fev | Regulamento publicado (Rev00) | Começa a temporada |
| 1/mar | Revisão 01 do regulamento | Evento: "Errata publicada" |
| Mar–mai | Seletiva da equipe | Evento de fundação (seção 5.2) |
| **16/ago** | **Relatório, plantas, peso vazio previsto e reta de previsão de carga** | Congela as previsões que valem na competição |
| 23/ago | Prazo final do relatório, com penalidade | Atrasar custa pontos |
| 13/set | Cronograma da apresentação oral | Informativo |
| **27/set** | **Vídeo de voo** · alterações de projeto · matrícula · cadastro do piloto | Sem vídeo válido, não voa na competição |
| 4/out | Lista preliminar de aviões aprovados | Confirma participação |
| **17/out** | **Apresentação oral (online)** | 40 pontos |
| Fim de out / nov | Exposição (quinta-feira) + competição de voo | Clímax (seção 9) |

O regulamento 2026 deixa a data da competição "a definir". No jogo, fixamos **a semana seguinte à apresentação oral**. **[PROPOSTA]**

O prazo do vídeo de voo é o grande divisor: **até o fim de setembro o avião oficial precisa ter voado de verdade.** Isso cria o ritmo natural da temporada (projeto → protótipo → avião oficial → voo filmado) sem etapas artificiais.

### 4.4 Calendário acadêmico genérico **[DECIDIDO: genérico]**

| Período | Horas por integrante |
|---|---|
| Aulas normais | 100% |
| Semanas de provas (meados de abr, jun, set, nov) | 40% |
| Férias de julho | 160% (é quando as equipes reais fabricam) |
| Carnaval, feriados | 70% |

---

## 5. Equipe

### 5.1 Integrantes **[PROPOSTA]**

| Atributo | Faixa | Uso |
|---|---|---|
| Função | Presidente, capitão, membro | Capitães recomendam e lideram a frente |
| Conhecimento por disciplina | 0–100 (tácito) | Qualidade do trabalho e do capítulo do relatório |
| Fabricação | 0–100 | Qualidade e velocidade na oficina |
| Pilotagem | 0–100 | Só para quem pilota; afeta risco no voo |
| Agilidade | 0–100 | Retirada rápida de carga (até 2 pessoas) |
| Motivação | Baixa → Alta | Multiplica horas e qualidade |
| Disponibilidade | h/dia | Base das horas |
| Período / formatura | semestre | Define quando sai da equipe |

**Disciplinas** = as do relatório 2026: Projeto conceitual e preliminar · Aerodinâmica · Desempenho · Estabilidade e controle · Cargas e aeroelasticidade · Estruturas e ensaios estruturais · Projeto elétrico e safety assessment. Usar as disciplinas reais amarra equipe, projeto e nota do relatório num único eixo.

**Piloto:** piloto próprio (treina nos ensaios, conhece o avião) ou piloto da CT (nível fixo, não conhece o avião), como na regra real. O cadastro vence em 27/set.

### 5.2 Seletiva de fundação **[DECIDIDO]**

Começa com presidente + capitão de Aerodinâmica + capitão de Estruturas. A seletiva é o primeiro evento: escolha de formato (ampla, técnica, por indicação, desafio prático), pareceres dos capitães, convites gratuitos. Elenco mínimo para o projeto: Aerodinâmica, Estruturas e uma terceira pessoa (elétrica, fabricação ou relatório).

### 5.3 Conhecimento: tácito vs documentado **[DECIDIDO]**

- **Tácito:** vive na pessoa. Cresce trabalhando na disciplina e participando de ensaios. Sai com ela.
- **Documentado (da equipe):** vive no acervo. É o **piso** de conhecimento de qualquer integrante naquela disciplina.
- **Documentar** (tarefa, custa horas) converte parte do tácito de alguém em documentado e adianta o capítulo correspondente do relatório.
- **Mentoria** (veterano + novato) transfere tácito direto entre pessoas: mais rápido que documentar, mas só para uma pessoa.
- Na tela da equipe, quem vai sair mostra **"conhecimento em risco"**.

### 5.4 Liderança e delegação **[DECIDIDO como princípio; mecânicas em PROPOSTA]**

O presidente não fabrica nem calcula: coordena. Gerir a equipe é o mesmo problema de qualquer grupo trabalhando em paralelo: **fazer muita gente produzir ao mesmo tempo sem perder a coerência do avião.** Quatro princípios guiam as mecânicas:

1. **Delegar com instrução, não só alocar.** Ao iniciar uma tarefa, o presidente escolhe quem lidera e a **dedicação** (rápido, normal, caprichado). Instrução vaga sai rápido e com mais variância; instrução caprichada custa horas e reduz o erro.
2. **Dependências visíveis.** Algumas tarefas só começam quando outras terminam (fabricar a asa depende do projeto aerodinâmico; o relatório de Estruturas depende do ensaio estrutural). Adiantar o que tem dependência é possível, mas o que for feito sobre base não confirmada pode virar retrabalho.
3. **Integração é um evento.** Montar o protótipo ou o avião oficial junta peças feitas por pessoas diferentes e pode revelar incompatibilidades (encaixe, peso acima do previsto, CG fora). A chance cai com o conhecimento documentado e com quem conhece o conjunto (capitão de projeto conceitual).
4. **A atenção do presidente é um recurso.** Pedidos de decisão (aprovar compra, escolher candidato, autorizar ensaio arriscado) chegam pela caixa de entrada; enquanto não são respondidos, a tarefa espera. A pausa automática já cobre os pedidos urgentes.

**Teste de validade:** toda mecânica que sai destes princípios precisa ser reconhecível por quem já foi de equipe de aerodesign. Se só fizer sentido como metáfora de gestão de projetos, fica de fora. O tema do jogo é aerodesign e pessoas, não gestão.

---

## 6. Projeto da aeronave **[PROPOSTA]**

### 6.1 Decisões de projeto (a prancheta)

| Decisão | Opções | Compromisso (regras 2026) |
|---|---|---|
| Envergadura (b) | 1,5 a 4,0 m | Mais sustentação e carga ↔ pontuação multiplicada por `1,15^(−b)` (2 m: ×0,76 · 3 m: ×0,66 · 4 m: ×0,57) |
| Superfícies sustentadoras (N) | 1 (asa voadora) · 2 (convencional) · 3 (três superfícies) | Multiplicador `0,185N² − 0,775N + 1,81`: N=1 ×1,22 · N=2 ×1,00 · N=3 ×1,15. Asa voadora pontua mais mas é difícil de estabilizar e carregar; N=3 exige que a terceira superfície tenha função real |
| Potência (P) | 300 a 600 W | Decolagem antes dos 55 m ↔ bateria e peso |
| Filosofia | Alta carga · Leve · Estável | Equivalente aos "conceitos" do jogo atual |
| Materiais | Balsa · Compósito · Misto | Peso vazio ↔ custo ↔ dificuldade de fabricação |
| Altura do trem | Baixo · Alto | Altura livre em 2026, mas avião alto rompe a fita se abortar a decolagem |

A prancheta mostra ao vivo o **multiplicador de pontuação** da configuração e a estimativa de desempenho. Com 2026 pontuando **eficiência estrutural (carga ÷ peso vazio)**, avião leve vale tanto quanto avião que carrega muito.

### 6.2 Valores reais vs estimados (o coração do jogo)

Cada avião tem valores **reais e escondidos**: peso vazio, carga máxima em função da altitude densidade, distância de decolagem e confiabilidade. A equipe vê **estimativas com margem de erro**:

```
Carga máxima estimada (alt. densidade 900 m):  11,8 kg ± 2,1 kg
Peso vazio estimado:                             3,4 kg ± 0,4 kg
Eficiência estrutural estimada:                  3,5   ± 0,7
```

- A margem diminui com **conhecimento** (Aerodinâmica e Desempenho → carga; Estruturas → peso vazio) e, muito mais, com **ensaios** (seção 7).
- No prazo do relatório (16/ago) a equipe **congela** no Portal da CT:
  - o **peso vazio previsto** (vira o FPV);
  - a **reta de previsão de carga** `carga = a × altitude densidade + b`, com patamar máximo opcional, exatamente como a regra 11.6 (vira o PAC).
- O jogo desenha essa reta com base nas estimativas da equipe; o jogador pode ajustá-la (ser conservador ou agressivo).

### 6.3 Fases físicas do avião

Protótipo (barato, pode ser incompleto) → avião oficial (o que compete) → reparos e alterações. Alterações comunicadas até 27/set têm penalidade menor; depois disso, maior (regra real).

---

## 7. Fabricação, peças e ensaios

### 7.1 Peças **[PROPOSTA]**

Asa · Fuselagem e compartimento de carga · Empenagem / superfícies · Trem de pouso · Grupo motopropulsor (motor, hélice, ESC) · Eletrônica (servos, receptor, baterias, wattímetro).

Cada peça tem qualidade de fabricação (quem fabricou, material, equipamento) e condição.

### 7.2 Estados visíveis **[DECIDIDO]**

Internamente, condição de 0 a 100. Na tela:

| Estado | Condição | Efeito |
|---|---|---|
| Nova | 80–100 | — |
| Desgastada | 50–79 | Risco de quebra médio |
| Danificada | 20–49 | Risco alto; reparo recomendado |
| Quebrada | 0–19 | Não voa; substituir |

**Reparar** custa horas e créditos e recupera parte da condição. **Substituir** custa a fabricação inteira. Reparo em peça primária sem notificar a CT gera penalidade na competição (Apêndice 6).

### 7.3 Ensaios **[PROPOSTA]**

| Ensaio | Reduz incerteza de | Risco |
|---|---|---|
| Estrutural de bancada (asa carregada) | Peso vazio, limite estrutural | Quebrar a asa de teste |
| Motor e hélice em bancada | Tração, potência de pico | Baixo |
| Voo de protótipo | Estabilidade, decolagem | Dano / queda |
| Voo com carga incremental | Carga máxima (pontos da reta de previsão) | Dano / queda, cresce com a carga |
| Treino de retirada de carga | Tempo de retirada | Nenhum |
| Voo filmado (vídeo oficial) | — | Obrigatório até 27/set |

Cada ensaio gera **conhecimento tácito** para quem participou, desgasta as peças usadas e pode danificá-las ou quebrá-las. Ensaios em dias diferentes (frio/calor) dão pontos em altitudes densidade diferentes e melhoram a reta de previsão. Equipamentos (balança, bancada, telemetria) aumentam o aprendizado e reduzem o risco.

---

## 8. Custos: tempo, dinheiro ou os dois **[DECIDIDO: separar bem]**

### 8.1 As três moedas

Toda ação do jogo mostra o que custa, sempre com os mesmos ícones e na mesma ordem:

| Moeda | Ícone | O que é | De onde vem |
|---|---|---|---|
| **Horas** | ⏱ | Horas-pessoa da equipe. Recurso que se renova todo dia, mas se perde se não for usado | Integrantes × disponibilidade × calendário acadêmico × motivação |
| **Créditos** | ◆ | Dinheiro do caixa. Acumula | Captação, prêmios |
| **Prazo** | ⌛ | Espera no calendário **sem ocupar ninguém** (entrega de compra, cura de resina, resposta de patrocinador) | — |

E um custo que não é moeda, mas aparece no mesmo cartão:

| Consequência | Ícone | O que é |
|---|---|---|
| **Desgaste / risco** | ⚠ | Condição das peças que se perde e chance de dano ou quebra |

A distinção entre **horas** e **prazo** é a que mais importa para a sensação de urgência: comprar um motor não ocupa ninguém, mas leva 10 dias para chegar; fabricar uma asa não espera entrega, mas ocupa duas pessoas por uma semana. Os dois atrasam o avião, de jeitos diferentes, e o jogador precisa ver isso de relance.

Exemplo de cartão de ação:

```
Fabricar asa (balsa)       ⏱ 60 h   ◆ 180   ⌛ —      ⚠ —
Comprar motor 600 W        ⏱ —      ◆ 420   ⌛ 10 d   ⚠ —
Voo com carga incremental  ⏱ 12 h   ◆ 30    ⌛ —      ⚠ médio
```

### 8.2 Classificação das ações **[PROPOSTA]**

**Só horas ⏱**

| Ação | Observação |
|---|---|
| Seletiva e entrevistas | Divulgação orgânica é grátis |
| Estudo/projeto por disciplina | Gera conhecimento tácito e reduz incerteza |
| Escrever capítulo do relatório, plantas | |
| Documentar conhecimento, mentoria | |
| Ensaio de apresentação oral | |
| Treino de retirada de carga | |
| Ensaio de bancada com peças já existentes | Desgasta peças ⚠ |
| Captação: rifa, campanha, contato com patrocinador | **Gasta horas para gerar créditos**; patrocínio também tem ⌛ até a resposta |

**Só créditos ◆ (quase sempre com prazo ⌛)**

| Ação | Observação |
|---|---|
| Comprar componentes comerciais (motor, ESC, hélice, servos, receptor, baterias, wattímetro) | ⌛ de entrega; servos precisam ser comerciais pela regra real |
| Comprar equipamento (balança, bancada, gabaritos, telemetria) | ⌛ de entrega; efeito permanente |
| Comprar material em estoque (balsa, fibra, resina) | ⌛ de entrega; consumido depois na fabricação |
| Inscrição na competição | Prazo fixo do calendário |
| Frete expresso | Troca ◆ por menos ⌛: a válvula de escape da urgência |

**Horas + créditos ⏱◆**

| Ação | Observação |
|---|---|
| Fabricar peça | Consome material do estoque + horas de fabricação |
| Montar protótipo / avião oficial | Horas de integração + itens de consumo |
| Reparar peça | Mais barato que substituir, recupera só parte da condição |
| Voo de ensaio | Horas de equipe em campo + deslocamento; ⚠ desgaste e risco |
| Voo filmado (vídeo oficial) | Igual ao voo de ensaio, com mais pressão |
| Viagem para a competição | Créditos de viagem + a equipe fica dedicada ao evento |

### 8.3 Regras gerais **[DECIDIDO]** (ver ESPECIFICACAO_ANO_1)

- Caixa inicial: **0 créditos**. As primeiras ações possíveis são as "só horas", incluindo captação.
- Seletiva, contratação e divulgação orgânica: grátis.
- **Captação de contingência** só abre depois de dano grave ou quebra.
- Nada compra atributo diretamente. Créditos compram coisas; horas fazem coisas.

Valores numéricos ficam para o balanceamento (testados no protótipo).

### 8.4 Compras pela internet do jogo **[PROPOSTA]**

Comprar não é um botão "Comprar motor": é abrir o **navegador do jogo** e escolher onde comprar, como os sites dentro do celular do GTA V. Cada loja é uma paródia de onde as equipes reais compram, com identidade visual própria (logo, cores, tom do texto) e o mesmo produto custando, demorando e falhando de jeitos diferentes. Quem já esperou um motor importado travado na alfândega a duas semanas do vídeo de voo vai reconhecer.

**Lojas:**

| Loja no jogo | Inspirada em | Vende | Preço | Prazo ⌛ | Risco |
|---|---|---|---|---|---|
| **HobbyKong** | HobbyKing | Motores, ESC, hélices, baterias, servos | Baixo | Longo (importação) | Taxação e retenção na alfândega; qualidade média |
| **AliExpresso** | AliExpress | Tudo, inclusive eletrônica genérica | Muito baixo | Muito longo, espalhado | Peça fora da especificação; servo "comercial" falsificado |
| **Mercado Solto** | Mercado Livre | Revendedores nacionais | Médio | Curto a médio | Depende da reputação do vendedor (estrelas) |
| **Hangar do Aeromodelista** | Lojas nacionais de aeromodelismo | Componentes originais, equipamento | Alto | Curto | Baixo; às vezes sem estoque |
| **Balsa Leve Madeiras** | Fornecedores de balsa | Balsa por densidade (leve, média, dura) | Médio | Médio | Lote leve é mais leve e mais frágil |
| **Compósitos do Vale** | Fornecedores de fibra e resina | Fibra de carbono, fibra de vidro, resina | Alto | Médio | Resina vence se ficar parada |
| **Desapega Aero** | OLX / grupos de veteranos | Peças usadas de equipes que se formaram | Muito baixo | Curto (retirada) | Condição desconhecida até chegar |

**Como funciona:**

- **Mesmo produto, várias lojas.** O motor de 600 W existe na HobbyKong, no AliExpresso e no Hangar do Aeromodelista. O jogador compara preço ◆, prazo ⌛ e risco ⚠ e decide. É o mesmo cartão de custo da seção 8.1, só que agora a escolha é onde comprar.
- **Prazo é faixa, nunca data.** A loja promete "chega em 12–20 dias"; o real é sorteado (regra "nada é garantido" da simulação). Importados têm faixa mais larga.
- **Frete é escolha do checkout.** Normal ou expresso, por loja (loja nacional tem expresso barato; importação quase não tem). Substitui a ação genérica "Frete expresso".
- **Rastreio pela caixa de entrada.** "Pedido enviado", "Retido na fiscalização: pague ◆ 180 de imposto", "Saiu para entrega". Na entrega, a peça aparece no hangar.
- **Qualidade de origem.** Peça comprada também tem qualidade (como a fabricada). Loja barata = mais variação. A equipe só descobre ao receber, e mais cedo se tiver balança ou bancada de motor.
- **Regra real amarrada:** servo precisa ser comercial. Servo falsificado do AliExpresso pode reprovar na inspeção de segurança (seção 9.2).
- **Estoque e promoções.** Itens esgotam e voltam; a HobbyKong tem promoção relâmpago de vez em quando. Cria a pergunta "compro agora ou espero?".
- **Avaliações como risco legível.** Estrelas e comentários de outras equipes (paródia) mostram o risco em linguagem clara, como pede o pilar 5.

**Fica de fora do Ano 1:** câmbio do dólar variando, vender peças no Desapega, patrocínio em produto (desconto numa loja).

---

## 9. A competição (o clímax)

Dois blocos, como na regra real: **Competição de Projeto** e **Competição de Voo**.

### 9.1 Competição de Projeto: 225 pontos

| Item | Máximo |
|---|---|
| Projeto conceitual e preliminar | 30 (20 relatório + 10 plantas) |
| Aerodinâmica | 25 |
| Desempenho | 25 |
| Estabilidade e controle | 25 |
| Cargas e aeroelasticidade | 25 |
| Estruturas e ensaios estruturais | 30 (20 + 10) |
| Projeto elétrico e safety assessment | 25 |
| **Relatório + plantas (NR)** | **185** |
| Apresentação oral (online, 17/out) | 40 |

A nota de cada capítulo depende de **conhecimento documentado + horas investidas + ensaios citados**. A apresentação depende de quem apresenta e de ensaios de apresentação. **[PROPOSTA]**

### 9.2 Inspeção de segurança **[PROPOSTA]**

Checklist com itens reais simplificados (fixação da carga, cablagem, servos comerciais, arm plug, identificação). Itens reprovados exigem correção na hora, com o relógio correndo e a fila andando. Pode impedir de voar.

### 9.3 Baterias de voo: fórmulas reais da Classe Regular 2026

Por bateria:

```
EE   = CP / PV                                   (eficiência estrutural)
PEE  = 50 × EE
FPV  = 1,10 − 15 × ((PVprevisto − PVreal) / PVprevisto)²      mínimo 0,80
FPR  = min(1,00 ; 0,50 + 0,75 × NR / 185)        (o relatório multiplica o voo!)
PVOO = FPV × FPR × PEE × (0,185N² − 0,775N + 1,81) × 1,15^(−b)
PAC  = max(0 ; 30 − 830 × |(CPprevista − CPreal) / CPprevista|^1,75)
       CPprevista = reta de previsão avaliada na altitude densidade do momento
BPO  = 2,0 × EE           (parou dentro da pista)
BRC  = 20 se t ≤ 20 s ;  max(0 ; 20 − 6,324 × √(t − 20)) se t > 20 s
Bateria = PVOO + PAC + BPO + BRC − PD − PP
```

Uma vez na competição:

```
BCF = max(0 ; 20 × [1 − (5 × (PB1 − PB2) / PB1)²])     (duas boas baterias parecidas)
```

Vale a **melhor bateria** + BCF + Competição de Projeto − penalidades acumuladas.

Nota de leitura: no PDF, a fórmula do BRC aparece como `√t − 20`; a forma `√(t − 20)` é a única contínua em t = 20 s e zera exatamente em 30 s (20 ÷ √10 = 6,324), então é a adotada.

**Altitude densidade** (Apêndice 4), divulgada pela CT ao longo do dia:

```
Hρ = (T0 / 0,0065) × [1 − ((Plocal/P0) / (Tlocal/T0))^0,234959]
T0 = 288,15 K · P0 = 1013,25 hPa
```

**Classificação para as baterias** (Tabela 10.1, Regular): baterias 1 a 3 abertas; da 4ª em diante, ter voo válido com **EE ≥ 2,5 / 3,0 / 3,5 / 4,0** ou estar entre as 10 primeiras, com mínimo de 25 / 20 / 15 / 15 equipes.

### 9.4 A decisão de cada bateria (o momento "Into Space")

Tudo acontece com o relógio correndo. A fila anda, o sol sobe, o ar fica menos denso. Antes de cada bateria o jogador vê:

- a **altitude densidade** do momento (manhã fria = ar denso = mais carga; tarde quente = menos);
- a estimativa de carga máxima **para essas condições**, com a margem de erro da equipe;
- o valor da sua reta de previsão nesse ponto (o PAC pune quem se afasta dela);
- o estado das peças.

E escolhe **quanta carga colocar**. Na fila, pode revisar a carga desde que haja pelo menos 3 equipes à frente (regra real R[10.1.5.3]); depois disso, é aquilo.

O voo é uma cena: corrida → obstáculo de 0,9 m aos 55 m → circuito padrão → pouso → **retirada rápida de carga cronometrada** (quadrado de 3×3 m, até duas pessoas). A física por trás é simplificada; a tensão é real.

Resultados possíveis: voo válido · não passou o obstáculo (inválido) · rompeu a fita · pouso fora da pista (sem BPO) · dano · queda (peças danificadas ou quebradas, talvez sem avião para a próxima bateria). Entre baterias, a equipe pode reparar no hangarete, com o relógio correndo.

---

## 10. Metas de estreia **[DECIDIDO]**

1. Realizar a seletiva e formar um núcleo funcional.
2. Construir e ensaiar pelo menos um protótipo.
3. Fabricar o avião oficial dentro do regulamento e entregar o vídeo de voo.
4. Completar pelo menos um voo válido na competição.
5. Bônus: ficar no top 10 da Classe Regular. **[PROPOSTA]**

---

## 11. Telas (notebook) **[PROPOSTA]**

| Tela | Tipo | Conteúdo |
|---|---|---|
| Central | Painel | Relógio e controles de velocidade, calendário com contagens regressivas, inbox (recados dos capitães, comunicados da CT) |
| Equipe | Painel | Elenco, alocação, conhecimento por disciplina, seletiva |
| Prancheta | Painel | Decisões de projeto, multiplicadores de pontuação, estimativas com margem |
| Hangar | **Cena (Phaser)** | Oficina isométrica; integrantes trabalhando nas bancadas; tarefas e peças com barras de progresso e estados |
| Ensaios | Cena + painel | Escolher ensaio, ver acontecer, pontos da reta de previsão |
| Relatório | Painel | Capítulos por disciplina, nota estimada, reta de previsão e peso vazio a congelar |
| Finanças | Painel | Caixa, captação, gastos |
| Navegador | Painel (abas de sites) | Lojas da seção 8.4, cada uma com visual próprio: vitrine, carrinho, checkout, rastreio de pedidos |
| Regulamento | Painel | Regras do ano em linguagem acessível + aba **"Como é pontuado"** com as fórmulas reais **[DECIDIDO]** |
| Competição | **Cena (Phaser)** + painel | Pista, fila, altitude densidade ao vivo, escolha de carga, voo, placar |

Direção visual: imagens geradas pelo Gemini (painel escuro, ciano e laranja, ícones circulares).

---

## 12. Fora do escopo do Ano 1

- Classes Advanced e Micro.
- Anos 2 a 5 (sucessão, conhecimento entre anos, peças reaproveitadas, Torneio de Acesso).
- Balanceamento numérico final.
- Física de voo real: a simulação é plausível, não exata.
- Som, música, outros idiomas.
- Save com migrações (save incompatível é descartado durante o protótipo).

---

## 13. Decisões

### Fechadas em 31/10/2026

| # | Decisão |
|---|---|
| 1 | Mundo fictício, o mais parecido possível com o real |
| 2 | Calendário acadêmico genérico |
| 3 | ~30 equipes na Regular, 4–5 de destaque, nomes no padrão dos reais |
| 4 | Fórmulas reais visíveis na aba "Como é pontuado" |
| 5 | Tempo corrido com pausa e velocidades, não turnos |
| 6 | Prancheta com parâmetros reais (agora os de 2026: b, N, P) |
| 7 | Regulamento de referência: 2026 Rev01 |
| 8 | Organizadora e competição se chamam **Aerodesign Brasil** |
| 9 | Equipe nova **entra direto** na competição no Ano 1; Torneio de Acesso fica para a carreira |
| 10 | Escala de tempo (1 dia ≈ 10 s em 1×) será testada no protótipo |
| 11 | Custos separados em horas, créditos e prazo, com desgaste/risco à parte (seção 8) |

### Ainda abertas

Nenhuma bloqueante. Os itens marcados **[PROPOSTA]** valem como decididos até que o Henrique peça mudança.

---

## Fontes

- Regulamento SAE BRASIL AeroDesign 2026 Rev01 (PDF fornecido pelo Henrique): seções 7.2, 7.6, 7.7, 7.8, 10.1.5, 10.1.12, 10.2, 11.1, 11.6, 11.11; Apêndices 4 e 8.
- Regulamento SAE BRASIL AeroDesign 2024 Rev00 (comparação): https://saebrasil.org.br/wp-content/uploads/2023/05/Regulamento_SAE_BRASIL_AeroDesign_2024_Rev00.pdf
- Nomes de equipes reais citados como padrão: matérias públicas sobre a competição (Tucano, Uai-Sô-Fly, Falcons, Draco Volans, EESC Open, Axe Fly).
- Premissas e especificação do protótipo: `Aerodesign-Simulation/PREMISSAS_DO_JOGO.md`, `Aerodesign-Simulation/ESPECIFICACAO_ANO_1.md`.
- Lista de equipes inscritas (61 equipes), fornecida pelo Henrique: base do Apêndice A.

---

## Apêndice A · Equipes do jogo

Uma paródia por equipe real. A coluna "Inspirada em" é só para referência de design e **não aparece no jogo**. Cidades e estados são reais; instituições são fictícias (antes de publicar, conferir se alguma sigla coincidiu com instituição real).

| Nº | Equipe no jogo | Instituição fictícia (sigla) | Cidade / UF | Inspirada em |
|---|---|---|---|---|
| 1 | EESC-UESP Alfa | Universidade Estadual de São Paulo – Escola de Engenharia de São Carlos (EESC-UESP) | São Carlos / SP | EESC-USP Alpha |
| 2 | Axé Voa | Universidade Federal de Salvador (UFSal) | Salvador / BA | Axé Fly |
| 3 | Uiraí AeroDesign | Instituto Federal de Engenharia de Itajubá (IFEI) | Itajubá / MG | Uirá AeroDesign |
| 4 | Uai, Sô! Voa!!! AeroDesign | Universidade Federal das Gerais (UFGe) | Belo Horizonte / MG | Uai, sô! Fly!!! |
| 5 | AeroFEGu | Universidade Estadual Paulista Prof. Mesquita – Fac. de Eng. de Guaratinguetá (FEG-UEPM) | Guaratinguetá / SP | AeroFEG |
| 6 | Keep Climbing | Universidade Estadual de São Paulo – Escola Politécnica (Poli-UESP) | São Paulo / SP | Keep Flying |
| 7 | Monteverde | Instituto Técnico de Aeronáutica (ITAe) | São José dos Campos / SP | Montenegro |
| 8 | Tucanuçu | Universidade Federal do Triângulo (UFTri) | Uberlândia / MG | Tucano |
| 9 | Hawks AeroDesign | Centro Universitário de Sorocaba (CEUSO) | Sorocaba / SP | Falcons AeroDesign |
| 10 | CEFETA AeroDesign | Centro Federal de Tecnologia de Minas (CEFTEM) | Belo Horizonte / MG | CEFAST AeroDesign |
| 11 | F-Carrancudo | Universidade Federal do Velho Chico (UFVC) | Juazeiro / BA | F-Carranca |
| 12 | AeroTambaú | Universidade Federal Paraibana (UFPb) | João Pessoa / PB | AeroJampa |
| 13 | Gigazord AeroDesign | Faculdade Tecnológica de São José dos Campos (FATESJ) | São José dos Campos / SP | Megazord AeroDesign |
| 14 | Harpia-Real AeroDesign | Universidade Federal do Grande ABC (UFGABC) | Santo André / SP | Harpia AeroDesign UFABC |
| 15 | Carcarás AeroDesign | Universidade Campineira de Engenharia (UCE) | Campinas / SP | Urubus AeroDesign |
| 16 | UTFalcão AeroDesign | Universidade Tecnológica do Paraná – Ponta Grossa (UTPR) | Ponta Grossa / PR | UTFalcon AeroDesign |
| 17 | Falcão Prateado Aerodesign | Centro Universitário de Araras (UniAraras) | Araras / SP | Falcão Branco Aerodesign |
| 18 | FEA Regular | Centro Universitário de Engenharia do ABC (CUEA) | São Bernardo do Campo / SP | FEI Regular |
| 19 | AeroEscorpião IFP Araraquara | Instituto Federal Paulista – Araraquara (IFP) | Araraquara / SP | AeroScorpion IFSP Araraquara |
| 20 | Nexus AeroDesign | Universidade Federal Catarinense – Joinville (UFCat) | Joinville / SC | Nisus AeroDesign |
| 21 | Atena AeroDesign | Universidade Federal da Guanabara – Escola Politécnica (Poli-UFGB) | Rio de Janeiro / RJ | Minerva AeroDesign |
| 22 | Skyward UFVôo | Universidade Federal da Zona da Mata (UFZM) | Viçosa / MG | Skywards UFVoa |
| 23 | Condores AeroDesign | Universidade Tecnológica do Paraná – Cornélio Procópio (UTPR) | Cornélio Procópio / PR | Abutres AeroDesign |
| 24 | Atalântida | Universidade Tecnológica do Paraná – Curitiba (UTPR) | Curitiba / PR | Acalântis |
| 25 | RedBird AeroDesign | Universidade Federal de Niterói (UFNit) | Niterói / RJ | BlackBird AeroDesign |
| 26 | Ocapi | Universidade Estadual Paulista Prof. Mesquita – Fac. de Eng. de Ilha Solteira (FEIS-UEPM) | Ilha Solteira / SP | Zebra |
| 27 | Flaming Duck | Universidade Federal de Curitiba (UFCuri) | Curitiba / PR | Burning Goose |
| 28 | Hipogrifo AeroDesign | Universidade Tecnológica do Paraná – Londrina (UTPR) | Londrina / PR | Grifo AeroDesign |
| 29 | U-Vuela AeroDesign | Universidad Aeronáutica del Bajío (UNAB) | Querétaro / México | U-Fly AeroDesign |
| 30 | Dragão Dourado AeroDesign | Universidade Federal do Centro Paulista (UFCP) | São Carlos / SP | Dragão Branco AeroDesign |
| 31 | Apolo | Universidade Estadual Maranhense (UEMar) | São Luís / MA | Zeus |
| 32 | Delta do Parnaíba AeroDesign | Universidade Federal de Teresina (UFTer) | Teresina / PI | Delta do Piauí AeroDesign |
| 33 | PégaSertão AeroDesign | Universidade Federal Rural do Sertão – Mossoró (UFRuS) | Mossoró / RN | PegAzuls AeroDesign |
| 34 | AeroGaudério UPG | Universidade do Planalto Gaúcho (UPG) | Passo Fundo / RS | Aerocócus UPF |
| 35 | Jacutinga AeroDesign | Universidade Federal do Pantanal Sul (UFPS) | Dourados / MS | Aracuã AeroDesign |
| 36 | Losango Aéreo AeroDesign | Universidade Federal do Triângulo de Minas (UFTMi) | Uberaba / MG | Triângulo Aéreo AeroDesign |
| 37 | Draco Alatus | Universidade do Planalto Central – Faculdade de Tecnologia (FT-UPC) | Brasília / DF | Draco Volans |
| 38 | Coxilha AeroDesign | Universidade Federal Gaúcha (UFGa) | Porto Alegre / RS | Pampa AeroDesign |
| 39 | Aeroaraucária UCP | Universidade Católica Paranaense (UCP) | Curitiba / PR | Aerocária PUCPR |
| 40 | EVA AeroDesign | Universidade Estadual Maringaense (UEMg) | Maringá / PR | ADAM AeroDesign |
| 41 | Voyager | Universidade Joseense do Vale (UJV) | São José dos Campos / SP | Enterprise |
| 42 | Jandaia AeroDesign | Universidade Federal Cearense – Russas (UFCe) | Russas / CE | Aratinga AeroDesign |
| 43 | Buteo Aerodesign | Instituto Federal Paulista – São Carlos (IFP) | São Carlos / SP | Accipiter Aerodesign |
| 44 | AeroDuque | Centro Universitário Morumbi Paulistano (CUMP) | São Paulo / SP | AeroDuca |
| 45 | Pteranodon AeroDesign | Universidade Federal do Cerrado (UFCer) | Goiânia / GO | Aerodactyl |
| 46 | EPAR AeroDesign | Universidade Tecnológica do Paraná – Pato Branco (UTPR) | Pato Branco / PR | EPAER AeroDesign |
| 47 | Skyfleet | Centro Universitário ENIEC (ENIEC) | Guarulhos / SP | Skyforce |
| 48 | IMA Aerodesign | Instituto Mário de Tecnologia (IMA) | São Caetano do Sul / SP | IMT Aerodesign |
| 49 | AeroSerra | Universidade da Serra Gaúcha (USG) | Caxias do Sul / RS | AeroSul |
| 50 | AURA CAELIQUE GENEROSA | Centro Universitário ETAP (ETAP) | São José dos Campos / SP | AURA TERRAQUE GENEROSA |
| 51 | Arribaçã Aeromec Aerodesign | Universidade Federal Cearense – Fortaleza (UFCe) | Fortaleza / CE | Avoante Aeromec Aerodesign |
| 52 | FAMA Aerodesign | Instituto Federal Capixaba – São Mateus (IFCap) | São Mateus / ES | FAM Aerodesign |
| 53 | Borboremasas Aerodesign | Universidade Federal da Borborema (UFBor) | Campina Grande / PB | Parahyasas Aerodesing |
| 54 | Japiim AeroDesign | Universidade Federal Amazônica do Pará (UFAmP) | Belém / PA | Uirapuru AeroDesign |
| 55 | White Stork | Politechnika Wielkopolska (fictícia) | Poznań / Polônia | White Eagle |
| 56 | Maritaca Aerodesign | Instituto Federal Cearense – Maracanaú (IFCe) | Maracanaú / CE | Maracanã Aerodesign |
| 57 | AeroInspire | Inspire – Instituto de Ensino Superior | São Paulo / SP | AeroInsper |
| 58 | SuzanAERO | Instituto Federal Paulista – Suzano (IFP) | Suzano / SP | ItaquAERO |
| 59 | Quetzalcóatl AeroDesign | Instituto Politécnico Mexicano – Ticomán (IPM) | Cidade do México / México | Kukulcán AeroDesign |
| 60 | IVoa AeroDesign | Instituto Federal da Zona da Mata Mineira – Juiz de Fora (IFZM) | Juiz de Fora / MG | IFly AeroDesign |
| 61 | Ararajubas AeroDesign | Universidade Federal Sergipana (UFSe) | Aracaju / SE | Araras AeroDesign |

Cidades de alguns campi foram inferidas pelo nome da instituição real (ex.: FEI em São Bernardo do Campo, Instituto Mauá em São Caetano do Sul, ENIAC em Guarulhos, ETEP em São José dos Campos). Ajustar se estiver errado.
